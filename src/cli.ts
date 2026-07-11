import * as vscode from "vscode";
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  ScanResult,
  StatusResult,
  ThreatDetectionResult,
  RedactResult,
  ProjectListResult,
  CliExecutionError,
} from "./types";
import { errorMessage } from "./utils";

/** Timeout for read-only commands (scan, status, --version, ...). */
const CLI_TIMEOUT_MS = 30000;

/**
 * Timeout for mutating commands (apply, init) which rewrite source files
 * across the workspace. On large projects the transformation legitimately
 * takes far longer than a read-only query; killing it mid-write with the
 * 30s read-only timeout leaves the workspace half-transformed.
 */
const MUTATING_CLI_TIMEOUT_MS = 300000;

/**
 * Appended to the error message when a mutating command is killed by its
 * timeout: the workspace may be left partially transformed, and the user
 * needs to know how to get back to a clean state.
 */
const MUTATION_TIMEOUT_HINT =
  "The command was killed by a timeout, so the workspace may be partially " +
  "transformed. Run 'PromptGuard: Disable' (promptguard disable) to restore " +
  "the original files from backups.";

/** Argv flags whose values must never appear in logs or error messages. */
const SENSITIVE_FLAGS = new Set(["--api-key"]);

/**
 * `execFile` caps captured stdout/stderr at 1 MiB by default and kills the
 * child when exceeded. A workspace scan's JSON output (every instance of
 * every provider) can easily exceed that, so raise the cap generously.
 */
const MAX_OUTPUT_BUFFER_BYTES = 64 * 1024 * 1024;

/**
 * Exit code the CLI uses for "findings" (content blocked / SDK usage found).
 * See promptguard-cli/src/commands/scan.rs (`EXIT_FINDINGS`) and main.rs:
 * 0 = clean/allow, 2 = findings/block, 1 = error. Exit 2 still writes the
 * full JSON result to stdout and must NOT be treated as a failure.
 */
export const CLI_EXIT_FINDINGS = 2;

/**
 * Redact values of sensitive flags (e.g. `--api-key`) from an argv array so
 * they never leak into error messages, toasts, or the output channel.
 * Handles both `--api-key VALUE` and `--api-key=VALUE` forms.
 */
export function redactCliArgs(args: string[]): string[] {
  const redacted: string[] = [];
  let redactNext = false;
  for (const arg of args) {
    if (redactNext) {
      redacted.push("***REDACTED***");
      redactNext = false;
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex > 0 && SENSITIVE_FLAGS.has(arg.slice(0, eqIndex))) {
      redacted.push(`${arg.slice(0, eqIndex)}=***REDACTED***`);
      continue;
    }
    if (SENSITIVE_FLAGS.has(arg)) {
      redacted.push(arg);
      redactNext = true;
      continue;
    }
    redacted.push(arg);
  }
  return redacted;
}

/**
 * Take the first line of a command's output. On Windows, `where` prints one
 * match per line; naive trim() keeps interior newlines and produces an
 * invalid path.
 */
export function firstLine(output: string): string {
  return output.split(/\r?\n/)[0].trim();
}

/**
 * Produce a single, safe-to-display line from CLI stderr for user-facing
 * error messages. Takes the first line only and redacts anything that looks
 * like an API key or an `--api-key` value (same spirit as redactCliArgs) so
 * a secret echoed by the CLI can never reach a toast or log.
 */
export function sanitizeCliOutputLine(output: string): string {
  return firstLine(output)
    .replace(/--api-key(=|\s+)\S+/g, "--api-key$1***REDACTED***")
    .replace(/\bpg_[A-Za-z0-9_]{8,}\b/g, "***REDACTED***");
}

interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  /**
   * Marks a command that calls the PromptGuard API and therefore needs an
   * API key (scan --file, redact, projects ...). When set and the injected
   * key provider (VS Code SecretStorage, populated by "Set API Key") returns
   * a key, it is supplied to the CLI via PROMPTGUARD_API_KEY — so running
   * "Set API Key" alone is enough to use API-backed commands. When no key is
   * stored, the environment is left untouched and the CLI falls back to its
   * own credential chain (env var / config / keyring).
   */
  apiBacked?: boolean;
  /**
   * Non-zero exit codes that still mean "command succeeded, parse stdout".
   * Used for `scan`, where exit 2 = findings/block with full JSON on stdout.
   */
  successExitCodes?: readonly number[];
  /**
   * Per-command timeout. Defaults to CLI_TIMEOUT_MS (read-only commands).
   * Mutating commands (apply, init) pass MUTATING_CLI_TIMEOUT_MS.
   */
  timeoutMs?: number;
  /**
   * Marks a command that rewrites workspace files (apply, init). If such a
   * command is killed by its timeout, the error message tells the user the
   * workspace may be partially transformed and how to restore it.
   */
  mutating?: boolean;
}

