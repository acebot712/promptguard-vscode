import * as assert from "assert";
import * as vscode from "vscode";
import { PromptGuardCodeActionProvider } from "../../codeActions";

function unprotectedDiagnostic(): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 10),
    "openai SDK detected. Run 'PromptGuard: Apply Protection' to secure this call.",
    vscode.DiagnosticSeverity.Warning,
  );
  diagnostic.source = "PromptGuard";
  diagnostic.code = "llm-sdk-unprotected";
  return diagnostic;
}

function runProvider(isInitialized: boolean): vscode.CodeAction[] {
  const provider = new PromptGuardCodeActionProvider(() => isInitialized);
  const document = { uri: vscode.Uri.file("/workspace/app.ts") } as vscode.TextDocument;
  const context = {
    diagnostics: [unprotectedDiagnostic()],
    triggerKind: vscode.CodeActionTriggerKind.Automatic,
    only: undefined,
  } as vscode.CodeActionContext;
  return provider.provideCodeActions(
    document,
    new vscode.Range(0, 0, 0, 10),
    context,
    new vscode.CancellationTokenSource().token,
  );
}

suite("Code Actions Test Suite", () => {
  // ==========================================================================
  // CODE ACTION KIND TESTS
  // ==========================================================================

  test("QuickFix code action kind should be available", () => {
    assert.ok(vscode.CodeActionKind.QuickFix);
    assert.strictEqual(vscode.CodeActionKind.QuickFix.value, "quickfix");
  });

  test("CodeAction should be creatable", () => {
    const action = new vscode.CodeAction("Apply Protection", vscode.CodeActionKind.QuickFix);

    assert.strictEqual(action.title, "Apply Protection");
    assert.strictEqual(action.kind?.value, "quickfix");
  });

  test("CodeAction can have a command", () => {
    const action = new vscode.CodeAction("Initialize PromptGuard", vscode.CodeActionKind.QuickFix);

    action.command = {
      command: "promptguard.init",
      title: "Initialize PromptGuard",
    };

    assert.ok(action.command);
    assert.strictEqual(action.command.command, "promptguard.init");
  });

  test("CodeAction can have diagnostics attached", () => {
    const action = new vscode.CodeAction("Fix SDK usage", vscode.CodeActionKind.QuickFix);

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 10),
      "OpenAI SDK detected",
      vscode.DiagnosticSeverity.Information,
    );
    diagnostic.source = "PromptGuard";
    diagnostic.code = "llm-sdk-unprotected";

    action.diagnostics = [diagnostic];

    assert.strictEqual(action.diagnostics.length, 1);
    assert.strictEqual(action.diagnostics[0].source, "PromptGuard");
  });

  test("isPreferred can be set on CodeAction", () => {
    const action = new vscode.CodeAction("Preferred action", vscode.CodeActionKind.QuickFix);
    action.isPreferred = true;

    assert.strictEqual(action.isPreferred, true);
  });

  // ==========================================================================
  // DIAGNOSTIC CODE TESTS
  // ==========================================================================

  test("Diagnostic codes should match expected values", () => {
    const codes = ["llm-sdk-unprotected", "llm-sdk-protected", "llm-sdk-detected"];

    for (const code of codes) {
      assert.ok(typeof code === "string");
      assert.ok(code.startsWith("llm-sdk-"));
    }
  });

  // ==========================================================================
  // PROVIDER BEHAVIOR TESTS (init-state gating, unified titles)
  // ==========================================================================

  test("provider offers Apply Protection, Initialize, and Scan quick-fixes", () => {
    const actions = runProvider(true);
    const titles = actions.map((a) => a.title);
    assert.deepStrictEqual(titles, [
      "Apply Protection",
      "Initialize PromptGuard in this project",
      "Scan file for security threats",
    ]);
  });

  test("Apply command retains its stable ID", () => {
    const apply = runProvider(true).find((a) => a.title === "Apply Protection");
    assert.ok(apply?.command);
    assert.strictEqual(apply.command.command, "promptguard.apply");
  });

  test("when initialized, Apply Protection is the preferred one-click fix", () => {
    const actions = runProvider(true);
    const apply = actions.find((a) => a.title === "Apply Protection");
    const init = actions.find((a) => a.title === "Initialize PromptGuard in this project");
    assert.strictEqual(apply?.isPreferred, true);
    assert.strictEqual(init?.isPreferred, false);
    // Preferred action is offered first.
    assert.strictEqual(actions[0].title, "Apply Protection");
  });

  test("when NOT initialized, Initialize is preferred and leads (no first-run apply trap)", () => {
    const actions = runProvider(false);
    const apply = actions.find((a) => a.title === "Apply Protection");
    const init = actions.find((a) => a.title === "Initialize PromptGuard in this project");
    assert.strictEqual(init?.isPreferred, true);
    assert.strictEqual(apply?.isPreferred, false);
    // Initialize leads so a single click never runs apply before init.
    assert.strictEqual(actions[0].title, "Initialize PromptGuard in this project");
  });

  test("provider ignores non-PromptGuard diagnostics", () => {
    const provider = new PromptGuardCodeActionProvider(() => true);
    const foreign = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 1),
      "eslint problem",
      vscode.DiagnosticSeverity.Warning,
    );
    foreign.source = "eslint";
    const context = {
      diagnostics: [foreign],
      triggerKind: vscode.CodeActionTriggerKind.Automatic,
      only: undefined,
    } as vscode.CodeActionContext;
    const actions = provider.provideCodeActions(
      { uri: vscode.Uri.file("/x.ts") } as vscode.TextDocument,
      new vscode.Range(0, 0, 0, 1),
      context,
      new vscode.CancellationTokenSource().token,
    );
    assert.strictEqual(actions.length, 0);
  });
});
