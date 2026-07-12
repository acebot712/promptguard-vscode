import * as vscode from "vscode";

const API_KEY_SECRET_KEY = "promptguard.apiKey";

/**
 * Validate API key input. Returns an error message, or null when valid.
 * Permissive by design: any sufficiently-long key starting with "pg_" is
 * accepted so a backend format change never breaks the client.
 * Exported so tests exercise the real validator.
 */
export function validateApiKeyInput(value: string): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "API key is required";
  }
  if (!trimmed.startsWith("pg_")) {
    return "Invalid API key format. PromptGuard keys start with 'pg_'.";
  }
  // Guard against an obviously-truncated paste (real keys are far longer).
  if (trimmed.length < 12) {
    return "That key looks incomplete — check you copied the whole key.";
  }
  return null;
}

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
      validateInput: validateApiKeyInput,
    });

    if (apiKey) {
      // Trim once and use the same value for storage and the return value —
      // callers (e.g. init) pass the returned key straight to the CLI, so a
      // stored/returned mismatch would mean two different keys in play.
      const trimmed = apiKey.trim();
      await this.storeApiKey(trimmed);
      void vscode.window.showInformationMessage("API key stored securely.");
      return trimmed;
    }

    return undefined;
  }
}
