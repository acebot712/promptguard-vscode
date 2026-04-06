import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function scanFileCommand(
  cli: CliWrapper,
  output: vscode.OutputChannel,
  uri?: vscode.Uri,
): Promise<void> {
  const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
  if (!fileUri) {
    void vscode.window.showWarningMessage("No file to scan");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptGuard: Scanning file...",
      cancellable: false,
    },
    async () => {
      try {
        output.appendLine(`Scanning file: ${fileUri.fsPath}`);
        output.show();

        const document = await vscode.workspace.openTextDocument(fileUri);
        const content = document.getText();
        const result = await cli.detectThreats(content);

        output.appendLine(`Decision: ${result.decision}`);
        output.appendLine(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

        if (result.decision === "block") {
          void vscode.window.showWarningMessage(
            `Security threat detected in file: ${result.threat_type || "Unknown"}`,
          );
        } else {
          void vscode.window.showInformationMessage("No security threats detected in file.");
        }
      } catch (error) {
        output.appendLine(`Error: ${errorMessage(error)}`);
        void vscode.window.showErrorMessage(`File scan failed: ${errorMessage(error)}`);
      }
    },
  );
}
