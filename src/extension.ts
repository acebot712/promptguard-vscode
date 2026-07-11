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
import { selectProjectCommand } from "./commands/selectProject";
import { installCliCommand } from "./commands/installCli";
import { SUPPORTED_LANGUAGES } from "./utils";

const STATUS_SAVE_DEBOUNCE_MS = 5000;

export function activate(context: vscode.ExtensionContext): void {
  const secrets = new SecretsManager(context);
  const cli = new CliWrapper();
  const outputChannel = vscode.window.createOutputChannel("PromptGuard");
  context.subscriptions.push(outputChannel);

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
    vscode.commands.registerCommand("promptguard.selectProject", () =>
      selectProjectCommand(cli, outputChannel),
    ),
    vscode.commands.registerCommand("promptguard.installCli", () =>
      installCliCommand(context, cli, outputChannel),
    ),
  );

  // Debounce status-bar refreshes on save: updateStatus() spawns the CLI, so
  // running it on every save (of any file type) is wasteful and noisy.
  let statusSaveTimer: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    new vscode.Disposable(() => {
      if (statusSaveTimer) {
        clearTimeout(statusSaveTimer);
        statusSaveTimer = undefined;
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void statusBar.updateStatus();
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!SUPPORTED_LANGUAGES.includes(document.languageId)) {
        return;
      }
      if (statusSaveTimer) {
        clearTimeout(statusSaveTimer);
      }
      statusSaveTimer = setTimeout(() => {
        statusSaveTimer = undefined;
        void statusBar.updateStatus();
      }, STATUS_SAVE_DEBOUNCE_MS);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("promptguard.cliPath")) {
        cli.resetCache();
        void statusBar.updateStatus();
        void diagnostics.scanAllWorkspaceFolders();
      }
    }),
  );

  if ((vscode.workspace.workspaceFolders?.length ?? 0) > 1) {
    outputChannel.appendLine(
      "Multi-root workspace detected: SDK diagnostics cover every folder; the status bar and " +
        "tree view reflect the first workspace folder only.",
    );
  }

  // Resolve/install the CLI BEFORE the first scan so the initial scan does not
  // race CLI installation and silently no-op.
  void (async () => {
    await checkCliInstallation(context, cli, outputChannel);
    void statusBar.updateStatus();
    void diagnostics.scanAllWorkspaceFolders();
  })();

  outputChannel.appendLine("PromptGuard extension activated");

  void showFirstRunNotice(context);
}

const FIRST_RUN_NOTICE_KEY = "promptguard.firstRunNoticeShown";

async function showFirstRunNotice(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(FIRST_RUN_NOTICE_KEY)) {
    return;
  }
  await context.globalState.update(FIRST_RUN_NOTICE_KEY, true);
  void vscode.window.showInformationMessage(
    "PromptGuard is active — open the shield icon in the Activity Bar to scan your project.",
  );
}

async function checkCliInstallation(
  context: vscode.ExtensionContext,
  cli: CliWrapper,
  output: vscode.OutputChannel,
): Promise<void> {
  // findCliBinary() resolves to null (it does not throw) when nothing is found.
  const foundPath = await cli.findCliBinary().catch(() => null);
  if (foundPath) {
    output.appendLine("PromptGuard CLI found");
    return;
  }

  if (isCliInstalled(context)) {
    const installedPath = getInstalledCliPath(context);
    const config = vscode.workspace.getConfiguration("promptguard");
    await config.update("cliPath", installedPath, vscode.ConfigurationTarget.Global);
    output.appendLine(`Using installed CLI at: ${installedPath}`);
    cli.resetCache();
    return;
  }

  const autoInstall = vscode.workspace
    .getConfiguration("promptguard")
    .get<string>("autoInstallCli", "prompt");

  if (autoInstall === "never") {
    output.appendLine(
      "PromptGuard CLI not found. Auto-install is disabled (promptguard.autoInstallCli=never). " +
        "Set 'promptguard.cliPath' to the binary location.",
    );
    return;
  }

  if (autoInstall === "auto") {
    output.appendLine(
      "PromptGuard CLI not found. Installing silently (promptguard.autoInstallCli=auto)...",
    );
    const installedPath = await installCli(context, output);
    if (installedPath) {
      cli.resetCache();
    }
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
    // Pre-fill the command WITHOUT executing it (addNewLine=false): the user
    // reviews the curl|sh line and presses Enter themselves.
    terminal.sendText(
      "curl -fsSL https://raw.githubusercontent.com/acebot712/promptguard-cli/main/install.sh | sh",
      false,
    );
    output.appendLine(
      "Opened terminal with the install command pre-filled. Review it and press Enter to run.",
    );
  } else if (result === "Configure Path") {
    void vscode.commands.executeCommand("workbench.action.openSettings", "promptguard.cliPath");
  }
}

export function deactivate(): void {
  // Disposed via context.subscriptions
}
