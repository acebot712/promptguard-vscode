import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function scanSelectionCommand(
  cli: CliWrapper,
  output: vscode.OutputChannel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selectedText = editor.document.getText(editor.selection);
  if (!selectedText?.trim()) {
    void vscode.window.showWarningMessage(
      "No text selected. Select text to scan for security threats.",
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptGuard: Scanning for threats...",
      cancellable: false,
    },
    async () => {
      try {
        output.appendLine(`Scanning selected text (${selectedText.length} characters)...`);
        output.show();

        const result = await cli.detectThreats(selectedText);

        output.appendLine(`Decision: ${result.decision}`);
        output.appendLine(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

        if (result.threat_type) {
          output.appendLine(`Threat Type: ${result.threat_type}`);
        }
        if (result.reason) {
          output.appendLine(`Reason: ${result.reason}`);
        }

        if (result.decision === "block") {
          void vscode.window.showWarningMessage(
            `Security threat detected: ${result.threat_type || "Unknown"} (${(result.confidence * 100).toFixed(0)}% confidence)`,
          );
        } else {
          void vscode.window.showInformationMessage(
            "No security threats detected in selected text.",
          );
        }
      } catch (error) {
        output.appendLine(`Error: ${errorMessage(error)}`);
        void vscode.window.showErrorMessage(`Scan failed: ${errorMessage(error)}`);
      }
    },
  );
}
