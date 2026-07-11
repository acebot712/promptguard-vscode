import * as assert from "assert";
import * as os from "os";
import { getAssetName, parseSha256File } from "../../cliInstaller";

suite("CLI Installer Test Suite", () => {
  // ==========================================================================
  // ASSET NAME MAPPING (real implementation)
  // ==========================================================================

  test("macOS asset names", () => {
    assert.strictEqual(getAssetName("darwin", "arm64"), "promptguard-macos-arm64");
    assert.strictEqual(getAssetName("darwin", "x64"), "promptguard-macos-x86_64");
  });

  test("Linux asset names", () => {
    assert.strictEqual(getAssetName("linux", "x64"), "promptguard-linux-x86_64");
    assert.strictEqual(getAssetName("linux", "arm64"), "promptguard-linux-arm64");
  });

  test("Windows asset name", () => {
    assert.strictEqual(getAssetName("win32", "x64"), "promptguard-windows-x86_64.exe");
  });

  test("Unsupported platform/arch returns null", () => {
    assert.strictEqual(getAssetName("freebsd", "x64"), null);
    assert.strictEqual(getAssetName("darwin", "ia32"), null);
    assert.strictEqual(getAssetName("linux", "ia32"), null);
  });

  test("Defaults to the current platform", () => {
    // On any platform we run tests on, the default invocation must agree
    // with an explicit invocation for the same platform/arch.
    assert.strictEqual(getAssetName(), getAssetName(os.platform(), os.arch()));
  });

  // ==========================================================================
  // SHA256 CHECKSUM FILE PARSING (real implementation)
  // ==========================================================================

  const HASH = "a".repeat(64);

  test("Parses sha256sum-style checksum line", () => {
    const content = `${HASH}  promptguard-linux-x86_64\n`;
    assert.strictEqual(parseSha256File(content, "promptguard-linux-x86_64"), HASH);
  });

  test("Parses checksum line with path prefix", () => {
    const content = `${HASH}  ./dist/promptguard-macos-arm64\n`;
    assert.strictEqual(parseSha256File(content, "promptguard-macos-arm64"), HASH);
  });

  test("Parses binary-mode marker (asterisk)", () => {
    const content = `${HASH} *promptguard-windows-x86_64.exe\n`;
    assert.strictEqual(parseSha256File(content, "promptguard-windows-x86_64.exe"), HASH);
  });

  test("Normalizes digest to lowercase", () => {
    const content = `${"A".repeat(64)}  promptguard-linux-x86_64\n`;
    assert.strictEqual(parseSha256File(content, "promptguard-linux-x86_64"), HASH);
  });

  test("Returns null when the asset is not listed", () => {
    const content = `${HASH}  some-other-file\n`;
    assert.strictEqual(parseSha256File(content, "promptguard-linux-x86_64"), null);
  });

  test("Returns null for malformed digests", () => {
    assert.strictEqual(
      parseSha256File("not-a-hash  promptguard-linux-x86_64\n", "promptguard-linux-x86_64"),
      null,
    );
    assert.strictEqual(parseSha256File("", "promptguard-linux-x86_64"), null);
    // Truncated digest
    assert.strictEqual(
      parseSha256File(`${"a".repeat(63)}  promptguard-linux-x86_64\n`, "promptguard-linux-x86_64"),
      null,
    );
  });

  test("Finds the right entry in a multi-line checksum file", () => {
    const otherHash = "b".repeat(64);
    const content = `${otherHash}  promptguard-linux-arm64\n${HASH}  promptguard-linux-x86_64\n`;
    assert.strictEqual(parseSha256File(content, "promptguard-linux-x86_64"), HASH);
    assert.strictEqual(parseSha256File(content, "promptguard-linux-arm64"), otherHash);
  });
});
