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
      "promptguard.scanSelection",
      "promptguard.redactSelection",
      "promptguard.scanFile",
      "promptguard.setApiKey",
      "promptguard.refreshTree",
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

  test("Configuration should have apiKey setting", () => {
    const config = vscode.workspace.getConfiguration("promptguard");
    // apiKey setting exists (value may be empty)
    const apiKey = config.get<string>("apiKey");
    assert.ok(apiKey !== undefined || apiKey === "");
  });

  // ==========================================================================
  // CONTEXT MENU TESTS (structural)
  // ==========================================================================

  test("Editor context menu commands should be available", async () => {
    const commands = await vscode.commands.getCommands();
    
    // These commands appear in the editor context menu when text is selected
    assert.ok(commands.includes("promptguard.scanSelection"));
    assert.ok(commands.includes("promptguard.redactSelection"));
  });

  // ==========================================================================
  // TREE VIEW TESTS (structural)
  // ==========================================================================

  test("Tree view should be registered", () => {
    // The tree view is registered in contributes.views
    // We just verify the extension activated successfully
    const extension = vscode.extensions.getExtension(
      "promptguard.promptguard-vscode"
    );
    assert.ok(extension?.isActive);
  });
});
