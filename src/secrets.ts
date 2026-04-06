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
      placeHolder: "pg_sk_test_...",
      password: true,
      validateInput: (value) => {
        if (!value) {
          return "API key is required";
        }
        if (!value.startsWith("pg_sk_test_") && !value.startsWith("pg_sk_prod_")) {
          return "Invalid API key format. Must start with 'pg_sk_test_' or 'pg_sk_prod_'";
        }
        return null;
      },
    });

    if (apiKey) {
      await this.storeApiKey(apiKey);
      void vscode.window.showInformationMessage("API key stored securely.");
      return apiKey;
    }

    return undefined;
  }
}
