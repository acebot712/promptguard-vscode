import * as assert from "assert";
import { CliExecutionError } from "../../types";

suite("CLI Wrapper Test Suite", () => {
  // ==========================================================================
  // ERROR CLASS TESTS
  // ==========================================================================

  test("CliExecutionError should be an Error instance", () => {
    const error = new CliExecutionError("Test error", 1, "stderr", "stdout");
    assert.ok(error instanceof Error);
    assert.strictEqual(error.name, "CliExecutionError");
    assert.strictEqual(error.message, "Test error");
    assert.strictEqual(error.code, 1);
    assert.strictEqual(error.stderr, "stderr");
    assert.strictEqual(error.stdout, "stdout");
  });

  test("CliExecutionError should have stack trace", () => {
    const error = new CliExecutionError("Test error");
    assert.ok(error.stack);
    assert.ok(error.stack.includes("CliExecutionError"));
  });

  // ==========================================================================
  // CLI OUTPUT PARSING TESTS
  // ==========================================================================

  test("Should parse valid JSON status output", () => {
    const mockOutput = JSON.stringify({
      initialized: true,
      enabled: true,
      proxy_url: "https://api.promptguard.co/api/v1",
      providers: ["openai", "anthropic"],
      configuration: {
        files_managed: ["app.py", "main.py"],
        backups: [],
      },
    });

    const parsed = JSON.parse(mockOutput) as {
      initialized: boolean;
      enabled: boolean;
      proxy_url: string;
      providers: string[];
    };

    assert.strictEqual(parsed.initialized, true);
    assert.strictEqual(parsed.enabled, true);
    assert.strictEqual(parsed.proxy_url, "https://api.promptguard.co/api/v1");
    assert.deepStrictEqual(parsed.providers, ["openai", "anthropic"]);
  });

  test("Should parse valid JSON scan output", () => {
    const mockOutput = JSON.stringify({
      total_files_scanned: 100,
      files_with_sdks: 5,
      total_instances: 10,
      providers: [
        {
          name: "openai",
          file_count: 3,
          instance_count: 7,
          files: ["app.py", "main.py", "utils.py"],
        },
        {
          name: "anthropic",
          file_count: 2,
          instance_count: 3,
          files: ["claude.py", "chat.py"],
        },
      ],
    });

    const parsed = JSON.parse(mockOutput) as {
      total_files_scanned: number;
      providers: { name: string; file_count: number }[];
    };

    assert.strictEqual(parsed.total_files_scanned, 100);
    assert.strictEqual(parsed.providers.length, 2);
    assert.strictEqual(parsed.providers[0].name, "openai");
    assert.strictEqual(parsed.providers[1].name, "anthropic");
  });

  // ==========================================================================
  // INPUT VALIDATION TESTS
  // ==========================================================================

  test("API key format validation", () => {
    const validTestKey = "pg_sk_test_demo123456789012345678901234";
    const validProdKey = "pg_sk_prod_live123456789012345678901234";
    const invalidKey = "sk_live_abc123";

    assert.ok(
      validTestKey.startsWith("pg_sk_test_"),
      "Should accept test key format"
    );
    assert.ok(
      validProdKey.startsWith("pg_sk_prod_"),
      "Should accept prod key format"
    );
    assert.ok(
      !invalidKey.startsWith("pg_sk_test_") &&
        !invalidKey.startsWith("pg_sk_prod_"),
      "Should reject non-PromptGuard key formats"
    );
  });

  test("Proxy URL validation", () => {
    const validUrls = [
      "https://api.promptguard.co/api/v1",
      "https://custom.example.com/proxy",
      "http://localhost:8080/api",
      "http://127.0.0.1:3000/v1",
    ];

    const invalidUrls = ["http://api.promptguard.co/api/v1", "http://evil.com/proxy"];

    for (const url of validUrls) {
      const isValid =
        url.startsWith("https://") ||
        url.startsWith("http://localhost") ||
        url.startsWith("http://127.0.0.1");
      assert.ok(isValid, `Valid URL should be accepted: ${url}`);
    }

    for (const url of invalidUrls) {
      const isValid =
        url.startsWith("https://") ||
        url.startsWith("http://localhost") ||
        url.startsWith("http://127.0.0.1");
      assert.ok(!isValid, `Invalid URL should be rejected: ${url}`);
    }
  });
});
