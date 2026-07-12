import * as vscode from "vscode";
import { SUPPORTED_LANGUAGES } from "./utils";

export class PromptGuardCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  /**
   * Reports whether the project has an initialized PromptGuard config. This
   * gates which quick-fix is preferred: running `apply` before `init` fails,
   * so on a first run (not yet initialized) Initialize is the one-click
   * preferred action and Apply is offered but not preferred.
   */
  constructor(private readonly isInitialized: () => boolean) {}

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
        const initialized = this.isInitialized();

        const applyAction = new vscode.CodeAction(
          "Apply Protection",
          vscode.CodeActionKind.QuickFix,
        );
        applyAction.command = {
          command: "promptguard.apply",
          title: "Apply Protection",
        };
        applyAction.diagnostics = [diagnostic];
        // Apply is only preferred once the project is initialized — otherwise a
        // single click runs `apply`, which fails before `init` has been run.
        applyAction.isPreferred = initialized;

        const initAction = new vscode.CodeAction(
          "Initialize PromptGuard in this project",
          vscode.CodeActionKind.QuickFix,
        );
        initAction.command = {
          command: "promptguard.init",
          title: "Initialize PromptGuard",
        };
        initAction.diagnostics = [diagnostic];
        // Before initialization, Initialize is the one-click preferred fix.
        initAction.isPreferred = !initialized;

        // Order: preferred action first. Uninitialized → Initialize leads.
        if (initialized) {
          actions.push(applyAction, initAction);
        } else {
          actions.push(initAction, applyAction);
        }

        const scanAction = new vscode.CodeAction(
          "Scan File for Threats",
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

export function registerCodeActionProvider(
  context: vscode.ExtensionContext,
  isInitialized: () => boolean,
): void {
  const provider = new PromptGuardCodeActionProvider(isInitialized);

  for (const language of SUPPORTED_LANGUAGES) {
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider({ language }, provider, {
        providedCodeActionKinds: PromptGuardCodeActionProvider.providedCodeActionKinds,
      }),
    );
  }
}
