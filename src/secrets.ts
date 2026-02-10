import * as vscode from "vscode";

const API_KEY_SECRET_KEY = "promptguard.apiKey";

/**
 * Manages secure storage of the PromptGuard API key using VS Code's SecretStorage API.
 * This prevents API keys from being visible in process lists or config files.
 */
export class SecretsManager {
  private secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  /**
   * Store the API key securely.
   */
  async storeApiKey(apiKey: string): Promise<void> {
    await this.secretStorage.store(API_KEY_SECRET_KEY, apiKey);
  }

  /**
   * Retrieve the API key from secure storage.
   * Returns undefined if no key is stored.
   */
  async getApiKey(): Promise<string | undefined> {
    return this.secretStorage.get(API_KEY_SECRET_KEY);
  }

  /**
   * Delete the stored API key.
   */
  async deleteApiKey(): Promise<void> {
    await this.secretStorage.delete(API_KEY_SECRET_KEY);
  }

  /**
   * Check if an API key is stored.
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== undefined && key.length > 0;
  }

  /**
   * Prompt user for API key and store it securely.
   * Returns the API key if successful, undefined if cancelled.
   */
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

let secretsManager: SecretsManager | null = null;

/**
 * Initialize the secrets manager. Must be called during extension activation.
 */
export function initSecretsManager(context: vscode.ExtensionContext): SecretsManager {
  secretsManager = new SecretsManager(context);
  return secretsManager;
}

/**
 * Get the secrets manager instance.
 * Throws if not initialized.
 */
export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    throw new Error("SecretsManager not initialized. Call initSecretsManager first.");
  }
  return secretsManager;
}
