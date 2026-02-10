import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { ScanResult } from "./types";

export class PromptGuardDiagnostics {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private cli: CliWrapper;
  private disposables: vscode.Disposable[] = [];
  private lastScanResult: ScanResult | null = null;

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
      this.lastScanResult = result;
      this.updateDiagnostics(result);
    } catch {
      // Silently fail - CLI might not be installed or project not initialized
      // Don't spam user with errors
      this.diagnosticCollection.clear();
    }
  }

  /**
   * Get the last scan result for use by other components (e.g., CodeActionProvider)
   */
  getLastScanResult(): ScanResult | null {
    return this.lastScanResult;
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
      // Use detailed instance information if available (new CLI format)
      if (provider.instances && provider.instances.length > 0) {
        for (const instance of provider.instances) {
          const uri = vscode.Uri.joinPath(workspaceFolder.uri, instance.file);
          
          // Use exact line/column from CLI's AST analysis
          // CLI uses 1-based indexing, VS Code uses 0-based
          const line = Math.max(0, instance.line - 1);
          const column = Math.max(0, instance.column - 1);
          
          // Create a range that highlights the SDK constructor call
          // We'll highlight from the column to the end of the line (approximate)
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
        // Fallback to old behavior if instances not available (older CLI)
        for (const filePath of provider.files) {
          const uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

          // Create a diagnostic at the start of the file (fallback)
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

