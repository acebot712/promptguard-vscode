import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function redactSelectionCommand(
  cli: CliWrapper,
  output: vscode.OutputChannel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  if (!selectedText?.trim()) {
    void vscode.window.showWarningMessage("No text selected. Select text to redact PII.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptGuard: Redacting PII...",
      cancellable: false,
    },
    async () => {
      try {
        output.appendLine(
          `Redacting PII from selected text (${selectedText.length} characters)...`,
        );
        output.show();

        const result = await cli.redactText(selectedText);

        output.appendLine(`Entities found: ${result.entity_count}`);
        for (const entity of result.entities_found) {
          output.appendLine(`  • ${entity.type}: ${entity.original} → ${entity.replacement}`);
        }

        if (result.entity_count > 0) {
          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, result.redacted_text);
          });
          void vscode.window.showInformationMessage(
            `Redacted ${result.entity_count} sensitive entities.`,
          );
        } else {
          void vscode.window.showInformationMessage(
            "No sensitive entities found in selected text.",
          );
        }
      } catch (error) {
        output.appendLine(`Error: ${errorMessage(error)}`);
        void vscode.window.showErrorMessage(`Redaction failed: ${errorMessage(error)}`);
      }
    },
  );
}
