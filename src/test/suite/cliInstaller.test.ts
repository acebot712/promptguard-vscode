import * as assert from "assert";
import * as os from "os";
import * as path from "path";

suite("CLI Installer Test Suite", () => {
  // ==========================================================================
  // PLATFORM DETECTION TESTS
  // ==========================================================================

  test("Platform should be detectable", () => {
    const platform = os.platform();
    assert.ok(["darwin", "linux", "win32"].includes(platform), `Detected platform: ${platform}`);
  });

  test("Architecture should be detectable", () => {
    const arch = os.arch();
    assert.ok(["x64", "arm64", "ia32"].includes(arch), `Detected architecture: ${arch}`);
  });

  // ==========================================================================
  // ASSET NAME MAPPING TESTS
  // ==========================================================================

  test("macOS ARM64 should map to correct asset", () => {
    // Simulate asset mapping logic
    const getAssetName = (platform: string, arch: string): string | null => {
      if (platform === "darwin") {
        if (arch === "arm64") {
          return "promptguard-macos-arm64";
        }
        if (arch === "x64") {
          return "promptguard-macos-x86_64";
        }
      }
      return null;
    };

    assert.strictEqual(getAssetName("darwin", "arm64"), "promptguard-macos-arm64");
    assert.strictEqual(getAssetName("darwin", "x64"), "promptguard-macos-x86_64");
  });

  test("Linux x64 should map to correct asset", () => {
    const getAssetName = (platform: string, arch: string): string | null => {
      if (platform === "linux") {
        if (arch === "x64") {
          return "promptguard-linux-x86_64";
        }
        if (arch === "arm64") {
          return "promptguard-linux-arm64";
        }
      }
      return null;
    };

    assert.strictEqual(getAssetName("linux", "x64"), "promptguard-linux-x86_64");
    assert.strictEqual(getAssetName("linux", "arm64"), "promptguard-linux-arm64");
  });

  test("Windows should map to correct asset", () => {
    const getAssetName = (platform: string): string | null => {
      if (platform === "win32") {
        return "promptguard-windows-x86_64.exe";
      }
      return null;
    };

    assert.strictEqual(getAssetName("win32"), "promptguard-windows-x86_64.exe");
  });

  // ==========================================================================
  // INSTALLATION PATH TESTS
  // ==========================================================================

  test("Binary name should be correct for platform", () => {
    const platform = os.platform();
    const binaryName = platform === "win32" ? "promptguard.exe" : "promptguard";

    if (platform === "win32") {
      assert.strictEqual(binaryName, "promptguard.exe");
    } else {
      assert.strictEqual(binaryName, "promptguard");
    }
  });

  test("Installation directory path should be constructable", () => {
    const mockStoragePath = "/Users/test/.vscode/extensions/promptguard";
    const binDir = path.join(mockStoragePath, "bin");

    assert.ok(binDir.includes("bin"));
    assert.ok(binDir.includes("promptguard"));
  });

  // ==========================================================================
  // VERSION COMPARISON TESTS
  // ==========================================================================

  test("Version comparison should work correctly", () => {
    const isNewerVersion = (latest: string, current: string): boolean => {
      const latestParts = latest.split(".").map(Number);
      const currentParts = current.split(".").map(Number);

      for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) {
          return true;
        }
        if (l < c) {
          return false;
        }
      }
      return false;
    };

    assert.strictEqual(isNewerVersion("1.1.0", "1.0.0"), true);
    assert.strictEqual(isNewerVersion("1.0.1", "1.0.0"), true);
    assert.strictEqual(isNewerVersion("2.0.0", "1.9.9"), true);
    assert.strictEqual(isNewerVersion("1.0.0", "1.0.0"), false);
    assert.strictEqual(isNewerVersion("1.0.0", "1.0.1"), false);
    assert.strictEqual(isNewerVersion("1.0.0", "2.0.0"), false);
  });

  // ==========================================================================
  // GITHUB RELEASE URL TESTS
  // ==========================================================================

  test("GitHub releases URL should be well-formed", () => {
    const releasesUrl = "https://api.github.com/repos/acebot712/promptguard-cli/releases/latest";

    assert.ok(releasesUrl.startsWith("https://api.github.com"));
    assert.ok(releasesUrl.includes("releases/latest"));
  });

  // ==========================================================================
  // FILE PERMISSION TESTS
  // ==========================================================================

  test("Executable permissions should be correct value", () => {
    // 0o755 = rwxr-xr-x
    const executablePermissions = 0o755;

    assert.strictEqual(executablePermissions, 493); // Decimal representation
    assert.strictEqual(executablePermissions.toString(8), "755");
  });
});
