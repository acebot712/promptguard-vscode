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
    const item = createFileItem("src/app.py", true, folderUri);

    assert.strictEqual(item.command?.command, "vscode.open");
    const target = item.command?.arguments?.[0] as vscode.Uri;
    assert.strictEqual(
      target.toString(),
      vscode.Uri.file("/workspace/project/src/app.py").toString(),
    );
  });

  test("createFileItem reflects protection state", () => {
    const folderUri = vscode.Uri.file("/workspace/project");
    const protectedItem = createFileItem("a.py", true, folderUri);
    const unprotectedItem = createFileItem("b.py", false, folderUri);

    assert.ok(tooltipText(protectedItem).includes("Protected"));
    assert.ok(tooltipText(unprotectedItem).includes("Not yet protected"));
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

  test("getChildren falls back to init items when the CLI fails", async () => {
    const cli = {
      status: () => Promise.reject(new Error("CLI not found")),
    } as unknown as CliWrapper;

    const provider = new PromptGuardTreeDataProvider(cli);
    const topLevel = await provider.getChildren();

    const labels = topLevel.map(labelText);
    assert.ok(labels.includes("Not Initialized"));
    assert.ok(labels.includes("Click to Initialize"));
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
