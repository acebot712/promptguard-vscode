import * as vscode from "vscode";
import { SUPPORTED_LANGUAGES } from "./utils";

export class PromptGuardCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "PromptGuard") {
        continue;
      }

      if (diagnostic.code === "llm-sdk-unprotected" || diagnostic.code === "llm-sdk-detected") {
        const applyAction = new vscode.CodeAction(
          "Apply PromptGuard protection",
          vscode.CodeActionKind.QuickFix,
        );
        applyAction.command = {
          command: "promptguard.apply",
          title: "Apply PromptGuard Protection",
        };
        applyAction.diagnostics = [diagnostic];
        applyAction.isPreferred = true;
        actions.push(applyAction);

        const initAction = new vscode.CodeAction(
          "Initialize PromptGuard in this project",
          vscode.CodeActionKind.QuickFix,
        );
        initAction.command = {
          command: "promptguard.init",
          title: "Initialize PromptGuard",
        };
        initAction.diagnostics = [diagnostic];
        actions.push(initAction);

        const scanAction = new vscode.CodeAction(
          "Scan file for security threats",
          vscode.CodeActionKind.QuickFix,
        );
        scanAction.command = {
          command: "promptguard.scanFile",
          title: "Scan File",
          arguments: [document.uri],
        };
        scanAction.diagnostics = [diagnostic];
        actions.push(scanAction);
      }
    }

    return actions;
  }
}

export function registerCodeActionProvider(context: vscode.ExtensionContext): void {
  const provider = new PromptGuardCodeActionProvider();

  for (const language of SUPPORTED_LANGUAGES) {
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider({ language }, provider, {
        providedCodeActionKinds: PromptGuardCodeActionProvider.providedCodeActionKinds,
      }),
    );
  }
}
