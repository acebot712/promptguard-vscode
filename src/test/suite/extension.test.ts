import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  // ==========================================================================
  // EXTENSION ACTIVATION TESTS
  // ==========================================================================

  test("Extension should be present", () => {
    assert.ok(
      vscode.extensions.getExtension("promptguard.promptguard-vscode")
    );
  });

  test("Extension should activate", async () => {
    const extension = vscode.extensions.getExtension(
      "promptguard.promptguard-vscode"
    );
    if (extension) {
      await extension.activate();
      assert.strictEqual(extension.isActive, true);
    }
  });

  // ==========================================================================
  // COMMAND REGISTRATION TESTS
  // ==========================================================================

  test("All commands should be registered", async () => {
    const commands = await vscode.commands.getCommands();
    const expectedCommands = [
      "promptguard.init",
      "promptguard.scan",
      "promptguard.status",
      "promptguard.apply",
      "promptguard.disable",
      "promptguard.enable",
    ];

    for (const cmd of expectedCommands) {
      assert.ok(
        commands.includes(cmd),
        `Command ${cmd} should be registered`
      );
    }
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  test("Configuration should have cliPath setting", () => {
    const config = vscode.workspace.getConfiguration("promptguard");
    const cliPath = config.get<string>("cliPath");
    assert.strictEqual(typeof cliPath, "string");
  });
});
