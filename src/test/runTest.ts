import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Open a throwaway workspace folder so tests that depend on
    // vscode.workspace.workspaceFolders (diagnostics, tree view) can run.
    const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "pg-ws-"));

    // Keep user-data-dir short: VS Code creates a Unix domain socket inside
    // it, and socket paths longer than ~103 chars fail with EINVAL on macOS.
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pg-ud-"));

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspace, "--user-data-dir", userDataDir],
    });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

void main();
