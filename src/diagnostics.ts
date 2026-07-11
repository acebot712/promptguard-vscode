import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { resolveManagedFileUri } from "./treeView";
import { ScanResult } from "./types";
import { SUPPORTED_LANGUAGES } from "./utils";

const SCAN_DEBOUNCE_MS = 500;

export class PromptGuardDiagnostics {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private cli: CliWrapper;
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: NodeJS.Timeout | undefined;
  /**
   * Monotonic scan generation. Each scan captures the counter at start and
   * discards its results if another scan started afterwards, so a slow older
   * scan can never overwrite the results of a newer one.
   */
  private scanGeneration = 0;

  constructor(cli: CliWrapper) {
    this.cli = cli;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("promptguard");
  }

  private isScanOnSaveEnabled(): boolean {
    return vscode.workspace.getConfiguration("promptguard").get<boolean>("scanOnSave", true);
  }

  /** Debounced workspace scan to avoid re-running a full scan on every keystroke-triggered save. */
  private scheduleScan(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.scanAllWorkspaceFolders();
    }, SCAN_DEBOUNCE_MS);
  }

  activate(context: vscode.ExtensionContext): void {
    // NOTE: no initial scan here — extension.ts triggers the first scan after
    // CLI resolution/installation completes, so the two never race.
    const fileWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
      if (!this.isScanOnSaveEnabled()) {
        return;
      }
      // The CLI's SDK detection scans the whole workspace (no single-file mode),
      // so we debounce to coalesce rapid saves into one scan.
      if (SUPPORTED_LANGUAGES.includes(document.languageId)) {
        this.scheduleScan();
      }
    });

    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void this.scanAllWorkspaceFolders();
    });

    this.disposables.push(fileWatcher, workspaceWatcher);
    context.subscriptions.push(...this.disposables);
  }

  /**
   * Scan every workspace folder and replace diagnostics with the combined
   * results. On any scan error the previous (last-good) diagnostics are kept
   * rather than wiped, so a transient CLI failure doesn't blank the Problems
   * panel.
   */
  async scanAllWorkspaceFolders(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return;
    }

    const generation = ++this.scanGeneration;
    const results: { folder: vscode.WorkspaceFolder; result: ScanResult }[] = [];

    for (const folder of folders) {
      try {
        const result = await this.cli.scan(folder.uri.fsPath);
        results.push({ folder, result });
      } catch {
        // Transient error (CLI missing, timeout, ...): keep last-good diagnostics.
        return;
      }
    }

    if (generation !== this.scanGeneration) {
      // A newer scan started while we were running; discard these stale results.
      return;
    }

    this.diagnosticCollection.clear();
    for (const { folder, result } of results) {
      this.applyScanResult(result, folder.uri);
    }
  }

  /**
   * Translate one folder's scan result into diagnostics (additive: does not
   * clear other folders' entries). Public so unit tests can exercise the
   * mapping against a stubbed scan result.
   */
  applyScanResult(scanResult: ScanResult, folderUri: vscode.Uri): void {
    if (scanResult.providers.length === 0) {
      return;
    }

    const diagnostics: Map<string, vscode.Diagnostic[]> = new Map();

    const addDiagnostic = (filePath: string, diagnostic: vscode.Diagnostic) => {
      // Reuse the tree view's resolver: CLI paths are usually relative to the
      // scanned folder, but absolute paths must not be joinPath'd onto it.
      const uri = resolveManagedFileUri(filePath, folderUri);
      const uriString = uri.toString();
      const existing = diagnostics.get(uriString);
      if (existing) {
        existing.push(diagnostic);
      } else {
        diagnostics.set(uriString, [diagnostic]);
      }
    };

    for (const provider of scanResult.providers) {
      if (provider.instances && provider.instances.length > 0) {
        for (const instance of provider.instances) {
          const line = Math.max(0, instance.line - 1);
          const column = Math.max(0, instance.column - 1);
          const range = new vscode.Range(line, column, line, column + 50);

          const hasProtection = instance.has_base_url;
          const message = hasProtection
            ? `${provider.name} SDK is already protected by PromptGuard.`
            : `${provider.name} SDK detected. Run 'PromptGuard: Apply Protection' to secure this call.`;

          // Unprotected SDK usage is surfaced as a Warning (yellow), matching
          // the tree's yellow-shield framing and the README's "warnings when
          // LLM SDKs are detected without PromptGuard protection". Already
          // protected usage stays a low-noise Hint.
          const severity = hasProtection
            ? vscode.DiagnosticSeverity.Hint
            : vscode.DiagnosticSeverity.Warning;

          const diagnostic = new vscode.Diagnostic(range, message, severity);
          diagnostic.source = "PromptGuard";
          diagnostic.code = hasProtection ? "llm-sdk-protected" : "llm-sdk-unprotected";

          addDiagnostic(instance.file, diagnostic);
        }
      } else {
        for (const filePath of provider.files) {
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 100),
            `${provider.name} SDK detected. Run 'PromptGuard: Apply Protection' to secure this call.`,
            vscode.DiagnosticSeverity.Warning,
          );
          diagnostic.source = "PromptGuard";
          diagnostic.code = "llm-sdk-detected";

          addDiagnostic(filePath, diagnostic);
        }
      }
    }

    for (const [uriString, diags] of diagnostics.entries()) {
      this.diagnosticCollection.set(vscode.Uri.parse(uriString), diags);
    }
  }

  /** Read back the diagnostics currently set for a URI (used by tests). */
  getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.diagnosticCollection.get(uri) ?? [];
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.diagnosticCollection.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
