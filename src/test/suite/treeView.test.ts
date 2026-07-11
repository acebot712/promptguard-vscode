import * as assert from "assert";
import * as vscode from "vscode";
import { CliWrapper } from "../../cli";
import { createFileItem, PromptGuardTreeDataProvider, resolveManagedFileUri } from "../../treeView";
import { StatusResult } from "../../types";

function mockStatus(managedFiles: string[]): StatusResult {
  return {
    initialized: true,
    status: "active",
    proxy_url: "https://api.promptguard.co/api/v1",
    configuration: {
      config_file: ".promptguard.json",
      files_managed: managedFiles.length,
      managed_files: managedFiles,
      providers: ["openai"],
      backup_enabled: true,
      env_file: ".env",
      exclude_patterns: [],
      backups: [],
      cli_version: "1.2.3",
    },
  };
}

function labelText(item: vscode.TreeItem): string {
  return typeof item.label === "string" ? item.label : (item.label?.label ?? "");
}

function tooltipText(item: vscode.TreeItem): string {
  return typeof item.tooltip === "string" ? item.tooltip : (item.tooltip?.value ?? "");
}

suite("Tree View Test Suite", () => {
  // ==========================================================================
  // MANAGED FILE URI RESOLUTION (regression: Uri.file() on workspace-relative
  // paths produced broken URIs and click-to-open failed)
  // ==========================================================================

  test("Relative managed-file paths resolve against the workspace folder", () => {
    const folderUri = vscode.Uri.file("/workspace/project");
    const resolved = resolveManagedFileUri("src/app.py", folderUri);
    assert.strictEqual(
      resolved.toString(),
      vscode.Uri.file("/workspace/project/src/app.py").toString(),
    );
  });

  test("Absolute managed-file paths are used as-is", () => {
    const folderUri = vscode.Uri.file("/workspace/project");
    const resolved = resolveManagedFileUri("/opt/elsewhere/app.py", folderUri);
    assert.strictEqual(resolved.toString(), vscode.Uri.file("/opt/elsewhere/app.py").toString());
  });

  test("createFileItem open command targets the workspace-joined URI", () => {
    const folderUri = vscode.Uri.file("/workspace/project");
    const item = createFileItem("src/app.py", folderUri);

    assert.strictEqual(item.command?.command, "vscode.open");
    const target = item.command?.arguments?.[0] as vscode.Uri;
    assert.strictEqual(
      target.toString(),
      vscode.Uri.file("/workspace/project/src/app.py").toString(),
    );
  });

  test("createFileItem renders managed files as protected", () => {
    // The CLI's status --json exposes a flat managed_files list with no
    // per-file protection flag, so every managed file is protected (green
    // shield). There is no "not yet protected" state here.
    const folderUri = vscode.Uri.file("/workspace/project");
    const item = createFileItem("a.py", folderUri);

    assert.ok(tooltipText(item).includes("Protected"));
    assert.ok(!tooltipText(item).includes("Not yet protected"));
    const icon = item.iconPath as vscode.ThemeIcon;
    assert.strictEqual(icon.id, "shield");
  });

  // ==========================================================================
  // getChildren AGAINST A STUBBED CliWrapper
  // ==========================================================================

  test("getChildren surfaces status, managed files, and actions", async () => {
    const cli = {
      status: () => Promise.resolve(mockStatus(["src/app.py", "src/other.py"])),
    } as unknown as CliWrapper;

    const provider = new PromptGuardTreeDataProvider(cli);
    const topLevel = await provider.getChildren();

    const labels = topLevel.map(labelText);
    assert.ok(labels.includes("Status"), `expected Status category, got: ${labels.join(", ")}`);
    assert.ok(
      labels.includes("Managed Files (2)"),
      `expected managed-files category, got: ${labels.join(", ")}`,
    );
    assert.ok(labels.includes("Actions"), `expected Actions category, got: ${labels.join(", ")}`);

    // The SDK-detection action is labeled "Detect LLM SDKs" (the verb "Scan"
    // is reserved for the threat-detection family).
    const actionsCategory = topLevel.find((item) => labelText(item) === "Actions");
    assert.ok(actionsCategory, "Actions category should exist");
    const actionItems = await provider.getChildren(actionsCategory);
    const actionLabels = actionItems.map(labelText);
    assert.ok(
      actionLabels.includes("Detect LLM SDKs"),
      `expected a "Detect LLM SDKs" action, got: ${actionLabels.join(", ")}`,
    );
    assert.ok(
      !actionLabels.some((l) => l.includes("Scan")),
      `no action should use the reserved "Scan" verb, got: ${actionLabels.join(", ")}`,
    );
  });

  test("getChildren managed-file items are clickable with resolved URIs", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "test harness must open a workspace folder");

    const cli = {
      status: () => Promise.resolve(mockStatus(["src/app.py"])),
    } as unknown as CliWrapper;

    const provider = new PromptGuardTreeDataProvider(cli);
    const topLevel = await provider.getChildren();
    const filesCategory = topLevel.find((item) => labelText(item).startsWith("Managed Files"));
    assert.ok(filesCategory, "managed files category should exist");

    const fileItems = await provider.getChildren(filesCategory);
    assert.strictEqual(fileItems.length, 1);
    const target = fileItems[0].command?.arguments?.[0] as vscode.Uri;
    assert.strictEqual(
      target.toString(),
      vscode.Uri.joinPath(folder.uri, "src/app.py").toString(),
      "file item must open the path joined to the workspace root",
    );
  });

  test("getChildren returns empty when the CLI is unavailable (welcome takes over)", async () => {
    // A thrown status() means the CLI could not answer (missing/failed). The
    // tree returns [] so the "CLI unavailable" welcome content shows an
    // Install/Update CLI action — it must NOT misdiagnose this as
    // "not initialized" and offer to Initialize.
    const cli = {
      status: () => Promise.reject(new Error("CLI not found")),
    } as unknown as CliWrapper;

    const provider = new PromptGuardTreeDataProvider(cli);
    const topLevel = await provider.getChildren();

    assert.deepStrictEqual(topLevel, [], "CLI-unavailable tree must be empty");
  });

  test("getChildren returns empty when not initialized (welcome takes over)", async () => {
    // A genuine {"initialized": false} answer: the tree defers to the
    // "get started" welcome content rather than rendering a Status category.
    const cli = {
      status: () => Promise.resolve({ initialized: false, status: "not_initialized" }),
    } as unknown as CliWrapper;

    const provider = new PromptGuardTreeDataProvider(cli);
    const topLevel = await provider.getChildren();

    assert.deepStrictEqual(topLevel, [], "not-initialized tree must be empty");
  });

  test("refresh clears the cached status", async () => {
    let calls = 0;
    const cli = {
      status: () => {
        calls++;
        return Promise.resolve(mockStatus([]));
      },
    } as unknown as CliWrapper;

    const provider = new PromptGuardTreeDataProvider(cli);
    await provider.getChildren();
    await provider.getChildren();
    assert.strictEqual(calls, 1, "status should be cached between getChildren calls");

    provider.refresh();
    await provider.getChildren();
    assert.strictEqual(calls, 2, "refresh must invalidate the cached status");
  });
});
