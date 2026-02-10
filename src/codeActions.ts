import * as vscode from "vscode";
import { CliWrapper } from "./cli";

/**
 * Provides code actions for PromptGuard diagnostics.
 * When the user sees an "llm-sdk-unprotected" diagnostic, they can click
 * the lightbulb to apply PromptGuard protection.
 */
export class PromptGuardCodeActionProvider implements vscode.CodeActionProvider {
  private cli: CliWrapper;
  private outputChannel: vscode.OutputChannel;

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  constructor(cli: CliWrapper, outputChannel: vscode.OutputChannel) {
    this.cli = cli;
    this.outputChannel = outputChannel;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Look for PromptGuard diagnostics that need action
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "PromptGuard") {
        continue;
      }

      // Only provide actions for unprotected SDK usage
      if (diagnostic.code === "llm-sdk-unprotected" || diagnostic.code === "llm-sdk-detected") {
        // Create "Apply PromptGuard Protection" action
        const applyAction = new vscode.CodeAction(
          "Apply PromptGuard protection",
          vscode.CodeActionKind.QuickFix
        );
        applyAction.command = {
          command: "promptguard.apply",
          title: "Apply PromptGuard Protection",
        };
        applyAction.diagnostics = [diagnostic];
        applyAction.isPreferred = true;
        actions.push(applyAction);

        // Create "Initialize PromptGuard" action if not yet initialized
        const initAction = new vscode.CodeAction(
          "Initialize PromptGuard in this project",
          vscode.CodeActionKind.QuickFix
        );
        initAction.command = {
          command: "promptguard.init",
          title: "Initialize PromptGuard",
        };
        initAction.diagnostics = [diagnostic];
        actions.push(initAction);

        // Create "Scan for Security Threats" action
        const scanAction = new vscode.CodeAction(
          "Scan file for security threats",
          vscode.CodeActionKind.QuickFix
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

/**
 * Register the code action provider for supported languages.
 */
export function registerCodeActionProvider(
  context: vscode.ExtensionContext,
  cli: CliWrapper,
  outputChannel: vscode.OutputChannel
): void {
  const provider = new PromptGuardCodeActionProvider(cli, outputChannel);

  const supportedLanguages = [
    { language: "typescript" },
    { language: "javascript" },
    { language: "typescriptreact" },
    { language: "javascriptreact" },
    { language: "python" },
  ];

  for (const selector of supportedLanguages) {
    const registration = vscode.languages.registerCodeActionsProvider(
      selector,
      provider,
      {
        providedCodeActionKinds: PromptGuardCodeActionProvider.providedCodeActionKinds,
      }
    );
    context.subscriptions.push(registration);
  }
}
