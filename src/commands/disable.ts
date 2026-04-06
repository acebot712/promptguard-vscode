import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function disableCommand(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  output.appendLine("PromptGuard: Disable");
  output.show(true);

  try {
    const confirm = await vscode.window.showWarningMessage(
      "This will temporarily disable PromptGuard. Continue?",
      { modal: true },
      "Yes",
      "No",
    );

    if (confirm !== "Yes") {
      output.appendLine("Cancelled by user");
      return;
    }

    output.appendLine("Running: promptguard disable...");
    await cli.disable();

    output.appendLine("✓ PromptGuard disabled");
    void vscode.window.showInformationMessage("PromptGuard disabled");
    void vscode.commands.executeCommand("promptguard.refreshUI");
  } catch (error) {
    output.appendLine(`✗ Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(`PromptGuard disable failed: ${errorMessage(error)}`);
  }
}