/**
 * Supplies the API key stored via "PromptGuard: Set API Key" (VS Code
 * SecretStorage). Injected at construction so the wrapper never depends on
 * SecretStorage directly. Returning undefined means "no stored key" and the
 * CLI's own credential chain applies.
 */
export type ApiKeyProvider = () => Promise<string | undefined>;

export class CliWrapper {
  private cliPath: string | null = null;

  constructor(private readonly storedApiKeyProvider?: ApiKeyProvider) {}

  async findCliBinary(): Promise<string | null> {
    const config = vscode.workspace.getConfiguration("promptguard");
    const configuredPath = config.get<string>("cliPath");
    if (configuredPath && configuredPath.trim() !== "") {
      if (await this.isValidBinary(configuredPath)) {
        return configuredPath;
      }
    }

    try {
      const whichCmd = process.platform === "win32" ? "where" : "which";
      const foundPath = firstLine(await this.execRaw(whichCmd, ["promptguard"]));
      if (foundPath && (await this.isValidBinary(foundPath))) {
        return foundPath;
      }
    } catch {
      // Not in PATH
    }

    const commonPaths = [
      "/usr/local/bin/promptguard",
      path.join(os.homedir(), ".cargo", "bin", "promptguard"),
      path.join(os.homedir(), ".local", "bin", "promptguard"),
    ];

    if (process.platform === "win32") {
      commonPaths.push(
        path.join(
          process.env["ProgramFiles"] || "C:\\Program Files",
          "PromptGuard",
          "promptguard.exe",
        ),
        path.join(process.env["LOCALAPPDATA"] || "", "PromptGuard", "promptguard.exe"),
      );
    }

    for (const binPath of commonPaths) {
      if (await this.isValidBinary(binPath)) {
        return binPath;
      }
    }

    return null;
  }

  private async execRaw(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      child_process.execFile(cmd, args, { timeout: CLI_TIMEOUT_MS }, (error, stdout) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  private async isValidBinary(binPath: string): Promise<boolean> {
    try {
      const stdout = await this.execRaw(binPath, ["--version"]);
      return stdout.length > 0;
    } catch {
      return false;
    }
  }

  async getCliPath(): Promise<string> {
    if (this.cliPath) {
      return this.cliPath;
    }

    const foundPath = await this.findCliBinary();
    if (!foundPath) {
      throw new Error(
        "PromptGuard CLI not found. Please install it first:\n" +
          "  curl -fsSL https://raw.githubusercontent.com/acebot712/promptguard-cli/main/install.sh | sh\n\n" +
          "Or set the 'promptguard.cliPath' setting to the binary location.",
      );
    }

    this.cliPath = foundPath;
    return foundPath;
  }

  private async executeCommand(
    args: string[],
    options?: ExecOptions,
  ): Promise<{ stdout: string; stderr: string }> {
    const cliPath = await this.getCliPath();
    const cwd = options?.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    // Sensitive values (API keys) are passed via environment variables, never
    // argv, so they are invisible to `ps` and never end up in error messages.
    // For API-backed commands, the key stored via "Set API Key" is injected
    // here; explicit options.env still wins (e.g. init passing a
    // freshly-entered key).
    const storedApiKey = options?.apiBacked ? await this.resolveStoredApiKey() : undefined;
    let env: NodeJS.ProcessEnv | undefined = options?.env
      ? { ...process.env, ...options.env }
      : undefined;
    if (storedApiKey) {
      env = { ...process.env, PROMPTGUARD_API_KEY: storedApiKey, ...options?.env };
    }
    const timeout = options?.timeoutMs ?? CLI_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      child_process.execFile(
        cliPath,
        args,
        { cwd, timeout, env, maxBuffer: MAX_OUTPUT_BUFFER_BYTES },
        (error, stdout, stderr) => {
          if (error) {
            const exitCode = typeof error.code === "number" ? error.code : undefined;
            // Differentiated exit codes: some commands use a non-zero exit to
            // signal findings (scan: 2 = block/findings) while still writing
            // the full JSON result to stdout. Treating those as failures would
            // discard valid results exactly when there is something to report.
            if (exitCode !== undefined && options?.successExitCodes?.includes(exitCode)) {
              resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
              return;
            }
            // Defense in depth: redact sensitive flag values from the argv we
            // embed in the error message (they should never be there anyway).
            // Include a sanitized first line of stderr so the user-facing
            // toast explains WHY the command failed, not just that it did.
            const detail = stderr ? ` — ${sanitizeCliOutputLine(stderr)}` : "";
            // execFile sets `killed` when it terminated the child itself,
            // which for our options means the timeout fired. For a command
            // that rewrites workspace files, that is not just a failure: the
            // workspace may be mid-transformation.
            const timedOut = error.killed === true && exitCode === undefined;
            const timeoutDetail = timedOut ? ` — timed out after ${timeout / 1000}s` : "";
            const mutationHint = timedOut && options?.mutating ? ` ${MUTATION_TIMEOUT_HINT}` : "";
            reject(
              new CliExecutionError(
                `Command failed: promptguard ${redactCliArgs(args).join(" ")}${timeoutDetail}${detail}${mutationHint}`,
                exitCode,
                stderr || error.message || "",
                stdout || "",
              ),
            );
            return;
          }
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        },
      );
    });
  }

