import * as vscode from "vscode";
import { SecretsManager } from "../secrets";
import { errorMessage } from "../utils";

export async function setApiKeyCommand(secrets: SecretsManager): Promise<void> {
  try {
    const existingKey = await secrets.getApiKey();

    if (existingKey) {
      const choice = await vscode.window.showQuickPick(
        ["Update API key", "Delete API key", "Cancel"],
        { placeHolder: "An API key is already stored. What would you like to do?" },
      );

      if (choice === "Update API key") {
        await secrets.promptAndStoreApiKey();
      } else if (choice === "Delete API key") {
        await secrets.deleteApiKey();
        void vscode.window.showInformationMessage("API key deleted.");
      }
    } else {
      await secrets.promptAndStoreApiKey();
    }
  } catch (error) {
    void vscode.window.showErrorMessage(`Failed to manage API key: ${errorMessage(error)}`);
  }
}
