import * as vscode from "vscode";
import { CliWrapper } from "../cli";

export async function disableCommand(cli: CliWrapper, outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine("PromptGuard: Disable");
  outputChannel.show(true);

  try {
    const confirm = await vscode.window.showWarningMessage(
      "This will temporarily disable PromptGuard. Continue?",
      { modal: true },
      "Yes",
      "No"
    );

    if (confirm !== "Yes") {
      outputChannel.appendLine("Cancelled by user");
      return;
    }

    outputChannel.appendLine("Running: promptguard disable...");
    await cli.disable();

    outputChannel.appendLine("✓ PromptGuard disabled");
    vscode.window.showInformationMessage("PromptGuard disabled");

    // Refresh status
    const statusBar = (vscode.window as any).promptGuardStatusBar;
    if (statusBar) {
      await statusBar.updateStatus();
    }
  } catch (error: any) {
    const message = error.message || String(error);
    outputChannel.appendLine(`✗ Error: ${message}`);
    vscode.window.showErrorMessage(`PromptGuard disable failed: ${message}`);
  }
}

