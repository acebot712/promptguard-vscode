import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { getStatusBar } from "../extension";

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
    const statusBar = getStatusBar();
    if (statusBar) {
      await statusBar.updateStatus();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`✗ Error: ${message}`);
    void vscode.window.showErrorMessage(`PromptGuard disable failed: ${message}`);
  }
}

