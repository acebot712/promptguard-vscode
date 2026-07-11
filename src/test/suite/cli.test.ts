import * as assert from "assert";
import { firstLine, redactCliArgs } from "../../cli";
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
  // SENSITIVE ARGV REDACTION (regression: API key leaked into error messages)
  // ==========================================================================

  test("redactCliArgs redacts --api-key <value>", () => {
    const args = ["init", "--api-key", "REDACTED_TEST_FIXTURE", "--auto"];
    assert.deepStrictEqual(redactCliArgs(args), ["init", "--api-key", "***REDACTED***", "--auto"]);
  });

  test("redactCliArgs redacts --api-key=<value>", () => {
    const args = ["init", "--api-key=REDACTED_TEST_FIXTURE"];
    assert.deepStrictEqual(redactCliArgs(args), ["init", "--api-key=***REDACTED***"]);
  });

  test("redactCliArgs leaves non-sensitive args untouched", () => {
    const args = ["scan", "--json", "--provider", "openai"];
    assert.deepStrictEqual(redactCliArgs(args), args);
  });

  test("redactCliArgs never leaks the secret value", () => {
    const secret = "REDACTED_TEST_FIXTURE";
    const rendered = redactCliArgs(["init", "--api-key", secret]).join(" ");
    assert.ok(!rendered.includes(secret));
  });

  test("redactCliArgs handles trailing --api-key with no value", () => {
    assert.deepStrictEqual(redactCliArgs(["init", "--api-key"]), ["init", "--api-key"]);
  });

  // ==========================================================================
  // WHICH/WHERE OUTPUT PARSING (regression: Windows `where` prints multiple
  // lines; keeping interior newlines produced an invalid binary path)
  // ==========================================================================

  test("firstLine takes only the first line of multi-line output", () => {
    assert.strictEqual(
      firstLine("C:\\bin\\promptguard.exe\r\nC:\\other\\promptguard.exe\r\n"),
      "C:\\bin\\promptguard.exe",
    );
    assert.strictEqual(firstLine("/usr/local/bin/promptguard\n"), "/usr/local/bin/promptguard");
  });

  test("firstLine trims whitespace", () => {
    assert.strictEqual(firstLine("  /usr/local/bin/promptguard  \n"), "/usr/local/bin/promptguard");
  });

  test("firstLine of single-line output is the trimmed line", () => {
    assert.strictEqual(firstLine("/usr/local/bin/promptguard"), "/usr/local/bin/promptguard");
  });
});
