import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function applyCommand(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  output.appendLine("PromptGuard: Apply Protection");
  output.show(true);

  try {
    const confirm = await vscode.window.showWarningMessage(
      "PromptGuard will rewrite your LLM SDK calls to route through its proxy. " +
        "Your original files are backed up — run 'PromptGuard: Disable' to restore them. Continue?",
      { modal: true },
      "Yes",
      "No",
    );

    if (confirm !== "Yes") {
      output.appendLine("Cancelled by user");
      return;
    }

    output.appendLine("Running: promptguard apply...");
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "PromptGuard: Applying transformations…",
        cancellable: false,
      },
      () => cli.apply(true),
    );

    output.appendLine("✓ Transformations applied successfully");
    void vscode.window.showInformationMessage("PromptGuard transformations applied successfully");
    void vscode.commands.executeCommand("promptguard.refreshUI");
  } catch (error) {
    output.appendLine(`✗ Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(`PromptGuard apply failed: ${errorMessage(error)}`);
  }
}
