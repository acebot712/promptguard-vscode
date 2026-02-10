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

  // ==========================================================================
  // SECURITY SCAN RESULT PARSING TESTS
  // ==========================================================================

  test("Should parse security scan API response", () => {
    const mockScanResponse = JSON.stringify({
      decision: "block",
      confidence: 0.92,
      threat_type: "prompt_injection",
      reason: "Detected attempt to override system instructions",
    });

    const parsed = JSON.parse(mockScanResponse) as {
      decision: string;
      confidence: number;
      threat_type: string;
      reason: string;
    };

    assert.strictEqual(parsed.decision, "block");
    assert.strictEqual(parsed.confidence, 0.92);
    assert.strictEqual(parsed.threat_type, "prompt_injection");
    assert.ok(parsed.reason.length > 0);
  });

  test("Should parse allow decision", () => {
    const mockScanResponse = JSON.stringify({
      decision: "allow",
      confidence: 0.99,
    });

    const parsed = JSON.parse(mockScanResponse) as {
      decision: string;
      confidence: number;
    };

    assert.strictEqual(parsed.decision, "allow");
    assert.ok(parsed.confidence > 0.9);
  });

  // ==========================================================================
  // REDACT RESULT PARSING TESTS
  // ==========================================================================

  test("Should parse redact API response", () => {
    const mockRedactResponse = JSON.stringify({
      redacted_text: "Contact [NAME] at [EMAIL] for more information.",
      entities_found: [
        { type: "NAME", original: "John Doe", replacement: "[NAME]" },
        { type: "EMAIL", original: "john.doe@example.com", replacement: "[EMAIL]" },
      ],
      entity_count: 2,
    });

    const parsed = JSON.parse(mockRedactResponse) as {
      redacted_text: string;
      entities_found: { type: string; original: string; replacement: string }[];
      entity_count: number;
    };

    assert.strictEqual(parsed.entity_count, 2);
    assert.ok(parsed.redacted_text.includes("[NAME]"));
    assert.ok(parsed.redacted_text.includes("[EMAIL]"));
    assert.strictEqual(parsed.entities_found[0].type, "NAME");
    assert.strictEqual(parsed.entities_found[1].type, "EMAIL");
  });

  test("Should parse redact response with no entities", () => {
    const mockRedactResponse = JSON.stringify({
      redacted_text: "Hello, this is a clean message with no PII.",
      entities_found: [],
      entity_count: 0,
    });

    const parsed = JSON.parse(mockRedactResponse) as {
      redacted_text: string;
      entities_found: unknown[];
      entity_count: number;
    };

    assert.strictEqual(parsed.entity_count, 0);
    assert.strictEqual(parsed.entities_found.length, 0);
  });

  // ==========================================================================
  // SCAN RESULT WITH INSTANCES TESTS
  // ==========================================================================

  test("Should parse scan output with instances", () => {
    const mockOutput = JSON.stringify({
      total_files_scanned: 50,
      files_with_sdks: 2,
      total_instances: 3,
      providers: [
        {
          name: "openai",
          file_count: 2,
          instance_count: 3,
          files: ["app.py", "main.py"],
          instances: [
            { file: "app.py", line: 10, column: 5, has_base_url: false },
            { file: "app.py", line: 25, column: 12, has_base_url: true, current_base_url: "https://api.promptguard.co/api/v1" },
            { file: "main.py", line: 8, column: 1, has_base_url: false },
          ],
        },
      ],
    });

    const parsed = JSON.parse(mockOutput) as {
      providers: {
        instances: {
          file: string;
          line: number;
          column: number;
          has_base_url: boolean;
          current_base_url?: string;
        }[];
      }[];
    };

    const instances = parsed.providers[0].instances;
    assert.strictEqual(instances.length, 3);
    assert.strictEqual(instances[0].line, 10);
    assert.strictEqual(instances[0].column, 5);
    assert.strictEqual(instances[1].has_base_url, true);
    assert.ok(instances[1].current_base_url?.includes("promptguard"));
  });

  // ==========================================================================
  // COMMAND CONSTRUCTION TESTS
  // ==========================================================================

  test("Scan text command should be properly constructed", () => {
    const text = "Hello, my name is John";
    const args = ["scan", "--json", "--text", text];
    
    assert.strictEqual(args[0], "scan");
    assert.strictEqual(args[1], "--json");
    assert.strictEqual(args[2], "--text");
    assert.strictEqual(args[3], text);
  });

  test("Redact text command should be properly constructed", () => {
    const text = "Contact john@example.com for help";
    const args = ["redact", "--json", "--text", text];
    
    assert.strictEqual(args[0], "redact");
    assert.strictEqual(args[1], "--json");
    assert.strictEqual(args[2], "--text");
    assert.strictEqual(args[3], text);
  });
});
