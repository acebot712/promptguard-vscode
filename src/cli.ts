import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as os from "os";
import { ScanResult, StatusResult, CliError } from "./types";

export class CliWrapper {
  private cliPath: string | null = null;

  async findCliBinary(): Promise<string | null> {
    // Check configuration first
    const config = vscode.workspace.getConfiguration("promptguard");
    const configuredPath = config.get<string>("cliPath");
    if (configuredPath && configuredPath.trim() !== "") {
      if (await this.isValidBinary(configuredPath)) {
        return configuredPath;
      }
    }

    // Check PATH using 'which' (Unix) or 'where' (Windows)
    try {
      const whichCmd = process.platform === "win32" ? "where" : "which";
      const foundPath = await this.execSimple(whichCmd, ["promptguard"]);
      if (foundPath && await this.isValidBinary(foundPath)) {
        return foundPath;
      }
    } catch {
      // Not in PATH
    }

    // Check common install locations
    const commonPaths = [
      "/usr/local/bin/promptguard",
      path.join(os.homedir(), ".cargo", "bin", "promptguard"),
      path.join(os.homedir(), ".local", "bin", "promptguard"),
    ];

    // Add Windows paths if on Windows
    if (process.platform === "win32") {
      commonPaths.push(
        path.join(process.env["ProgramFiles"] || "C:\\Program Files", "PromptGuard", "promptguard.exe"),
        path.join(process.env["LOCALAPPDATA"] || "", "PromptGuard", "promptguard.exe")
      );
    }

    for (const binPath of commonPaths) {
      if (await this.isValidBinary(binPath)) {
        return binPath;
      }
    }

    return null;
  }

  private async execSimple(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      child_process.execFile(cmd, args, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  private async isValidBinary(binPath: string): Promise<boolean> {
    try {
      const stdout = await this.execSimple(binPath, ["--version"]);
      return stdout.length > 0;
    } catch {
      return false;
    }
  }

  async getCliPath(): Promise<string> {
    if (this.cliPath) {
      return this.cliPath;
    }

    const path = await this.findCliBinary();
    if (!path) {
      throw new Error(
        "PromptGuard CLI not found. Please install it first:\n" +
        "  curl -fsSL https://raw.githubusercontent.com/acebot712/promptguard-cli/main/install.sh | sh\n\n" +
        "Or set the 'promptguard.cliPath' setting to the binary location."
      );
    }

    this.cliPath = path;
    return path;
  }

  async executeCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const cliPath = await this.getCliPath();
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    return new Promise((resolve, reject) => {
      // Use execFile instead of exec to prevent command injection
      // execFile passes arguments as an array, not through shell interpolation
      child_process.execFile(cliPath, args, { cwd }, (error, stdout, stderr) => {
        if (error) {
          reject({
            message: `Command failed: promptguard ${args.join(" ")}`,
            code: error.code,
            stderr: stderr || error.message || "",
            stdout: stdout || "",
          } as CliError);
          return;
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
  }

  async scan(provider?: string): Promise<ScanResult> {
    const args = ["scan", "--json"];
    if (provider) {
      args.push("--provider", provider);
    }

    const { stdout, stderr } = await this.executeCommand(args);
    
    if (stderr && !stdout) {
      throw { message: stderr } as CliError;
    }

    try {
      return JSON.parse(stdout) as ScanResult;
    } catch (error) {
      throw {
        message: `Failed to parse scan output: ${error}`,
        stderr,
      } as CliError;
    }
  }

  async status(): Promise<StatusResult> {
    const { stdout, stderr } = await this.executeCommand(["status", "--json"]);

    if (stderr && !stdout) {
      throw { message: stderr } as CliError;
    }

    try {
      return JSON.parse(stdout) as StatusResult;
    } catch (error) {
      throw {
        message: `Failed to parse status output: ${error}`,
        stderr,
      } as CliError;
    }
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

  async apply(autoConfirm: boolean = false): Promise<void> {
    const args = ["apply"];
    if (autoConfirm) {
      args.push("--yes");
    }
    await this.executeCommand(args);
  }

  async disable(): Promise<void> {
    await this.executeCommand(["disable"]);
  }

  async enable(runtime: boolean = false): Promise<void> {
    const args = ["enable"];
    if (runtime) {
      args.push("--runtime");
    }
    await this.executeCommand(args);
  }

  resetCache(): void {
    this.cliPath = null;
  }
}

