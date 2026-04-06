import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function enableCommand(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  output.appendLine("PromptGuard: Enable");
  output.show(true);

  try {
    output.appendLine("Running: promptguard enable...");
    await cli.enable();

    output.appendLine("✓ PromptGuard enabled");
    void vscode.window.showInformationMessage("PromptGuard enabled");
    void vscode.commands.executeCommand("promptguard.refreshUI");
  } catch (error) {
    output.appendLine(`✗ Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(`PromptGuard enable failed: ${errorMessage(error)}`);
  }
}
