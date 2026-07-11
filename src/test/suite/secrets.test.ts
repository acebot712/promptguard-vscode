import * as assert from "assert";
import { validateApiKeyInput } from "../../secrets";

suite("Secrets Test Suite", () => {
  // ==========================================================================
  // API KEY VALIDATOR (real implementation)
  // ==========================================================================

  test("Accepts well-formed pg_ keys", () => {
    assert.strictEqual(validateApiKeyInput("REDACTED_TEST_FIXTUREabcdef1234567890"), null);
    assert.strictEqual(validateApiKeyInput("pg_anything_future_scheme"), null);
    assert.strictEqual(validateApiKeyInput("pg_123456789012"), null);
  });

  test("Accepts keys with surrounding whitespace", () => {
    assert.strictEqual(validateApiKeyInput("  REDACTED_TEST_FIXTURE  "), null);
  });

  test("Rejects empty input", () => {
    assert.strictEqual(validateApiKeyInput(""), "API key is required");
    assert.strictEqual(validateApiKeyInput("   "), "API key is required");
  });

  test("Rejects keys without the pg_ prefix", () => {
    assert.ok(validateApiKeyInput("sk_live_abc1234567890") !== null);
    assert.ok(validateApiKeyInput("randomstring12345") !== null);
    assert.ok(validateApiKeyInput("other_key_123456789012345678901234") !== null);
  });

  test("Rejects obviously-truncated keys", () => {
    assert.ok(validateApiKeyInput("pg_1") !== null);
    assert.ok(validateApiKeyInput("pg_12345678") !== null);
  });
});
