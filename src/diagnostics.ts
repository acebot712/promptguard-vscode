import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { ScanResult } from "./types";
import { SUPPORTED_LANGUAGES } from "./utils";

export class PromptGuardDiagnostics {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private cli: CliWrapper;
  private disposables: vscode.Disposable[] = [];

  constructor(cli: CliWrapper) {
    this.cli = cli;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("promptguard");
  }

  activate(context: vscode.ExtensionContext): void {
    void this.scanWorkspace();

    const fileWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
      if (SUPPORTED_LANGUAGES.includes(document.languageId)) {
        void this.scanWorkspace();
      }
    });

    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void this.scanWorkspace();
    });

    this.disposables.push(fileWatcher, workspaceWatcher);
    context.subscriptions.push(...this.disposables);
  }

  private async scanWorkspace(): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    try {
      const result = await this.cli.scan();
      this.updateDiagnostics(result);
    } catch {
      this.diagnosticCollection.clear();
    }
  }

  private updateDiagnostics(scanResult: ScanResult): void {
    this.diagnosticCollection.clear();

    if (scanResult.providers.length === 0) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const diagnostics: Map<string, vscode.Diagnostic[]> = new Map();

    for (const provider of scanResult.providers) {
      if (provider.instances && provider.instances.length > 0) {
        for (const instance of provider.instances) {
          const uri = vscode.Uri.joinPath(workspaceFolder.uri, instance.file);
          const line = Math.max(0, instance.line - 1);
          const column = Math.max(0, instance.column - 1);
          const range = new vscode.Range(line, column, line, column + 50);

          const hasProtection = instance.has_base_url;
          const message = hasProtection
            ? `${provider.name} SDK is already protected by PromptGuard.`
            : `${provider.name} SDK detected. Run 'PromptGuard: Apply Transformations' to add security.`;

          const severity = hasProtection
            ? vscode.DiagnosticSeverity.Hint
            : vscode.DiagnosticSeverity.Information;

          const diagnostic = new vscode.Diagnostic(range, message, severity);
          diagnostic.source = "PromptGuard";
          diagnostic.code = hasProtection ? "llm-sdk-protected" : "llm-sdk-unprotected";

          const uriString = uri.toString();
          const existing = diagnostics.get(uriString);
          if (existing) {
            existing.push(diagnostic);
          } else {
            diagnostics.set(uriString, [diagnostic]);
          }
        }
      } else {
        for (const filePath of provider.files) {
          const uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 100),
            `${provider.name} SDK detected. Consider using PromptGuard for security.`,
            vscode.DiagnosticSeverity.Information,
          );
          diagnostic.source = "PromptGuard";
          diagnostic.code = "llm-sdk-detected";

          const uriString = uri.toString();
          const existing = diagnostics.get(uriString);
          if (existing) {
            existing.push(diagnostic);
          } else {
            diagnostics.set(uriString, [diagnostic]);
          }
        }
      }
    }

    for (const [uriString, diags] of diagnostics.entries()) {
      this.diagnosticCollection.set(vscode.Uri.parse(uriString), diags);
    }
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
