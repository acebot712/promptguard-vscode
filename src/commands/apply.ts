import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function applyCommand(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  output.appendLine("PromptGuard: Apply Transformations");
  output.show(true);

  try {
    const confirm = await vscode.window.showWarningMessage(
      "This will apply PromptGuard transformations to your code. Continue?",
      { modal: true },
      "Yes",
      "No",
    );

    if (confirm !== "Yes") {
      output.appendLine("Cancelled by user");
      return;
    }

    output.appendLine("Running: promptguard apply...");
    await cli.apply(true);

    output.appendLine("✓ Transformations applied successfully");
    void vscode.window.showInformationMessage("PromptGuard transformations applied successfully");
    void vscode.commands.executeCommand("promptguard.refreshUI");
  } catch (error) {
    output.appendLine(`✗ Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(`PromptGuard apply failed: ${errorMessage(error)}`);
  }
}
