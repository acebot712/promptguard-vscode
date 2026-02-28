import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as os from "os";
import { promisify } from "util";

const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);

/**
 * GitHub releases URL for PromptGuard CLI
 */
const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/acebot712/promptguard-cli/releases/latest";

/**
 * Mapping of platform/arch to release asset names
 */
function getAssetName(): string | null {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === "darwin") {
    if (arch === "arm64") {
      return "promptguard-macos-arm64";
    } else if (arch === "x64") {
      return "promptguard-macos-x86_64";
    }
  } else if (platform === "linux") {
    if (arch === "x64") {
      return "promptguard-linux-x86_64";
    } else if (arch === "arm64") {
      return "promptguard-linux-arm64";
    }
  } else if (platform === "win32") {
    return "promptguard-windows-x86_64.exe";
  }

  return null;
}

/**
 * Get the installation directory for the CLI binary
 */
export function getCliInstallDir(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "bin");
}

/**
 * Get the full path to the installed CLI binary
 */
export function getInstalledCliPath(context: vscode.ExtensionContext): string {
  const binDir = getCliInstallDir(context);
  const platform = os.platform();
  const binaryName = platform === "win32" ? "promptguard.exe" : "promptguard";
  return path.join(binDir, binaryName);
}

interface GitHubRelease {
  tag_name: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
}

/**
 * Fetch the latest release info from GitHub
 */
async function fetchLatestRelease(): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "PromptGuard-VSCode-Extension",
        Accept: "application/vnd.github.v3+json",
      },
    };

    https
      .get(GITHUB_RELEASES_URL, options, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            https.get(redirectUrl, options, (redirectRes) => {
              handleResponse(redirectRes, resolve, reject);
            });
          } else {
            reject(new Error("Redirect without location header"));
          }
        } else {
          handleResponse(res, resolve, reject);
        }
      })
      .on("error", reject);
  });
}

function handleResponse(
  res: typeof import("http").IncomingMessage.prototype,
  resolve: (value: GitHubRelease) => void,
  reject: (reason: Error) => void,
): void {
  let data = "";
  res.on("data", (chunk: string) => (data += chunk));
  res.on("end", () => {
    try {
      const release = JSON.parse(data) as GitHubRelease;
      resolve(release);
    } catch {
      reject(new Error("Failed to parse GitHub release info"));
    }
  });
  res.on("error", reject);
}

/**
 * Download a file from a URL to a destination path
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const makeRequest = (downloadUrl: string) => {
      https
        .get(
          downloadUrl,
          { headers: { "User-Agent": "PromptGuard-VSCode-Extension" } },
          (response) => {
            // Handle redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                makeRequest(redirectUrl);
                return;
              }
            }

            if (response.statusCode !== 200) {
              reject(new Error(`Download failed with status ${response.statusCode}`));
              return;
            }

            response.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve();
            });
          },
        )
        .on("error", (err) => {
          fs.unlink(destPath, () => {}); // Delete the file on error
          reject(err);
        });
    };

    makeRequest(url);
  });
}

/**
 * Check if CLI is already installed in the extension's storage
 */
export function isCliInstalled(context: vscode.ExtensionContext): boolean {
  const cliPath = getInstalledCliPath(context);
  return fs.existsSync(cliPath);
}

/**
 * Install the PromptGuard CLI by downloading from GitHub releases
 */
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
        progress.report({ increment: 10, message: "Fetching release info..." });
        output.appendLine("Fetching latest release info from GitHub...");

        const release = await fetchLatestRelease();
        output.appendLine(`Latest version: ${release.tag_name}`);

        const asset = release.assets.find((a) => a.name === assetName);
        if (!asset) {
          throw new Error(`Binary ${assetName} not found in release ${release.tag_name}`);
        }

        progress.report({ increment: 20, message: "Creating directories..." });

        // Create the bin directory
        const binDir = getCliInstallDir(context);
        await mkdir(binDir, { recursive: true });

        progress.report({ increment: 20, message: "Downloading CLI..." });
        output.appendLine(`Downloading ${asset.name}...`);

        const destPath = getInstalledCliPath(context);
        await downloadFile(asset.browser_download_url, destPath);

        progress.report({ increment: 30, message: "Setting permissions..." });

        // Make the binary executable on Unix-like systems
        if (os.platform() !== "win32") {
          await chmod(destPath, 0o755);
        }

        progress.report({ increment: 20, message: "Verifying installation..." });
        output.appendLine(`CLI installed at: ${destPath}`);

        // Update the extension setting to use the installed CLI
        const config = vscode.workspace.getConfiguration("promptguard");
        await config.update("cliPath", destPath, vscode.ConfigurationTarget.Global);

        output.appendLine("PromptGuard CLI installation complete!");
        void vscode.window.showInformationMessage(
          `PromptGuard CLI ${release.tag_name} installed successfully!`,
        );

        return destPath;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`Installation failed: ${message}`);
        void vscode.window.showErrorMessage(`Failed to install PromptGuard CLI: ${message}`);
        return null;
      }
    },
  );
}

/**
 * Check for CLI updates and optionally install them
 */
export async function checkForCliUpdates(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  currentVersion: string,
): Promise<void> {
  try {
    const release = await fetchLatestRelease();
    const latestVersion = release.tag_name.replace(/^v/, "");
    const currentVersionClean = currentVersion.replace(/^v/, "");

    if (isNewerVersion(latestVersion, currentVersionClean)) {
      const update = await vscode.window.showInformationMessage(
        `PromptGuard CLI update available: ${release.tag_name} (current: ${currentVersion})`,
        "Update Now",
        "Later",
      );

      if (update === "Update Now") {
        await installCli(context, output);
      }
    }
  } catch {
    // Silently fail update check - not critical
  }
}

/**
 * Compare version strings
 */
function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split(".").map(Number);
  const currentParts = current.split(".").map(Number);

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) {
      return true;
    }
    if (l < c) {
      return false;
    }
  }
  return false;
}
