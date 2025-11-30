import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { ExtensionError } from "../types";

export async function statusCommand(cli: CliWrapper, outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine("PromptGuard: Status");
  outputChannel.show(true);

  try {
    outputChannel.appendLine("Running: promptguard status...");
    const status = await cli.status();

    outputChannel.appendLine("\n📋 PromptGuard Status");
    outputChannel.appendLine("─".repeat(50));

    if (!status.initialized) {
      outputChannel.appendLine("Status: ⊘ Not initialized");
      outputChannel.appendLine("\nTo get started, run: PromptGuard: Initialize");
      vscode.window.showInformationMessage("PromptGuard is not initialized. Run 'PromptGuard: Initialize' to get started.");
      return;
    }

    outputChannel.appendLine(`Status: ${status.status === "active" ? "✓ Active" : "⊘ Disabled"}`);
    
    if (status.api_key) {
      const masked = status.api_key.length > 8
        ? `${status.api_key.substring(0, 4)}...${status.api_key.substring(status.api_key.length - 4)}`
        : "***";
      outputChannel.appendLine(`API Key: ${masked} (configured)`);
    }

    if (status.proxy_url) {
      outputChannel.appendLine(`Proxy URL: ${status.proxy_url}`);
    }

    if (status.configuration) {
      outputChannel.appendLine("\nConfiguration:");
      outputChannel.appendLine(`  • Config file: ${status.configuration.config_file}`);
      
      if (status.configuration.last_applied) {
        outputChannel.appendLine(`  • Last applied: ${status.configuration.last_applied}`);
      }
      
      outputChannel.appendLine(`  • Files managed: ${status.configuration.files_managed}`);
      
      if (status.configuration.providers && status.configuration.providers.length > 0) {
        outputChannel.appendLine(`  • Providers: ${status.configuration.providers.join(", ")}`);
      }
      
      if (status.configuration.framework) {
        outputChannel.appendLine(`  • Framework: ${status.configuration.framework}`);
      }
      
      outputChannel.appendLine(`  • Backup enabled: ${status.configuration.backup_enabled}`);
      outputChannel.appendLine(`  • Backups: ${status.configuration.backups}`);
    }

    outputChannel.appendLine("\nView full dashboard: https://app.promptguard.co/dashboard");
    outputChannel.appendLine("✓ Status retrieved successfully");

    const message = status.status === "active"
      ? "PromptGuard is active"
      :       "PromptGuard is disabled";
    vscode.window.showInformationMessage(message);
  } catch (error) {
    const err = error instanceof ExtensionError ? error : new ExtensionError(String(error), undefined, error);
    const message = err.message;
    outputChannel.appendLine(`✗ Error: ${message}`);
    vscode.window.showErrorMessage(`PromptGuard status failed: ${message}`);
  }
}

