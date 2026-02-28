import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { registerCodeActionProvider } from "./codeActions";
import { installCli, isCliInstalled, getInstalledCliPath } from "./cliInstaller";
import { PromptGuardDiagnostics } from "./diagnostics";
import { initSecretsManager, getSecretsManager } from "./secrets";
import { PromptGuardStatusBar } from "./statusBar";
import { registerTreeView } from "./treeView";
import { initCommand } from "./commands/init";
import { scanCommand } from "./commands/scan";
import { statusCommand } from "./commands/status";
import { applyCommand } from "./commands/apply";
import { disableCommand } from "./commands/disable";
import { enableCommand } from "./commands/enable";

let diagnostics: PromptGuardDiagnostics | null = null;
let statusBar: PromptGuardStatusBar | null = null;
let cli: CliWrapper | null = null;
let outputChannel: vscode.OutputChannel | null = null;
let extensionContext: vscode.ExtensionContext | null = null;

export function getStatusBar(): PromptGuardStatusBar | null {
  return statusBar;
}

export function getExtensionContext(): vscode.ExtensionContext | null {
  return extensionContext;
}

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;

  // Initialize secrets manager for secure API key storage
  initSecretsManager(context);

  // Initialize CLI wrapper
  cli = new CliWrapper();

  // Create output channel
  outputChannel = vscode.window.createOutputChannel("PromptGuard");
  context.subscriptions.push(outputChannel);

  // Check if CLI is installed and show helpful message if not
  void checkCliInstallation(cli, outputChannel);

  // Initialize diagnostics
  diagnostics = new PromptGuardDiagnostics(cli);
  diagnostics.activate(context);
  context.subscriptions.push(diagnostics);

  // Initialize status bar
  statusBar = new PromptGuardStatusBar(cli);
  context.subscriptions.push(statusBar);

  // Register code action provider for quick fixes
  registerCodeActionProvider(context, cli, outputChannel);

  // Register sidebar tree view
  registerTreeView(context, cli);

  // Update status bar on workspace changes (event-driven, not polling)
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    void statusBar?.updateStatus();
  });
  context.subscriptions.push(workspaceWatcher);

  // Update status bar when files change (event-driven)
  const fileWatcher = vscode.workspace.onDidSaveTextDocument(() => {
    void statusBar?.updateStatus();
  });
  context.subscriptions.push(fileWatcher);

  // Initial status update
  void statusBar.updateStatus();

  // Register commands - capture references to avoid null checks in closures
  const cliRef = cli;
  const outputRef = outputChannel;

  const commands = [
    vscode.commands.registerCommand("promptguard.init", () => initCommand(cliRef, outputRef)),
    vscode.commands.registerCommand("promptguard.scan", () => scanCommand(cliRef, outputRef)),
    vscode.commands.registerCommand("promptguard.status", () => statusCommand(cliRef, outputRef)),
    vscode.commands.registerCommand("promptguard.apply", () => applyCommand(cliRef, outputRef)),
    vscode.commands.registerCommand("promptguard.disable", () => disableCommand(cliRef, outputRef)),
    vscode.commands.registerCommand("promptguard.enable", () => enableCommand(cliRef, outputRef)),

    // New commands for scanning/redacting selected text
    vscode.commands.registerCommand("promptguard.scanSelection", () =>
      scanSelectionCommand(cliRef, outputRef),
    ),
    vscode.commands.registerCommand("promptguard.redactSelection", () =>
      redactSelectionCommand(cliRef, outputRef),
    ),
    vscode.commands.registerCommand("promptguard.scanFile", (uri?: vscode.Uri) =>
      scanFileCommand(cliRef, outputRef, uri),
    ),

    // API key management command
    vscode.commands.registerCommand("promptguard.setApiKey", () => setApiKeyCommand()),

    // CLI installation command
    vscode.commands.registerCommand("promptguard.installCli", () => installCliCommand(outputRef)),
  ];

  context.subscriptions.push(...commands);

  // Listen for configuration changes
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("promptguard.cliPath")) {
      cli?.resetCache();
      void statusBar?.updateStatus();
    }
  });
  context.subscriptions.push(configWatcher);

  outputChannel.appendLine("PromptGuard extension activated");
}

