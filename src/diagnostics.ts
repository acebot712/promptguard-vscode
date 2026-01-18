import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { ScanResult } from "./types";

export class PromptGuardDiagnostics {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private cli: CliWrapper;
  private disposables: vscode.Disposable[] = [];

  constructor(cli: CliWrapper) {
    this.cli = cli;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("promptguard");
  }

  activate(context: vscode.ExtensionContext): void {
    // Run scan on workspace open
    void this.scanWorkspace();

    // Run scan on file save (TypeScript, JavaScript, Python)
    const fileWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
      if (this.isSupportedLanguage(document.languageId)) {
        void this.scanWorkspace();
      }
    });

    // Run scan when files are created/deleted
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void this.scanWorkspace();
    });

    this.disposables.push(fileWatcher, workspaceWatcher);
    context.subscriptions.push(...this.disposables);
  }

  private isSupportedLanguage(languageId: string): boolean {
    return ["typescript", "javascript", "python", "typescriptreact", "javascriptreact"].includes(languageId);
  }

  private async scanWorkspace(): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    try {
      const result = await this.cli.scan();
      this.updateDiagnostics(result);
    } catch {
      // Silently fail - CLI might not be installed or project not initialized
      // Don't spam user with errors
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
      for (const filePath of provider.files) {
        const uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

        // Create a diagnostic at the start of the file
        // In a real implementation, we'd parse the file to find exact locations
        // For MVP, we'll just show a warning at line 1
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 100),
          `${provider.name} SDK detected. Consider using PromptGuard for security.`,
          vscode.DiagnosticSeverity.Information
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

    // Set diagnostics for each file
    for (const [uriString, diags] of diagnostics.entries()) {
      const uri = vscode.Uri.parse(uriString);
      this.diagnosticCollection.set(uri, diags);
    }
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

