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
    this.scanWorkspace();

    // Run scan on file save (TypeScript, JavaScript, Python)
    const fileWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
      if (this.isSupportedLanguage(document.languageId)) {
        this.scanWorkspace();
      }
    });

    // Run scan when files are created/deleted
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.scanWorkspace();
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
    } catch (error: any) {
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

    const diagnostics: Map<string, vscode.Diagnostic[]> = new Map();

    for (const provider of scanResult.providers) {
      for (const filePath of provider.files) {
        const uri = vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders![0].uri,
          filePath
        );

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

        if (!diagnostics.has(uri.toString())) {
          diagnostics.set(uri.toString(), []);
        }
        diagnostics.get(uri.toString())!.push(diagnostic);
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
    this.disposables.forEach(d => d.dispose());
  }
}