/**
 * Scan selected text for security threats via the PromptGuard API.
 */
async function scanSelectionCommand(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    void vscode.window.showWarningMessage(
      "No text selected. Select text to scan for security threats.",
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptGuard: Scanning for threats...",
      cancellable: false,
    },
    async (progress) => {
      try {
        output.appendLine(`Scanning selected text (${selectedText.length} characters)...`);
        output.show();

        progress.report({ increment: 30, message: "Analyzing content..." });

        // Use CLI to scan text
        const result = await cli.scanText(selectedText);

        progress.report({ increment: 70, message: "Complete" });

        output.appendLine(`Decision: ${result.decision}`);
        output.appendLine(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

        if (result.threat_type) {
          output.appendLine(`Threat Type: ${result.threat_type}`);
        }
        if (result.reason) {
          output.appendLine(`Reason: ${result.reason}`);
        }

        if (result.decision === "block") {
          void vscode.window.showWarningMessage(
            `Security threat detected: ${result.threat_type || "Unknown"} (${(result.confidence * 100).toFixed(0)}% confidence)`,
          );
        } else {
          void vscode.window.showInformationMessage(
            "No security threats detected in selected text.",
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`Error: ${message}`);
        void vscode.window.showErrorMessage(`Scan failed: ${message}`);
      }
    },
  );
}

/**
 * Redact PII from selected text via the PromptGuard API.
 */
async function redactSelectionCommand(
  cli: CliWrapper,
  output: vscode.OutputChannel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    void vscode.window.showWarningMessage("No text selected. Select text to redact PII.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptGuard: Redacting PII...",
      cancellable: false,
    },
    async (progress) => {
      try {
        output.appendLine(
          `Redacting PII from selected text (${selectedText.length} characters)...`,
        );
        output.show();

        progress.report({ increment: 30, message: "Detecting sensitive data..." });

        // Use CLI to redact text
        const result = await cli.redactText(selectedText);

        progress.report({ increment: 50, message: "Applying redactions..." });

        output.appendLine(`Entities found: ${result.entity_count}`);
        for (const entity of result.entities_found) {
          output.appendLine(`  • ${entity.type}: ${entity.original} → ${entity.replacement}`);
        }

        if (result.entity_count > 0) {
          // Replace selected text with redacted version
          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, result.redacted_text);
          });

          progress.report({ increment: 20, message: "Complete" });
          void vscode.window.showInformationMessage(
            `Redacted ${result.entity_count} sensitive entities.`,
          );
        } else {
          progress.report({ increment: 20, message: "Complete" });
          void vscode.window.showInformationMessage(
            "No sensitive entities found in selected text.",
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`Error: ${message}`);
        void vscode.window.showErrorMessage(`Redaction failed: ${message}`);
      }
    },
  );
}

/**
 * Scan a specific file for security threats.
 */
