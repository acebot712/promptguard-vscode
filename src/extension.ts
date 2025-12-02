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

let diagnostics: PromptGuardDiagnostics | null = null;
let statusBar: PromptGuardStatusBar | null = null;
let cli: CliWrapper | null = null;
let outputChannel: vscode.OutputChannel | null = null;

export function getStatusBar(): PromptGuardStatusBar | null {
  return statusBar;
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

  // Update status bar on workspace changes (event-driven, not polling)
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    statusBar?.updateStatus();
  });
  context.subscriptions.push(workspaceWatcher);

  // Update status bar when files change (event-driven)
  const fileWatcher = vscode.workspace.onDidSaveTextDocument(() => {
    statusBar?.updateStatus();
  });
  context.subscriptions.push(fileWatcher);

  // Initial status update
  statusBar.updateStatus();

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
  ];

  context.subscriptions.push(...commands);

  // Listen for configuration changes
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("promptguard.cliPath")) {
      cli?.resetCache();
      statusBar?.updateStatus();
    }
  });
  context.subscriptions.push(configWatcher);

  outputChannel.appendLine("PromptGuard extension activated");
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

