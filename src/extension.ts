import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { registerCodeActionProvider } from "./codeActions";
import { installCli, isCliInstalled, getInstalledCliPath } from "./cliInstaller";
import { PromptGuardDiagnostics } from "./diagnostics";
import { SecretsManager } from "./secrets";
import { PromptGuardStatusBar } from "./statusBar";
import { registerTreeView } from "./treeView";
import { initCommand } from "./commands/init";
import { scanCommand } from "./commands/scan";
import { statusCommand } from "./commands/status";
import { applyCommand } from "./commands/apply";
import { disableCommand } from "./commands/disable";
import { enableCommand } from "./commands/enable";
import { scanSelectionCommand } from "./commands/scanSelection";
import { redactSelectionCommand } from "./commands/redactSelection";
import { scanFileCommand } from "./commands/scanFile";
import { setApiKeyCommand } from "./commands/setApiKey";
import { installCliCommand } from "./commands/installCli";

export function activate(context: vscode.ExtensionContext): void {
  const secrets = new SecretsManager(context);
  const cli = new CliWrapper();
  const outputChannel = vscode.window.createOutputChannel("PromptGuard");
  context.subscriptions.push(outputChannel);

  void checkCliInstallation(context, cli, outputChannel);

  const diagnostics = new PromptGuardDiagnostics(cli);
  diagnostics.activate(context);
  context.subscriptions.push(diagnostics);

  const statusBar = new PromptGuardStatusBar(cli);
  context.subscriptions.push(statusBar);

  const treeDataProvider = registerTreeView(context, cli);

  registerCodeActionProvider(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("promptguard.refreshUI", () => {
      void statusBar.updateStatus();
      treeDataProvider.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("promptguard.init", () =>
      initCommand(cli, outputChannel, secrets),
    ),
    vscode.commands.registerCommand("promptguard.scan", () => scanCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.status", () => statusCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.apply", () => applyCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.disable", () =>
      disableCommand(cli, outputChannel),
    ),
    vscode.commands.registerCommand("promptguard.enable", () => enableCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.scanSelection", () =>
      scanSelectionCommand(cli, outputChannel),
    ),
    vscode.commands.registerCommand("promptguard.redactSelection", () =>
      redactSelectionCommand(cli, outputChannel),
    ),
    vscode.commands.registerCommand("promptguard.scanFile", (uri?: vscode.Uri) =>
      scanFileCommand(cli, outputChannel, uri),
    ),
    vscode.commands.registerCommand("promptguard.setApiKey", () => setApiKeyCommand(secrets)),
    vscode.commands.registerCommand("promptguard.installCli", () =>
      installCliCommand(context, cli, outputChannel),
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void statusBar.updateStatus();
    }),
    vscode.workspace.onDidSaveTextDocument(() => {
      void statusBar.updateStatus();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("promptguard.cliPath")) {
        cli.resetCache();
        void statusBar.updateStatus();
      }
    }),
  );

  void statusBar.updateStatus();
  outputChannel.appendLine("PromptGuard extension activated");
}

async function checkCliInstallation(
  context: vscode.ExtensionContext,
  cli: CliWrapper,
  output: vscode.OutputChannel,
): Promise<void> {
  try {
    await cli.findCliBinary();
    output.appendLine("PromptGuard CLI found");
  } catch {
    if (isCliInstalled(context)) {
      const installedPath = getInstalledCliPath(context);
      const config = vscode.workspace.getConfiguration("promptguard");
      await config.update("cliPath", installedPath, vscode.ConfigurationTarget.Global);
      output.appendLine(`Using installed CLI at: ${installedPath}`);
      cli.resetCache();
      return;
    }

    const result = await vscode.window.showWarningMessage(
      "PromptGuard CLI not found. Would you like to install it automatically?",
      "Install Now",
      "Install Manually",
      "Configure Path",
    );

    if (result === "Install Now") {
      const installedPath = await installCli(context, output);
      if (installedPath) {
        cli.resetCache();
      }
    } else if (result === "Install Manually") {
      const terminal = vscode.window.createTerminal("PromptGuard Install");
      terminal.show();
      terminal.sendText(
        "curl -fsSL https://raw.githubusercontent.com/acebot712/promptguard-cli/main/install.sh | sh",
      );
      output.appendLine("Opened terminal to install PromptGuard CLI");
    } else if (result === "Configure Path") {
      void vscode.commands.executeCommand("workbench.action.openSettings", "promptguard.cliPath");
    }
  }
}

export function deactivate(): void {
  // Disposed via context.subscriptions
}
