import * as vscode from "vscode";
import * as child_process from "child_process";
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

const CLI_TIMEOUT_MS = 30000;

export class CliWrapper {
  private cliPath: string | null = null;

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
      const foundPath = await this.execRaw(whichCmd, ["promptguard"]);
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

  private async executeCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const cliPath = await this.getCliPath();
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    return new Promise((resolve, reject) => {
      child_process.execFile(
        cliPath,
        args,
        { cwd, timeout: CLI_TIMEOUT_MS },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new CliExecutionError(
                `Command failed: promptguard ${args.join(" ")}`,
                typeof error.code === "number" ? error.code : undefined,
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

  private async executeJson<T>(args: string[]): Promise<T> {
    const { stdout, stderr } = await this.executeCommand(args);
    if (stderr && !stdout) {
      throw new CliExecutionError(stderr, undefined, stderr, stdout);
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

  async scan(): Promise<ScanResult> {
    return this.executeJson<ScanResult>(["scan", "--json"]);
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

    if (options.apiKey) {
      args.push("--api-key", options.apiKey);
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

    await this.executeCommand(args);
  }

  async apply(autoConfirm = false): Promise<void> {
    const args = ["apply"];
    if (autoConfirm) {
      args.push("--yes");
    }
    await this.executeCommand(args);
  }

  async disable(): Promise<void> {
    await this.executeCommand(["disable"]);
  }

  async enable(): Promise<void> {
    await this.executeCommand(["enable"]);
  }

  async detectThreats(text: string): Promise<ThreatDetectionResult> {
    return this.executeJson<ThreatDetectionResult>(["scan", "--json", "--text", text]);
  }

  async redactText(text: string): Promise<RedactResult> {
    return this.executeJson<RedactResult>(["redact", "--json", "--text", text]);
  }

  async listProjects(): Promise<ProjectListResult> {
    return this.executeJson<ProjectListResult>(["projects", "list", "--json"]);
  }

  async selectProject(projectId: string): Promise<void> {
    await this.executeCommand(["projects", "select", projectId]);
  }

  resetCache(): void {
    this.cliPath = null;
  }
}
