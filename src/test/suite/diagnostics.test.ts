import * as assert from "assert";
import * as vscode from "vscode";

suite("Diagnostics Test Suite", () => {
  // ==========================================================================
  // DIAGNOSTIC COLLECTION TESTS
  // ==========================================================================

  test("Diagnostic collection should be creatable", () => {
    const collection = vscode.languages.createDiagnosticCollection("promptguard-test");
    assert.ok(collection);
    assert.strictEqual(collection.name, "promptguard-test");
    collection.dispose();
  });

  test("Diagnostics can be added to collection", () => {
    const collection = vscode.languages.createDiagnosticCollection("promptguard-test");
    
    const uri = vscode.Uri.file("/test/file.py");
    const range = new vscode.Range(0, 0, 0, 10);
    const diagnostic = new vscode.Diagnostic(
      range,
      "Test diagnostic message",
      vscode.DiagnosticSeverity.Warning
    );

    collection.set(uri, [diagnostic]);
    
    const diagnostics = collection.get(uri);
    assert.ok(diagnostics);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].message, "Test diagnostic message");
    
    collection.dispose();
  });

  // ==========================================================================
  // SEVERITY TESTS
  // ==========================================================================

  test("Diagnostic severities should be available", () => {
    assert.ok(vscode.DiagnosticSeverity.Error !== undefined);
    assert.ok(vscode.DiagnosticSeverity.Warning !== undefined);
    assert.ok(vscode.DiagnosticSeverity.Information !== undefined);
    assert.ok(vscode.DiagnosticSeverity.Hint !== undefined);
  });

  // ==========================================================================
  // RANGE TESTS
  // ==========================================================================

  test("Range should be creatable with line and character", () => {
    const range = new vscode.Range(
      new vscode.Position(5, 0),
      new vscode.Position(5, 20)
    );
    
    assert.strictEqual(range.start.line, 5);
    assert.strictEqual(range.start.character, 0);
    assert.strictEqual(range.end.line, 5);
    assert.strictEqual(range.end.character, 20);
  });
});
