import * as vscode from "vscode";
import { CliWrapper } from "../cli";

export async function applyCommand(cli: CliWrapper, outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine("PromptGuard: Apply Transformations");
  outputChannel.show(true);

  try {
    const confirm = await vscode.window.showWarningMessage(
      "This will apply PromptGuard transformations to your code. Continue?",
      { modal: true },
      "Yes",
      "No"
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
    const statusBar = (vscode.window as any).promptGuardStatusBar;
    if (statusBar) {
      await statusBar.updateStatus();
    }
  } catch (error: any) {
    const message = error.message || String(error);
    outputChannel.appendLine(`✗ Error: ${message}`);
    vscode.window.showErrorMessage(`PromptGuard apply failed: ${message}`);
  }
}

