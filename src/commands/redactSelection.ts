import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage, handleQuotaError } from "../utils";

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

        // Log entity types and counts ONLY — never the original PII values.
        // The output channel is plaintext and can end up in logs/screenshots.
        output.appendLine(`Entities found: ${result.entity_count}`);
        const countsByType = new Map<string, number>();
        for (const entity of result.entities_found) {
          countsByType.set(entity.type, (countsByType.get(entity.type) ?? 0) + 1);
        }
        for (const [type, count] of countsByType) {
          output.appendLine(`  • ${type}: ${count}`);
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
        if (!(await handleQuotaError(error))) {
          void vscode.window.showErrorMessage(`Redaction failed: ${errorMessage(error)}`);
        }
      }
    },
  );
}
