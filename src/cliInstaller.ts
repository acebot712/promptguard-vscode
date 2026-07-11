import * as vscode from "vscode";
import * as child_process from "child_process";
import * as crypto from "crypto";
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
const MAX_REDIRECTS = 5;

/**
 * Map a platform/arch pair to the release asset name published by the CLI's
 * release pipeline. Exported (with injectable parameters) so tests exercise
 * the real mapping instead of a re-implementation.
 */
export function getAssetName(
  platform: NodeJS.Platform = os.platform(),
  arch: string = os.arch(),
): string | null {
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

/**
 * Extract the expected hex digest for `assetName` from the contents of a
 * `.sha256` checksum file (`<hex>  <filename>` as produced by sha256sum /
 * `shasum -a 256`). Returns null if the file does not contain a valid entry.
 */
export function parseSha256File(content: string, assetName: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-fA-F]{64})[ \t*]+(.+)$/);
    if (match && path.basename(match[2].trim()) === assetName) {
      return match[1].toLowerCase();
    }
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
    const makeRequest = (requestUrl: string, redirectsLeft: number) => {
      let parsed: URL;
      try {
        parsed = new URL(requestUrl);
      } catch {
        reject(new Error(`Invalid download URL: ${requestUrl}`));
        return;
      }
      const host = parsed.hostname;
      const trusted =
        parsed.protocol === "https:" &&
        (host === "github.com" ||
          host === "api.github.com" ||
          host.endsWith(".github.com") ||
          host.endsWith(".githubusercontent.com"));
      if (!trusted) {
        reject(new Error(`Refusing to download PromptGuard CLI from untrusted host: ${host}`));
        return;
      }
      https
        .get(
          requestUrl,
          { headers: { "User-Agent": GITHUB_USER_AGENT, ...headers } },
          (response) => {
            const status = response.statusCode ?? 0;
            if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
              response.resume();
              if (redirectsLeft <= 0) {
                reject(new Error(`Too many redirects fetching ${url}`));
                return;
              }
              makeRequest(response.headers.location, redirectsLeft - 1);
              return;
            }
            resolve(response);
          },
        )
        .on("error", reject);
    };
    makeRequest(url, MAX_REDIRECTS);
  });
}

interface GitHubRelease {
  tag_name: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
}

async function readBody(response: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => (data += chunk));
    response.on("end", () => resolve(data));
    response.on("error", reject);
  });
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await httpsGetFollowRedirects(GITHUB_RELEASES_URL, {
    Accept: "application/vnd.github.v3+json",
  });

  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(
      `GitHub release lookup failed with status ${response.statusCode} ` +
        "(possibly rate-limited; try again later).",
    );
  }

  const data = await readBody(response);
  try {
    return JSON.parse(data) as GitHubRelease;
  } catch {
    throw new Error("Failed to parse GitHub release info");
  }
}

async function downloadText(url: string): Promise<string> {
  const response = await httpsGetFollowRedirects(url);
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Download failed with status ${response.statusCode} for ${url}`);
  }
  return readBody(response);
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await httpsGetFollowRedirects(url);

  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Download failed with status ${response.statusCode}`);
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    let settled = false;
    const fail = (err: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      file.close(() => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    // A response stream error would otherwise leave the promise pending
    // forever and a truncated file on disk.
    response.on("error", fail);
    file.on("error", fail);
    file.on("finish", () => {
      if (settled) {
        return;
      }
      settled = true;
      file.close(() => resolve());
    });
    response.pipe(file);
  });
}

async function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function validateBinary(binPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    child_process.execFile(binPath, ["--version"], { timeout: 15000 }, (error, stdout) => {
      if (error || !stdout.trim()) {
        reject(
          new Error(`Downloaded binary failed --version check: ${error?.message ?? "no output"}`),
        );
        return;
      }
      resolve();
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
      const destPath = getInstalledCliPath(context);
      const tmpPath = `${destPath}.tmp`;
      try {
        progress.report({ message: "Fetching release info..." });
        output.appendLine("Fetching latest release info from GitHub...");

        const release = await fetchLatestRelease();
        output.appendLine(`Latest version: ${release.tag_name}`);

        const asset = release.assets.find((a) => a.name === assetName);
        if (!asset) {
          throw new Error(`Binary ${assetName} not found in release ${release.tag_name}`);
        }

        const checksumAsset = release.assets.find((a) => a.name === `${assetName}.sha256`);
        if (!checksumAsset) {
          throw new Error(
            `Checksum asset ${assetName}.sha256 not found in release ${release.tag_name}; ` +
              "refusing to install an unverifiable binary.",
          );
        }

        progress.report({ message: "Downloading CLI..." });
        output.appendLine(`Downloading ${asset.name}...`);

        const binDir = getCliInstallDir(context);
        await mkdir(binDir, { recursive: true });

        // Download to a temp path first so a failed/truncated download can
        // never be mistaken for a valid install.
        await downloadFile(asset.browser_download_url, tmpPath);

        progress.report({ message: "Verifying checksum..." });
        const checksumContent = await downloadText(checksumAsset.browser_download_url);
        const expected = parseSha256File(checksumContent, assetName);
        if (!expected) {
          throw new Error(`Could not parse expected checksum from ${assetName}.sha256`);
        }
        const actual = await sha256OfFile(tmpPath);
        if (actual !== expected) {
          throw new Error(
            `Checksum mismatch for ${assetName}: expected ${expected}, got ${actual}. ` +
              "Aborting install.",
          );
        }
        output.appendLine(`Checksum verified (sha256: ${actual})`);

        progress.report({ message: "Setting permissions..." });

        if (os.platform() !== "win32") {
          await chmod(tmpPath, 0o755);
        }

        progress.report({ message: "Validating binary..." });
        await validateBinary(tmpPath);

        await fs.promises.rename(tmpPath, destPath);

        const config = vscode.workspace.getConfiguration("promptguard");
        await config.update("cliPath", destPath, vscode.ConfigurationTarget.Global);

        output.appendLine(`CLI installed at: ${destPath}`);
        output.appendLine("PromptGuard CLI installation complete!");
        void vscode.window.showInformationMessage(
          `PromptGuard CLI ${release.tag_name} installed successfully!`,
        );

        return destPath;
      } catch (error) {
        await fs.promises.rm(tmpPath, { force: true }).catch(() => {});
        output.appendLine(`Installation failed: ${errorMessage(error)}`);
        void vscode.window.showErrorMessage(
          `Failed to install PromptGuard CLI: ${errorMessage(error)}`,
        );
        return null;
      }
    },
  );
}