async function scanFileCommand(
  cli: CliWrapper,
  output: vscode.OutputChannel,
  uri?: vscode.Uri,
): Promise<void> {
  const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
  if (!fileUri) {
    void vscode.window.showWarningMessage("No file to scan");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptGuard: Scanning file...",
      cancellable: false,
    },
    async (progress) => {
      try {
        output.appendLine(`Scanning file: ${fileUri.fsPath}`);
        output.show();

        progress.report({ increment: 20, message: "Reading file..." });

        // Read file content
        const document = await vscode.workspace.openTextDocument(fileUri);
        const content = document.getText();

        progress.report({ increment: 30, message: "Analyzing content..." });

        // Scan via CLI
        const result = await cli.scanText(content);

        progress.report({ increment: 50, message: "Complete" });

        output.appendLine(`Decision: ${result.decision}`);
        output.appendLine(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);

        if (result.decision === "block") {
          void vscode.window.showWarningMessage(
            `Security threat detected in file: ${result.threat_type || "Unknown"}`,
          );
        } else {
          void vscode.window.showInformationMessage("No security threats detected in file.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`Error: ${message}`);
        void vscode.window.showErrorMessage(`File scan failed: ${message}`);
      }
    },
  );
}

/**
 * Check if the PromptGuard CLI is installed and offer to install it automatically if not.
 */
async function checkCliInstallation(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  const context = getExtensionContext();
  if (!context) {
    return;
  }

  try {
    await cli.findCliBinary();
    output.appendLine("PromptGuard CLI found");
  } catch {
    // First, check if we have a bundled/downloaded CLI in extension storage
    if (isCliInstalled(context)) {
      // Use the installed CLI
      const installedPath = getInstalledCliPath(context);
      const config = vscode.workspace.getConfiguration("promptguard");
      await config.update("cliPath", installedPath, vscode.ConfigurationTarget.Global);
      output.appendLine(`Using installed CLI at: ${installedPath}`);
      cli.resetCache();
      return;
    }

    // CLI not found - offer to download automatically
    const installAction = "Install Now";
    const manualAction = "Install Manually";
    const configureAction = "Configure Path";

    const result = await vscode.window.showWarningMessage(
      "PromptGuard CLI not found. Would you like to install it automatically?",
      installAction,
      manualAction,
      configureAction,
    );

    if (result === installAction) {
      // Download and install CLI automatically
      const installedPath = await installCli(context, output);
      if (installedPath) {
        cli.resetCache();
      }
    } else if (result === manualAction) {
      // Open terminal and run install script
      const terminal = vscode.window.createTerminal("PromptGuard Install");
      terminal.show();
      terminal.sendText(
        "curl -fsSL https://raw.githubusercontent.com/acebot712/promptguard-cli/main/install.sh | sh",
      );
      output.appendLine("Opened terminal to install PromptGuard CLI");
    } else if (result === configureAction) {
      // Open settings to configure CLI path
      void vscode.commands.executeCommand("workbench.action.openSettings", "promptguard.cliPath");
    }
  }
}

/**
 * Command to install or update the PromptGuard CLI.
 */
async function installCliCommand(output: vscode.OutputChannel): Promise<void> {
  const context = getExtensionContext();
  if (!context) {
    void vscode.window.showErrorMessage("Extension context not available");
    return;
  }

  const installed = isCliInstalled(context);

  if (installed) {
    const choice = await vscode.window.showQuickPick(["Reinstall CLI", "Cancel"], {
      placeHolder: "PromptGuard CLI is already installed. What would you like to do?",
    });

    if (choice !== "Reinstall CLI") {
      return;
    }
  }

  const installedPath = await installCli(context, output);
  if (installedPath && cli) {
    cli.resetCache();
    void statusBar?.updateStatus();
  }
}

/**
 * Command to set/update the API key securely.
 */
async function setApiKeyCommand(): Promise<void> {
  try {
    const secrets = getSecretsManager();
    const existingKey = await secrets.getApiKey();

    if (existingKey) {
      const choice = await vscode.window.showQuickPick(
        ["Update API key", "Delete API key", "Cancel"],
        { placeHolder: "An API key is already stored. What would you like to do?" },
      );

      if (choice === "Update API key") {
        await secrets.promptAndStoreApiKey();
      } else if (choice === "Delete API key") {
        await secrets.deleteApiKey();
        void vscode.window.showInformationMessage("API key deleted.");
      }
    } else {
      await secrets.promptAndStoreApiKey();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Failed to manage API key: ${message}`);
  }
}

export function deactivate() {
  if (diagnostics) {
    diagnostics.dispose();
    diagnostics = null;
  }
  if (statusBar) {
    statusBar.dispose();
    statusBar = null;
  }
  cli = null;
  outputChannel = null;
}
