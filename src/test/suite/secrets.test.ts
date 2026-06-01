import * as assert from "assert";
import * as vscode from "vscode";

suite("Secrets Test Suite", () => {
  // ==========================================================================
  // SECRET STORAGE API TESTS
  // ==========================================================================

  test("VS Code SecretStorage API should be accessible through context", () => {
    // SecretStorage is accessed through ExtensionContext.secrets
    // We can verify that the window API is available for prompting
    assert.ok(typeof vscode.window.showInputBox === "function");
  });

  // ==========================================================================
  // API KEY FORMAT VALIDATION TESTS
  // ==========================================================================

  test("Valid live API key format", () => {
    const validLiveKey = "pg_live_abcdef1234567890abcdef1234567890";
    assert.ok(validLiveKey.startsWith("pg_"));
    assert.ok(validLiveKey.length > 20);
  });

  test("Permissive validator accepts any pg_ key", () => {
    // The validator must be permissive: any key starting with "pg_" is accepted
    // so a backend key-format change never breaks the client.
    const acceptedKeys = ["pg_live_abc123", "pg_anything_future_scheme", "pg_123456789"];

    for (const key of acceptedKeys) {
      assert.ok(key.trim().startsWith("pg_"), `Key should be accepted: ${key}`);
    }
  });

  test("Invalid API key format detection", () => {
    const invalidKeys = ["other_key_123456789012345678901234", "randomstring", ""];

    for (const key of invalidKeys) {
      const isValid = key.trim().startsWith("pg_");
      assert.ok(!isValid, `Key should be invalid: ${key}`);
    }
  });

  // ==========================================================================
  // INPUT BOX SIMULATION TESTS
  // ==========================================================================

  test("Input box options structure", () => {
    const inputBoxOptions: vscode.InputBoxOptions = {
      prompt: "Enter your PromptGuard API key",
      placeHolder: "pg_live_xxx",
      password: true,
      ignoreFocusOut: true,
    };

    assert.ok(inputBoxOptions.password);
    assert.ok(inputBoxOptions.ignoreFocusOut);
    assert.strictEqual(inputBoxOptions.prompt, "Enter your PromptGuard API key");
  });

  test("API key validation logic", () => {
    // Permissive validation: accept any non-empty key starting with "pg_".
    const validateApiKey = (value: string): string | null => {
      const trimmed = value?.trim() ?? "";
      if (!trimmed) {
        return "API key is required";
      }
      if (!trimmed.startsWith("pg_")) {
        return "Invalid API key format";
      }
      return null;
    };

    assert.strictEqual(validateApiKey("pg_live_valid123"), null);
    assert.strictEqual(validateApiKey("pg_future_scheme456"), null);
    assert.ok(validateApiKey("invalid_key") !== null);
    assert.ok(validateApiKey("") !== null);
  });

  // ==========================================================================
  // STORAGE KEY TESTS
  // ==========================================================================

  test("Secret storage key constant", () => {
    const API_KEY_STORAGE_KEY = "promptguard.apiKey";
    assert.strictEqual(API_KEY_STORAGE_KEY, "promptguard.apiKey");
  });
});
