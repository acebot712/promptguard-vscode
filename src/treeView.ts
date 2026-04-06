import * as vscode from "vscode";
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

function createFileItem(filePath: string, isProtected: boolean): vscode.TreeItem {
  const item = new vscode.TreeItem(filePath, vscode.TreeItemCollapsibleState.None);
  item.tooltip = isProtected
    ? `${filePath} - Protected by PromptGuard`
    : `${filePath} - Not yet protected`;
  item.iconPath = new vscode.ThemeIcon(
    isProtected ? "shield" : "warning",
    isProtected ? new vscode.ThemeColor("charts.green") : new vscode.ThemeColor("charts.yellow"),
  );
  item.command = {
    command: "vscode.open",
    title: "Open File",
    arguments: [vscode.Uri.file(filePath)],
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

    try {
      if (!this.cachedStatus) {
        this.cachedStatus = await this.cli.status();
      }
      const status = this.cachedStatus;

      const statusIcon =
        status.status === "active"
          ? "check"
          : status.status === "disabled"
            ? "circle-slash"
            : "question";
      const statusLabel =
        status.status === "active"
          ? "Active"
          : status.status === "disabled"
            ? "Disabled"
            : "Not Initialized";

      const statusItems: vscode.TreeItem[] = [createInfoItem("Status", statusLabel, statusIcon)];

      if (status.configuration) {
        statusItems.push(
          createInfoItem(
            "Providers",
            status.configuration.providers.join(", ") || "None",
            "package",
          ),
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
        const fileItems = status.configuration.managed_files.map((file) =>
          createFileItem(file, true),
        );
        items.push(new CategoryTreeItem(`Managed Files (${fileItems.length})`, fileItems, "files"));
      }

      const actionItems: vscode.TreeItem[] = [];

      if (status.status === "not_initialized") {
        const initItem = new vscode.TreeItem("Initialize PromptGuard");
        initItem.command = { command: "promptguard.init", title: "Initialize" };
        initItem.iconPath = new vscode.ThemeIcon("rocket");
        actionItems.push(initItem);
      } else {
        const scanItem = new vscode.TreeItem("Scan for LLM SDKs");
        scanItem.command = { command: "promptguard.scan", title: "Scan" };
        scanItem.iconPath = new vscode.ThemeIcon("search");
        actionItems.push(scanItem);

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
      }

      if (actionItems.length > 0) {
        items.push(new CategoryTreeItem("Actions", actionItems, "zap"));
      }
    } catch {
      const notInitItem = new vscode.TreeItem("Not Initialized");
      notInitItem.iconPath = new vscode.ThemeIcon("warning");
      items.push(notInitItem);

      const initItem = new vscode.TreeItem("Click to Initialize");
      initItem.command = { command: "promptguard.init", title: "Initialize" };
      initItem.iconPath = new vscode.ThemeIcon("rocket");
      items.push(initItem);
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

  context.subscriptions.push(
    vscode.commands.registerCommand("promptguard.refreshTree", () => {
      treeDataProvider.refresh();
    }),
  );

  return treeDataProvider;
}
