import * as vscode from "vscode";
import { CliWrapper } from "./cli";
import { PromptGuardDiagnostics } from "./diagnostics";
import { PromptGuardStatusBar } from "./statusBar";
import { initCommand } from "./commands/init";
import { scanCommand } from "./commands/scan";
import { statusCommand } from "./commands/status";
import { applyCommand } from "./commands/apply";
import { disableCommand } from "./commands/disable";
import { enableCommand } from "./commands/enable";

let diagnostics: PromptGuardDiagnostics;
let statusBar: PromptGuardStatusBar;
let cli: CliWrapper;
let outputChannel: vscode.OutputChannel;

// Module-level status bar reference for commands
let statusBarRef: PromptGuardStatusBar | null = null;

export function getStatusBar(): PromptGuardStatusBar | null {
  return statusBarRef;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("PromptGuard extension is now active");

  // Initialize CLI wrapper
  cli = new CliWrapper();

  // Create output channel
  outputChannel = vscode.window.createOutputChannel("PromptGuard");
  context.subscriptions.push(outputChannel);

  // Initialize diagnostics
  diagnostics = new PromptGuardDiagnostics(cli);
  diagnostics.activate(context);
  context.subscriptions.push(diagnostics);

  // Initialize status bar
  statusBar = new PromptGuardStatusBar(cli);
  context.subscriptions.push(statusBar);
  statusBarRef = statusBar;

  // Update status bar on workspace changes (event-driven, not polling)
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    statusBar.updateStatus();
  });
  context.subscriptions.push(workspaceWatcher);

  // Update status bar when files change (event-driven)
  const fileWatcher = vscode.workspace.onDidSaveTextDocument(() => {
    statusBar.updateStatus();
  });
  context.subscriptions.push(fileWatcher);

  // Initial status update
  statusBar.updateStatus();

  // Register commands
  const commands = [
    vscode.commands.registerCommand("promptguard.init", () => initCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.scan", () => scanCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.status", () => statusCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.apply", () => applyCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.disable", () => disableCommand(cli, outputChannel)),
    vscode.commands.registerCommand("promptguard.enable", () => enableCommand(cli, outputChannel)),
  ];

  context.subscriptions.push(...commands);

  // Listen for configuration changes
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("promptguard.cliPath")) {
      cli.resetCache();
      statusBar.updateStatus();
    }
  });
  context.subscriptions.push(configWatcher);

  outputChannel.appendLine("PromptGuard extension activated");
}

export function deactivate() {
  statusBarRef = null;
  if (diagnostics) {
    diagnostics.dispose();
  }
  if (statusBar) {
    statusBar.dispose();
  }
}

