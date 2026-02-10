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

  // ==========================================================================
  // DIAGNOSTIC CODE TESTS
  // ==========================================================================

  test("Diagnostic code can be set to string", () => {
    const range = new vscode.Range(0, 0, 0, 10);
    const diagnostic = new vscode.Diagnostic(
      range,
      "Test message",
      vscode.DiagnosticSeverity.Warning
    );
    
    diagnostic.code = "llm-sdk-unprotected";
    assert.strictEqual(diagnostic.code, "llm-sdk-unprotected");
  });

  test("Diagnostic source can be set", () => {
    const range = new vscode.Range(0, 0, 0, 10);
    const diagnostic = new vscode.Diagnostic(
      range,
      "Test message",
      vscode.DiagnosticSeverity.Warning
    );
    
    diagnostic.source = "PromptGuard";
    assert.strictEqual(diagnostic.source, "PromptGuard");
  });

  // ==========================================================================
  // SDK INSTANCE DIAGNOSTICS TESTS
  // ==========================================================================

  test("Diagnostic can be created from SdkInstance data", () => {
    // Simulate data from CLI
    const instance = {
      file: "app.py",
      line: 15,
      column: 8,
      has_base_url: false,
    };
    
    // Create diagnostic with line/column info (0-indexed for VS Code)
    const startPos = new vscode.Position(instance.line - 1, instance.column - 1);
    const endPos = new vscode.Position(instance.line - 1, instance.column + 20);
    const range = new vscode.Range(startPos, endPos);
    
    const diagnostic = new vscode.Diagnostic(
      range,
      "Unprotected LLM SDK detected",
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.code = "llm-sdk-unprotected";
    diagnostic.source = "PromptGuard";
    
    assert.strictEqual(diagnostic.range.start.line, 14);
    assert.strictEqual(diagnostic.range.start.character, 7);
    assert.strictEqual(diagnostic.code, "llm-sdk-unprotected");
  });

  test("Protected SDK diagnostic uses Information severity", () => {
    const instance = {
      file: "app.py",
      line: 20,
      column: 4,
      has_base_url: true,
      current_base_url: "https://api.promptguard.co/api/v1",
    };
    
    const range = new vscode.Range(
      new vscode.Position(instance.line - 1, instance.column - 1),
      new vscode.Position(instance.line - 1, instance.column + 30)
    );
    
    const diagnostic = new vscode.Diagnostic(
      range,
      "Protected by PromptGuard",
      vscode.DiagnosticSeverity.Information
    );
    diagnostic.code = "llm-sdk-protected";
    
    assert.strictEqual(diagnostic.severity, vscode.DiagnosticSeverity.Information);
    assert.strictEqual(diagnostic.code, "llm-sdk-protected");
  });

  // ==========================================================================
  // MULTIPLE DIAGNOSTICS TESTS
  // ==========================================================================

  test("Multiple diagnostics can be set for a file", () => {
    const collection = vscode.languages.createDiagnosticCollection("promptguard-test");
    const uri = vscode.Uri.file("/test/multifile.py");
    
    const diagnostics = [
      new vscode.Diagnostic(
        new vscode.Range(5, 0, 5, 20),
        "First SDK instance",
        vscode.DiagnosticSeverity.Warning
      ),
      new vscode.Diagnostic(
        new vscode.Range(15, 0, 15, 25),
        "Second SDK instance",
        vscode.DiagnosticSeverity.Warning
      ),
      new vscode.Diagnostic(
        new vscode.Range(30, 4, 30, 40),
        "Third SDK instance",
        vscode.DiagnosticSeverity.Information
      ),
    ];
    
    collection.set(uri, diagnostics);
    
    const retrieved = collection.get(uri);
    assert.strictEqual(retrieved?.length, 3);
    
    collection.dispose();
  });

  test("Diagnostics can be cleared", () => {
    const collection = vscode.languages.createDiagnosticCollection("promptguard-test");
    const uri = vscode.Uri.file("/test/clearable.py");
    
    collection.set(uri, [
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 10),
        "Temporary",
        vscode.DiagnosticSeverity.Warning
      ),
    ]);
    
    assert.strictEqual(collection.get(uri)?.length, 1);
    
    collection.clear();
    
    // After clear, get returns undefined
    assert.ok(!collection.get(uri) || collection.get(uri)?.length === 0);
    
    collection.dispose();
  });
});
