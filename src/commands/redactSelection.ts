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
  const document = editor.document;
  const selectedText = document.getText(selection);
  if (!selectedText?.trim()) {
    void vscode.window.showWarningMessage("No text selected. Select text to redact PII.");
    return;
  }

  // The redaction round-trips through the network. If the document changes
  // while we wait, the captured selection Range would point at different
  // text and we would silently replace the wrong content.
  const versionAtCapture = document.version;

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

        // Log PII types ONLY — never the original PII values. The output
        // channel is plaintext and can end up in logs/screenshots.
        // The CLI returns `piiFound` as a list of PII type names
        // (promptguard-cli/src/commands/redact.rs, RedactResponse).
        const piiCount = result.piiFound.length;
        output.appendLine(`PII types found: ${piiCount}`);
        for (const piiType of result.piiFound) {
          output.appendLine(`  • ${piiType}`);
        }

        if (piiCount > 0) {
          if (document.version !== versionAtCapture) {
            void vscode.window.showErrorMessage(
              "PromptGuard: The document changed while redacting — no text was replaced. " +
                "Re-select the text and run the command again.",
            );
            return;
          }
          const applied = await editor.edit((editBuilder) => {
            editBuilder.replace(selection, result.redacted);
          });
          if (!applied) {
            void vscode.window.showErrorMessage(
              "PromptGuard: Could not apply the redacted text to the editor. " +
                "The document may have changed — re-select the text and try again.",
            );
            return;
          }
          void vscode.window.showInformationMessage(
            `Redacted ${piiCount} type(s) of sensitive data.`,
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
