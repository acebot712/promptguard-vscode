import * as vscode from "vscode";
import * as path from "path";
import { CliWrapper } from "./cli";
import { StatusResult } from "./types";

class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly children: vscode.TreeItem[],
    icon: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

/**
 * Resolve a managed-file path from CLI output to an openable URI. The CLI
 * reports paths relative to the project root, so relative paths must be
 * joined against the workspace folder — Uri.file() on a relative path yields
 * a broken URI and click-to-open fails. Exported for tests.
 */
export function resolveManagedFileUri(
  filePath: string,
  workspaceFolderUri?: vscode.Uri,
): vscode.Uri {
  if (path.isAbsolute(filePath) || !workspaceFolderUri) {
    return vscode.Uri.file(filePath);
  }
  return vscode.Uri.joinPath(workspaceFolderUri, filePath);
}

/**
 * Build a tree item for a managed file. Every entry in the CLI's
 * `status --json` `managed_files` list is, by definition, a file PromptGuard
 * manages — the CLI exposes no per-file "protected vs pending" flag (it is a
 * flat path list; see promptguard-cli status.rs `config.metadata.files_managed`).
 * So a managed file always renders as protected; there is no "not yet
 * protected" state to distinguish here (unprotected SDK usage surfaces as
 * editor diagnostics instead). Exported for tests.
 */
export function createFileItem(filePath: string, workspaceFolderUri?: vscode.Uri): vscode.TreeItem {
  const item = new vscode.TreeItem(filePath, vscode.TreeItemCollapsibleState.None);
  item.tooltip = `${filePath} — Protected by PromptGuard`;
  item.iconPath = new vscode.ThemeIcon("shield", new vscode.ThemeColor("charts.green"));
  item.command = {
    command: "vscode.open",
    title: "Open File",
    arguments: [resolveManagedFileUri(filePath, workspaceFolderUri)],
  };
  return item;
}

function createInfoItem(label: string, value: string, icon: string): vscode.TreeItem {
  const item = new vscode.TreeItem(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(icon);
  return item;
}

export class PromptGuardTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private cli: CliWrapper;
  private cachedStatus: StatusResult | null = null;

  constructor(cli: CliWrapper) {
    this.cli = cli;
  }

  refresh(): void {
    this.cachedStatus = null;
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!vscode.workspace.workspaceFolders) {
      return [new vscode.TreeItem("No workspace open")];
    }

    if (!element) {
      return this.getTopLevelItems();
    }

    if (element instanceof CategoryTreeItem) {
      return element.children;
    }

    return [];
  }

  private async getTopLevelItems(): Promise<vscode.TreeItem[]> {
    const items: vscode.TreeItem[] = [];

    let status: StatusResult;
    try {
      if (!this.cachedStatus) {
        this.cachedStatus = await this.cli.status();
      }
      status = this.cachedStatus;
    } catch {
      // cli.status() threw: the CLI could not answer at all (missing binary,
      // spawn/timeout failure, unparseable output) — distinct from a genuine
      // {"initialized": false}. Returning [] hands the view over to the
      // "CLI unavailable" welcome content (contributes.viewsWelcome, gated on
      // !promptguard.cliAvailable), which points at Install/Update CLI rather
      // than misdiagnosing a missing CLI as "not initialized" and offering to
      // Initialize. Mirrors the status bar's "Unavailable" handling.
      return [];
    }

    // Not set up yet: hand the view over to the "get started" welcome content
    // (gated on promptguard.cliAvailable && !promptguard.initialized), which
    // offers Initialize / Detect LLM SDKs.
    if (!status.initialized || status.status === "not_initialized") {
      return [];
    }

    const statusIcon =
      status.status === "active"
        ? "check"
        : status.status === "disabled"
          ? "circle-slash"
          : "question";
    const statusLabel =
      status.status === "active" ? "Active" : status.status === "disabled" ? "Disabled" : "Unknown";

    const statusItems: vscode.TreeItem[] = [createInfoItem("Status", statusLabel, statusIcon)];

    if (status.configuration) {
      statusItems.push(
        createInfoItem("Providers", status.configuration.providers.join(", ") || "None", "package"),
        createInfoItem("Files Managed", String(status.configuration.files_managed), "file-code"),
      );

      if (status.configuration.cli_version) {
        statusItems.push(
          createInfoItem("CLI Version", status.configuration.cli_version, "versions"),
        );
      }
    }

    items.push(new CategoryTreeItem("Status", statusItems, "info"));

    if (status.configuration?.managed_files && status.configuration.managed_files.length > 0) {
      // The CLI's `status` runs with cwd = first workspace folder (see
      // CliWrapper.executeCommand), so relative managed-file paths resolve
      // against that folder.
      const workspaceFolderUri = vscode.workspace.workspaceFolders?.[0]?.uri;
      const fileItems = status.configuration.managed_files.map((file) =>
        createFileItem(file, workspaceFolderUri),
      );
      items.push(new CategoryTreeItem(`Managed Files (${fileItems.length})`, fileItems, "files"));
    }

    // Only initialized projects reach here (not_initialized / CLI-unavailable
    // return [] above), so the actions are always the post-init set.
    const actionItems: vscode.TreeItem[] = [];

    const detectItem = new vscode.TreeItem("Detect LLM SDKs");
    detectItem.command = { command: "promptguard.scan", title: "Detect LLM SDKs" };
    detectItem.tooltip = "Detect LLM SDK usage across this project";
    detectItem.iconPath = new vscode.ThemeIcon("search");
    actionItems.push(detectItem);

    if (status.status === "active") {
      const disableItem = new vscode.TreeItem("Disable Protection");
      disableItem.command = { command: "promptguard.disable", title: "Disable" };
      disableItem.iconPath = new vscode.ThemeIcon("circle-slash");
      actionItems.push(disableItem);
    } else {
      const enableItem = new vscode.TreeItem("Enable Protection");
      enableItem.command = { command: "promptguard.enable", title: "Enable" };
      enableItem.iconPath = new vscode.ThemeIcon("check");
      actionItems.push(enableItem);
    }

    // Always offer key/project management so users don't have to hunt the palette.
    const setApiKeyItem = new vscode.TreeItem("Set API Key");
    setApiKeyItem.command = { command: "promptguard.setApiKey", title: "Set API Key" };
    setApiKeyItem.iconPath = new vscode.ThemeIcon("key");
    actionItems.push(setApiKeyItem);

    const selectProjectItem = new vscode.TreeItem("Select Project");
    selectProjectItem.command = { command: "promptguard.selectProject", title: "Select Project" };
    selectProjectItem.iconPath = new vscode.ThemeIcon("project");
    actionItems.push(selectProjectItem);

    if (actionItems.length > 0) {
      items.push(new CategoryTreeItem("Actions", actionItems, "zap"));
    }

    return items;
  }
}

export function registerTreeView(
  context: vscode.ExtensionContext,
  cli: CliWrapper,
): PromptGuardTreeDataProvider {
  const treeDataProvider = new PromptGuardTreeDataProvider(cli);

  const treeView = vscode.window.createTreeView("promptguard.managedFiles", {
    treeDataProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // Note: the single refresh command "promptguard.refreshUI" is registered in
  // extension.ts and refreshes BOTH the status bar and this tree. We intentionally
  // do not register a tree-only refresh command here to avoid duplication.

  return treeDataProvider;
}
