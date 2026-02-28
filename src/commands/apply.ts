import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { getStatusBar } from "../extension";

export async function applyCommand(
  cli: CliWrapper,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  outputChannel.appendLine("PromptGuard: Apply Transformations");
  outputChannel.show(true);

  try {
    const confirm = await vscode.window.showWarningMessage(
      "This will apply PromptGuard transformations to your code. Continue?",
      { modal: true },
      "Yes",
      "No",
    );

    if (confirm !== "Yes") {
      outputChannel.appendLine("Cancelled by user");
      return;
    }

    outputChannel.appendLine("Running: promptguard apply...");
    await cli.apply(true); // Auto-confirm

    outputChannel.appendLine("✓ Transformations applied successfully");
    vscode.window.showInformationMessage("PromptGuard transformations applied successfully");

    // Refresh status
    const statusBar = getStatusBar();
    if (statusBar) {
      await statusBar.updateStatus();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`✗ Error: ${message}`);
    void vscode.window.showErrorMessage(`PromptGuard apply failed: ${message}`);
  }
}
