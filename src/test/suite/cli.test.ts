import * as assert from "assert";
import { firstLine, redactCliArgs, sanitizeCliOutputLine } from "../../cli";
import { isQuotaError } from "../../utils";
import { CliExecutionError } from "../../types";

// Build fake pg_live_ keys from parts so the source contains no contiguous
// secret-shaped literal (avoids secret-scanner false positives); the runtime
// value is a normal key string for these redaction tests.
const fakeKey = (suffix: string): string => ["pg", "live", suffix].join("_");

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
    const args = ["init", "--api-key", fakeKey("supersecret"), "--auto"];
    assert.deepStrictEqual(redactCliArgs(args), ["init", "--api-key", "***REDACTED***", "--auto"]);
  });

  test("redactCliArgs redacts --api-key=<value>", () => {
    const args = ["init", `--api-key=${fakeKey("supersecret")}`];
    assert.deepStrictEqual(redactCliArgs(args), ["init", "--api-key=***REDACTED***"]);
  });

  test("redactCliArgs leaves non-sensitive args untouched", () => {
    const args = ["scan", "--json", "--provider", "openai"];
    assert.deepStrictEqual(redactCliArgs(args), args);
  });

  test("redactCliArgs never leaks the secret value", () => {
    const secret = fakeKey("supersecret");
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

  // ==========================================================================
  // STDERR SANITIZATION (user-facing error toasts include a cause line but
  // must never leak API-key-shaped tokens)
  // ==========================================================================

  test("sanitizeCliOutputLine keeps only the first line", () => {
    assert.strictEqual(
      sanitizeCliOutputLine("Error: request failed\nstack line 1\nstack line 2"),
      "Error: request failed",
    );
  });

  test("sanitizeCliOutputLine redacts pg_ key-shaped tokens", () => {
    const secret = fakeKey("supersecret1234");
    const line = sanitizeCliOutputLine(`Error: key ${secret} was rejected`);
    assert.ok(!line.includes(secret));
    assert.ok(line.includes("***REDACTED***"));
  });

  test("sanitizeCliOutputLine redacts values passed to --api-key", () => {
    // Split so the source carries no `--api-key`-adjacent value literal (which
    // trips secret scanners' CLI-option detector); the runtime input is still
    // exactly `--api-key=" + "oddformat`.
    const line = sanitizeCliOutputLine("invalid value for --api-key=" + "oddformat");
    assert.ok(!line.includes("oddformat"));
    assert.ok(line.includes("--api-key=***REDACTED***"));
  });

  test("sanitizeCliOutputLine leaves ordinary errors untouched", () => {
    assert.strictEqual(
      sanitizeCliOutputLine("Error: Failed to read file 'x.txt'"),
      "Error: Failed to read file 'x.txt'",
    );
  });

  // ==========================================================================
  // QUOTA ERROR DETECTION (regression: the CLI reports quota errors on
  // stderr; matching only error.message never fired the upgrade prompt)
  // ==========================================================================

  test("isQuotaError matches quota text in CliExecutionError.stderr", () => {
    const error = new CliExecutionError(
      "Command failed: promptguard scan --json",
      1,
      "Error: API error 429: quota exceeded for plan 'free'",
      "",
    );
    assert.strictEqual(isQuotaError(error), true);
  });

  test("isQuotaError matches quota_exceeded in the message", () => {
    assert.strictEqual(isQuotaError(new Error("api returned QUOTA_EXCEEDED")), true);
  });

  test("isQuotaError is false for unrelated errors", () => {
    assert.strictEqual(isQuotaError(new CliExecutionError("boom", 1, "Error: timeout", "")), false);
    assert.strictEqual(isQuotaError(new Error("connection refused")), false);
  });
});
