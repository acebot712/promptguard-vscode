import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { getStatusBar } from "../extension";

export async function enableCommand(cli: CliWrapper, outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine("PromptGuard: Enable");
  outputChannel.show(true);

  try {
    outputChannel.appendLine("Running: promptguard enable...");
    await cli.enable();

    outputChannel.appendLine("✓ PromptGuard enabled");
    vscode.window.showInformationMessage("PromptGuard enabled");

    // Refresh status
    const statusBar = getStatusBar();
    if (statusBar) {
      await statusBar.updateStatus();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`✗ Error: ${message}`);
    void vscode.window.showErrorMessage(`PromptGuard enable failed: ${message}`);
  }
}

