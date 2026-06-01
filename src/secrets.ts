import * as vscode from "vscode";

const API_KEY_SECRET_KEY = "promptguard.apiKey";

export class SecretsManager {
  private secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  async storeApiKey(apiKey: string): Promise<void> {
    await this.secretStorage.store(API_KEY_SECRET_KEY, apiKey);
  }

  async getApiKey(): Promise<string | undefined> {
    return this.secretStorage.get(API_KEY_SECRET_KEY);
  }

  async deleteApiKey(): Promise<void> {
    await this.secretStorage.delete(API_KEY_SECRET_KEY);
  }

  async promptAndStoreApiKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: "Enter your PromptGuard API key",
      placeHolder: "pg_live_xxx",
      password: true,
      validateInput: (value) => {
        const trimmed = value?.trim() ?? "";
        if (!trimmed) {
          return "API key is required";
        }
        // Permissive check: accept any key starting with "pg_" so a backend
        // format change never breaks the client. Reject only clearly-wrong input.
        if (!trimmed.startsWith("pg_")) {
          return "Invalid API key format. PromptGuard keys start with 'pg_'.";
        }
        // Guard against an obviously-truncated paste (real keys are far longer).
        if (trimmed.length < 12) {
          return "That key looks incomplete — check you copied the whole key.";
        }
        return null;
      },
    });

    if (apiKey) {
      await this.storeApiKey(apiKey.trim());
      void vscode.window.showInformationMessage("API key stored securely.");
      return apiKey;
    }

    return undefined;
  }
}
