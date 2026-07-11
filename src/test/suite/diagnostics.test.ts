import * as assert from "assert";
import * as vscode from "vscode";
import { CliWrapper } from "../../cli";
import { PromptGuardDiagnostics } from "../../diagnostics";
import { ScanResult } from "../../types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function scanResultWithFile(file: string): ScanResult {
  return {
    total_files_scanned: 1,
    files_with_sdks: 1,
    total_instances: 1,
    providers: [
      {
        name: "openai",
        file_count: 1,
        instance_count: 1,
        files: [file],
        instances: [{ file, line: 10, column: 5, has_base_url: false }],
      },
    ],
  };
}

suite("Diagnostics Test Suite", () => {
  test("applyScanResult joins relative paths against the workspace folder", () => {
    const cli = {} as CliWrapper;
    const diagnostics = new PromptGuardDiagnostics(cli);
    const folderUri = vscode.Uri.file("/test/workspace");

    diagnostics.applyScanResult(scanResultWithFile("src/app.py"), folderUri);

    const expectedUri = vscode.Uri.joinPath(folderUri, "src/app.py");
    const diags = diagnostics.getDiagnostics(expectedUri);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].source, "PromptGuard");
    assert.strictEqual(diags[0].code, "llm-sdk-unprotected");
    // 1-based CLI line/column mapped to 0-based VS Code positions
    assert.strictEqual(diags[0].range.start.line, 9);
    assert.strictEqual(diags[0].range.start.character, 4);

    diagnostics.dispose();
  });

  test("applyScanResult marks protected instances as hints", () => {
    const cli = {} as CliWrapper;
    const diagnostics = new PromptGuardDiagnostics(cli);
    const folderUri = vscode.Uri.file("/test/workspace");

    const result: ScanResult = {
      total_files_scanned: 1,
      files_with_sdks: 1,
      total_instances: 1,
      providers: [
        {
          name: "openai",
          file_count: 1,
          instance_count: 1,
          files: ["app.py"],
          instances: [
            {
              file: "app.py",
              line: 3,
              column: 1,
              has_base_url: true,
              current_base_url: "https://api.promptguard.co/api/v1",
            },
          ],
        },
      ],
    };

    diagnostics.applyScanResult(result, folderUri);

    const diags = diagnostics.getDiagnostics(vscode.Uri.joinPath(folderUri, "app.py"));
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "llm-sdk-protected");
    assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Hint);

    diagnostics.dispose();
  });

  test("applyScanResult falls back to file-level diagnostics without instances", () => {
    const cli = {} as CliWrapper;
    const diagnostics = new PromptGuardDiagnostics(cli);
    const folderUri = vscode.Uri.file("/test/workspace");

    const result: ScanResult = {
      total_files_scanned: 2,
      files_with_sdks: 2,
      total_instances: 0,
      providers: [
        {
          name: "anthropic",
          file_count: 2,
          instance_count: 0,
          files: ["a.py", "lib/b.py"],
        },
      ],
    };

    diagnostics.applyScanResult(result, folderUri);

    for (const file of ["a.py", "lib/b.py"]) {
      const diags = diagnostics.getDiagnostics(vscode.Uri.joinPath(folderUri, file));
      assert.strictEqual(diags.length, 1, `expected a diagnostic for ${file}`);
      assert.strictEqual(diags[0].code, "llm-sdk-detected");
    }

    diagnostics.dispose();
  });

  test("A stale (older) scan cannot overwrite a newer scan's results", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "test harness must open a workspace folder");

    const first = deferred<ScanResult>();
    const second = deferred<ScanResult>();
    let calls = 0;
    const cli = {
      scan: () => {
        calls++;
        return calls === 1 ? first.promise : second.promise;
      },
    } as unknown as CliWrapper;

    const diagnostics = new PromptGuardDiagnostics(cli);

    const olderScan = diagnostics.scanAllWorkspaceFolders();
    const newerScan = diagnostics.scanAllWorkspaceFolders();

    // The newer scan finishes first...
    second.resolve(scanResultWithFile("newer.py"));
    await newerScan;

    // ...then the older, slower scan finally resolves with stale data.
    first.resolve(scanResultWithFile("older.py"));
    await olderScan;

    const newerUri = vscode.Uri.joinPath(folder.uri, "newer.py");
    const olderUri = vscode.Uri.joinPath(folder.uri, "older.py");
    assert.strictEqual(diagnostics.getDiagnostics(newerUri).length, 1);
    assert.strictEqual(
      diagnostics.getDiagnostics(olderUri).length,
      0,
      "stale scan results must be discarded",
    );

    diagnostics.dispose();
  });

  test("A failed scan keeps the last-good diagnostics", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "test harness must open a workspace folder");

    let calls = 0;
    const cli = {
      scan: () => {
        calls++;
        if (calls === 1) {
          return Promise.resolve(scanResultWithFile("kept.py"));
        }
        return Promise.reject(new Error("transient CLI failure"));
      },
    } as unknown as CliWrapper;

    const diagnostics = new PromptGuardDiagnostics(cli);

    await diagnostics.scanAllWorkspaceFolders();
    const uri = vscode.Uri.joinPath(folder.uri, "kept.py");
    assert.strictEqual(diagnostics.getDiagnostics(uri).length, 1);

    await diagnostics.scanAllWorkspaceFolders();
    assert.strictEqual(
      diagnostics.getDiagnostics(uri).length,
      1,
      "a transient scan error must not clear existing diagnostics",
    );

    diagnostics.dispose();
  });
});
