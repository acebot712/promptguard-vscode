import * as assert from "assert";
import {
  CliExecutionError,
  ScanResult,
  ProviderResult,
  SdkInstance,
  ThreatDetectionResult,
  RedactResult,
  RedactedEntity,
} from "../../types";

suite("Types Test Suite", () => {
  // ==========================================================================
  // SCAN RESULT TESTS
  // ==========================================================================

  test("ScanResult should have correct structure", () => {
    const result: ScanResult = {
      total_files_scanned: 100,
      files_with_sdks: 5,
      total_instances: 10,
      providers: [],
    };

    assert.strictEqual(result.total_files_scanned, 100);
    assert.strictEqual(result.files_with_sdks, 5);
    assert.strictEqual(result.total_instances, 10);
    assert.ok(Array.isArray(result.providers));
  });

  test("ProviderResult should have instances array", () => {
    const provider: ProviderResult = {
      name: "openai",
      file_count: 3,
      instance_count: 5,
      files: ["app.py", "main.py"],
      instances: [
        {
          file: "app.py",
          line: 10,
          column: 5,
          has_base_url: false,
        },
      ],
    };

    assert.strictEqual(provider.name, "openai");
    assert.ok(provider.instances);
    assert.strictEqual(provider.instances.length, 1);
    assert.strictEqual(provider.instances[0].line, 10);
  });

  test("SdkInstance should have location info", () => {
    const instance: SdkInstance = {
      file: "src/api.ts",
      line: 25,
      column: 12,
      has_base_url: true,
      current_base_url: "https://api.promptguard.co/api/v1",
    };

    assert.strictEqual(instance.file, "src/api.ts");
    assert.strictEqual(instance.line, 25);
    assert.strictEqual(instance.column, 12);
    assert.strictEqual(instance.has_base_url, true);
  });

  // ==========================================================================
  // SECURITY SCAN RESULT TESTS
  // ==========================================================================

  test("ThreatDetectionResult should have decision and confidence", () => {
    const result: ThreatDetectionResult = {
      decision: "block",
      confidence: 0.95,
      threat_type: "prompt_injection",
      reason: "Detected prompt injection attempt",
    };

    assert.strictEqual(result.decision, "block");
    assert.strictEqual(result.confidence, 0.95);
    assert.strictEqual(result.threat_type, "prompt_injection");
  });

  test("ThreatDetectionResult allow decision", () => {
    const result: ThreatDetectionResult = {
      decision: "allow",
      confidence: 0.98,
    };

    assert.strictEqual(result.decision, "allow");
    assert.ok(result.threat_type === undefined);
  });

  // ==========================================================================
  // REDACT RESULT TESTS
  // ==========================================================================

  test("RedactResult should have redacted text", () => {
    const result: RedactResult = {
      redacted_text: "Contact [NAME] at [EMAIL]",
      entities_found: [
        { type: "NAME", original: "John", replacement: "[NAME]" },
        { type: "EMAIL", original: "john@example.com", replacement: "[EMAIL]" },
      ],
      entity_count: 2,
    };

    assert.strictEqual(result.entity_count, 2);
    assert.ok(result.redacted_text.includes("[NAME]"));
    assert.ok(result.redacted_text.includes("[EMAIL]"));
  });

  test("RedactedEntity should have type and replacement", () => {
    const entity: RedactedEntity = {
      type: "PHONE",
      original: "555-123-4567",
      replacement: "[PHONE]",
      start: 10,
      end: 22,
    };

    assert.strictEqual(entity.type, "PHONE");
    assert.strictEqual(entity.original, "555-123-4567");
    assert.ok(entity.start !== undefined);
    assert.ok(entity.end !== undefined);
  });

  // ==========================================================================
  // ERROR TYPES TESTS
  // ==========================================================================

  test("CliExecutionError should extend Error", () => {
    const error = new CliExecutionError("Command failed", 1, "error output", "");

    assert.ok(error instanceof Error);
    assert.strictEqual(error.name, "CliExecutionError");
    assert.strictEqual(error.code, 1);
    assert.strictEqual(error.stderr, "error output");
  });
});
