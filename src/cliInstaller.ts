import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import * as os from "os";
import { promisify } from "util";
import { errorMessage } from "./utils";

const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/acebot712/promptguard-cli/releases/latest";
const GITHUB_USER_AGENT = "PromptGuard-VSCode-Extension";

function getAssetName(): string | null {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === "darwin") {
    if (arch === "arm64") {
      return "promptguard-macos-arm64";
    }
    if (arch === "x64") {
      return "promptguard-macos-x86_64";
    }
  } else if (platform === "linux") {
    if (arch === "x64") {
      return "promptguard-linux-x86_64";
    }
    if (arch === "arm64") {
      return "promptguard-linux-arm64";
    }
  } else if (platform === "win32") {
    return "promptguard-windows-x86_64.exe";
  }

  return null;
}

export function getCliInstallDir(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "bin");
}

export function getInstalledCliPath(context: vscode.ExtensionContext): string {
  const binDir = getCliInstallDir(context);
  const binaryName = os.platform() === "win32" ? "promptguard.exe" : "promptguard";
  return path.join(binDir, binaryName);
}

function httpsGetFollowRedirects(
  url: string,
  headers: Record<string, string> = {},
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl: string) => {
      https
        .get(
          requestUrl,
          { headers: { "User-Agent": GITHUB_USER_AGENT, ...headers } },
          (response) => {
            if (
              (response.statusCode === 301 || response.statusCode === 302) &&
              response.headers.location
            ) {
              makeRequest(response.headers.location);
              return;
            }
            resolve(response);
          },
        )
        .on("error", reject);
    };
    makeRequest(url);
  });
}

interface GitHubRelease {
  tag_name: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await httpsGetFollowRedirects(GITHUB_RELEASES_URL, {
    Accept: "application/vnd.github.v3+json",
  });

  return new Promise((resolve, reject) => {
    let data = "";
    response.on("data", (chunk: string) => (data += chunk));
    response.on("end", () => {
      try {
        resolve(JSON.parse(data) as GitHubRelease);
      } catch {
        reject(new Error("Failed to parse GitHub release info"));
      }
    });
    response.on("error", reject);
  });
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await httpsGetFollowRedirects(url);

  if (response.statusCode !== 200) {
    throw new Error(`Download failed with status ${response.statusCode}`);
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    response.pipe(file);
    file.on("finish", () => {
      file.close();
      resolve();
    });
    file.on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export function isCliInstalled(context: vscode.ExtensionContext): boolean {
  return fs.existsSync(getInstalledCliPath(context));
}

export async function installCli(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
): Promise<string | null> {
  const assetName = getAssetName();
  if (!assetName) {
    output.appendLine(`Unsupported platform: ${os.platform()} ${os.arch()}`);
    void vscode.window.showErrorMessage(
      `PromptGuard CLI is not available for ${os.platform()} ${os.arch()}. ` +
        "Please install manually from https://github.com/acebot712/promptguard-cli",
    );
    return null;
  }

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Installing PromptGuard CLI...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Fetching release info..." });
        output.appendLine("Fetching latest release info from GitHub...");

        const release = await fetchLatestRelease();
        output.appendLine(`Latest version: ${release.tag_name}`);

        const asset = release.assets.find((a) => a.name === assetName);
        if (!asset) {
          throw new Error(`Binary ${assetName} not found in release ${release.tag_name}`);
        }

        progress.report({ message: "Downloading CLI..." });
        output.appendLine(`Downloading ${asset.name}...`);

        const binDir = getCliInstallDir(context);
        await mkdir(binDir, { recursive: true });

        const destPath = getInstalledCliPath(context);
        await downloadFile(asset.browser_download_url, destPath);

        progress.report({ message: "Setting permissions..." });

        if (os.platform() !== "win32") {
          await chmod(destPath, 0o755);
        }

        const config = vscode.workspace.getConfiguration("promptguard");
        await config.update("cliPath", destPath, vscode.ConfigurationTarget.Global);

        output.appendLine(`CLI installed at: ${destPath}`);
        output.appendLine("PromptGuard CLI installation complete!");
        void vscode.window.showInformationMessage(
          `PromptGuard CLI ${release.tag_name} installed successfully!`,
        );

        return destPath;
      } catch (error) {
        output.appendLine(`Installation failed: ${errorMessage(error)}`);
        void vscode.window.showErrorMessage(
          `Failed to install PromptGuard CLI: ${errorMessage(error)}`,
        );
        return null;
      }
    },
  );
}
