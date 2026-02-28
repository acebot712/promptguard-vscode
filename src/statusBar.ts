import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { StatusResult } from "./types";

export class PromptGuardStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private cli: CliWrapper;
  private currentStatus: StatusResult | null = null;

  constructor(cli: CliWrapper) {
    this.cli = cli;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = "promptguard.status";
    this.statusBarItem.tooltip = "Click to view PromptGuard status";
    void this.updateStatus();
  }

  async updateStatus(): Promise<void> {
    try {
      const status = await this.cli.status();
      this.currentStatus = status;
      this.updateStatusBarItem(status);
    } catch {
      // CLI not found or not initialized
      this.statusBarItem.text = "$(shield) PromptGuard: Not initialized";
      this.statusBarItem.tooltip = "Click to initialize PromptGuard";
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.show();
    }
  }

  private updateStatusBarItem(status: StatusResult): void {
    if (!status.initialized) {
      this.statusBarItem.text = "$(shield) PromptGuard: Not initialized";
      this.statusBarItem.tooltip = "Click to initialize PromptGuard";
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.status === "active") {
      this.statusBarItem.text = "$(shield) PromptGuard: Active";
      this.statusBarItem.tooltip = `Active | Proxy: ${status.proxy_url || "N/A"}`;
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.status === "disabled") {
      this.statusBarItem.text = "$(shield) PromptGuard: Disabled";
      this.statusBarItem.tooltip = "Click to enable PromptGuard";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
      this.statusBarItem.text = "$(shield) PromptGuard: Unknown";
      this.statusBarItem.tooltip = "Click to view status";
      this.statusBarItem.backgroundColor = undefined;
    }

    this.statusBarItem.show();
  }

  getCurrentStatus(): StatusResult | null {
    return this.currentStatus;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
