import * as vscode from "vscode";
import { CliWrapper } from "../cli";

export async function enableCommand(cli: CliWrapper, outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine("PromptGuard: Enable");
  outputChannel.show(true);

  try {
    outputChannel.appendLine("Running: promptguard enable...");
    await cli.enable();

    outputChannel.appendLine("✓ PromptGuard enabled");
    vscode.window.showInformationMessage("PromptGuard enabled");

    // Refresh status
    const statusBar = (vscode.window as any).promptGuardStatusBar;
    if (statusBar) {
      await statusBar.updateStatus();
    }
  } catch (error: any) {
    const message = error.message || String(error);
    outputChannel.appendLine(`✗ Error: ${message}`);
    vscode.window.showErrorMessage(`PromptGuard enable failed: ${message}`);
  }
}

