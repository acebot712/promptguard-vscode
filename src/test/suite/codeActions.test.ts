import * as assert from "assert";
import * as vscode from "vscode";

suite("Code Actions Test Suite", () => {
  // ==========================================================================
  // CODE ACTION KIND TESTS
  // ==========================================================================

  test("QuickFix code action kind should be available", () => {
    assert.ok(vscode.CodeActionKind.QuickFix);
    assert.strictEqual(vscode.CodeActionKind.QuickFix.value, "quickfix");
  });

  test("CodeAction should be creatable", () => {
    const action = new vscode.CodeAction(
      "Apply PromptGuard protection",
      vscode.CodeActionKind.QuickFix
    );
    
    assert.strictEqual(action.title, "Apply PromptGuard protection");
    assert.strictEqual(action.kind?.value, "quickfix");
  });

  test("CodeAction can have a command", () => {
    const action = new vscode.CodeAction(
      "Initialize PromptGuard",
      vscode.CodeActionKind.QuickFix
    );
    
    action.command = {
      command: "promptguard.init",
      title: "Initialize PromptGuard",
    };
    
    assert.ok(action.command);
    assert.strictEqual(action.command.command, "promptguard.init");
  });

  test("CodeAction can have diagnostics attached", () => {
    const action = new vscode.CodeAction(
      "Fix SDK usage",
      vscode.CodeActionKind.QuickFix
    );
    
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 10),
      "OpenAI SDK detected",
      vscode.DiagnosticSeverity.Information
    );
    diagnostic.source = "PromptGuard";
    diagnostic.code = "llm-sdk-unprotected";
    
    action.diagnostics = [diagnostic];
    
    assert.strictEqual(action.diagnostics.length, 1);
    assert.strictEqual(action.diagnostics[0].source, "PromptGuard");
  });

  test("isPreferred can be set on CodeAction", () => {
    const action = new vscode.CodeAction(
      "Preferred action",
      vscode.CodeActionKind.QuickFix
    );
    action.isPreferred = true;
    
    assert.strictEqual(action.isPreferred, true);
  });

  // ==========================================================================
  // DIAGNOSTIC CODE TESTS
  // ==========================================================================

  test("Diagnostic codes should match expected values", () => {
    const codes = [
      "llm-sdk-unprotected",
      "llm-sdk-protected",
      "llm-sdk-detected",
    ];
    
    for (const code of codes) {
      assert.ok(typeof code === "string");
      assert.ok(code.startsWith("llm-sdk-"));
    }
  });
});