  /**
   * Resolve the API key stored via "Set API Key", if any. A SecretStorage
   * failure must not break the command itself — the CLI's own credential
   * chain still applies — so errors resolve to undefined.
   */
  private async resolveStoredApiKey(): Promise<string | undefined> {
    if (!this.storedApiKeyProvider) {
      return undefined;
    }
    try {
      const key = await this.storedApiKeyProvider();
      return key && key.trim() !== "" ? key : undefined;
    } catch {
      return undefined;
    }
  }

  private async executeJson<T>(args: string[], options?: ExecOptions): Promise<T> {
    const { stdout, stderr } = await this.executeCommand(args, options);
    if (stderr && !stdout) {
      // The message may surface in a toast: show only a sanitized first line.
      // The raw stderr stays available on the .stderr property.
      throw new CliExecutionError(sanitizeCliOutputLine(stderr), undefined, stderr, stdout);
    }
    try {
      return JSON.parse(stdout) as T;
    } catch (e) {
      throw new CliExecutionError(
        `Failed to parse output: ${errorMessage(e)}`,
        undefined,
        stderr,
        stdout,
      );
    }
  }

  /**
   * Run a CLI command that takes content input, staging the content in a
   * 0600 temp file passed via `--file` instead of argv. Content on argv is
   * visible to every process on the machine (`ps`) and breaks on inputs
   * larger than ARG_MAX.
   */
  private async executeJsonWithContent<T>(
    baseArgs: string[],
    content: string,
    options?: ExecOptions,
  ): Promise<T> {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "promptguard-"));
    const filePath = path.join(dir, "input.txt");
    try {
      await fs.promises.writeFile(filePath, content, { mode: 0o600 });
      return await this.executeJson<T>([...baseArgs, "--file", filePath], options);
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }

  async scan(cwd?: string): Promise<ScanResult> {
    // Exit 2 = SDK usage found; the JSON report is still on stdout.
    return this.executeJson<ScanResult>(["scan", "--json"], {
      cwd,
      successExitCodes: [CLI_EXIT_FINDINGS],
    });
  }

  async status(): Promise<StatusResult> {
    return this.executeJson<StatusResult>(["status", "--json"]);
  }

  async init(options: {
    apiKey?: string;
    provider?: string[];
    baseUrl?: string;
    auto?: boolean;
  }): Promise<void> {
    const args = ["init"];
    const env: Record<string, string> = {};

    if (options.apiKey) {
      // Never pass the API key as an argv element: argv is world-readable via
      // `ps` and would be embedded in CliExecutionError messages. The CLI's
      // auth resolution reads PROMPTGUARD_API_KEY when --api-key is absent.
      env["PROMPTGUARD_API_KEY"] = options.apiKey;
    }

    if (options.provider && options.provider.length > 0) {
      for (const p of options.provider) {
        args.push("--provider", p);
      }
    }

    if (options.baseUrl) {
      args.push("--base-url", options.baseUrl);
    }

    if (options.auto) {
      args.push("--auto");
    }

    // `init` rewrites source files: give it the long mutating timeout.
    await this.executeCommand(args, {
      env,
      timeoutMs: MUTATING_CLI_TIMEOUT_MS,
      mutating: true,
    });
  }

  async apply(autoConfirm = false): Promise<void> {
    const args = ["apply"];
    if (autoConfirm) {
      args.push("--yes");
    }
    // `apply` rewrites source files: give it the long mutating timeout.
    await this.executeCommand(args, {
      timeoutMs: MUTATING_CLI_TIMEOUT_MS,
      mutating: true,
    });
  }

  async disable(): Promise<void> {
    await this.executeCommand(["disable"]);
  }

  async enable(): Promise<void> {
    await this.executeCommand(["enable"]);
  }

  async detectThreats(text: string): Promise<ThreatDetectionResult> {
    // Exit 2 = content blocked; the JSON verdict is still on stdout. Without
    // this, "Scan failed" would appear exactly when a threat IS detected.
    return this.executeJsonWithContent<ThreatDetectionResult>(["scan", "--json"], text, {
      successExitCodes: [CLI_EXIT_FINDINGS],
      apiBacked: true,
    });
  }

  async redactText(text: string): Promise<RedactResult> {
    return this.executeJsonWithContent<RedactResult>(["redact", "--json"], text, {
      apiBacked: true,
    });
  }

  async listProjects(): Promise<ProjectListResult> {
    return this.executeJson<ProjectListResult>(["projects", "list", "--json"], { apiBacked: true });
  }

  async selectProject(projectId: string): Promise<void> {
    await this.executeCommand(["projects", "select", projectId], { apiBacked: true });
  }

  resetCache(): void {
    this.cliPath = null;
  }
}
