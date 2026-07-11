import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { StatusResult } from "./types";
import { errorMessage } from "./utils";

export class PromptGuardStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private cli: CliWrapper;

  constructor(cli: CliWrapper) {
    this.cli = cli;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = "promptguard.status";
    this.statusBarItem.tooltip = "Click to view PromptGuard status";
    // No eager updateStatus() here: extension.ts triggers the first update
    // after CLI resolution completes, so we don't spawn the CLI prematurely.
  }

  /** Visible for tests: the rendered status bar text. */
  get text(): string {
    return this.statusBarItem.text;
  }

  /** Visible for tests: the rendered status bar tooltip. */
  get tooltip(): string | vscode.MarkdownString | undefined {
    return this.statusBarItem.tooltip;
  }

  async updateStatus(): Promise<void> {
    try {
      const status = await this.cli.status();
      this.updateStatusBarItem(status);
    } catch (error) {
      // "Not initialized" is reserved for a genuine CLI answer
      // ({"initialized": false}, which `status --json` reports with exit 0).
      // A thrown error here means we could not get an answer at all — CLI
      // missing, spawn/timeout failure, unparseable output — so we render a
      // distinct "Unavailable" state (rather than keeping the last-known
      // state, which could go stale silently) and surface the cause in the
      // tooltip. CliExecutionError messages are already sanitized.
      this.statusBarItem.text = "$(shield) PromptGuard: Unavailable";
      this.statusBarItem.tooltip = `PromptGuard status unavailable: ${errorMessage(error)}`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
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

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
