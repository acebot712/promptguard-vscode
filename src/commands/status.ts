import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function statusCommand(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  output.appendLine("PromptGuard: Status");
  output.show(true);

  try {
    output.appendLine("Running: promptguard status...");
    const status = await cli.status();

    output.appendLine("\n📋 PromptGuard Status");
    output.appendLine("─".repeat(50));

    if (!status.initialized) {
      output.appendLine("Status: ⊘ Not initialized");
      output.appendLine("\nTo get started, run: PromptGuard: Initialize");
      void vscode.window.showInformationMessage(
        "PromptGuard is not initialized. Run 'PromptGuard: Initialize' to get started.",
      );
      return;
    }

    output.appendLine(`Status: ${status.status === "active" ? "✓ Active" : "⊘ Disabled"}`);

    if (status.api_key) {
      const masked =
        status.api_key.length > 8
          ? `${status.api_key.substring(0, 4)}...${status.api_key.substring(status.api_key.length - 4)}`
          : "***";
      output.appendLine(`API Key: ${masked} (configured)`);
    }

    if (status.proxy_url) {
      output.appendLine(`Proxy URL: ${status.proxy_url}`);
    }

    if (status.configuration) {
      output.appendLine("\nConfiguration:");
      output.appendLine(`  • Config file: ${status.configuration.config_file}`);

      if (status.configuration.last_applied) {
        output.appendLine(`  • Last applied: ${status.configuration.last_applied}`);
      }

      output.appendLine(`  • Files managed: ${status.configuration.files_managed}`);

      if (status.configuration.providers && status.configuration.providers.length > 0) {
        output.appendLine(`  • Providers: ${status.configuration.providers.join(", ")}`);
      }

      if (status.configuration.framework) {
        output.appendLine(`  • Framework: ${status.configuration.framework}`);
      }

      output.appendLine(`  • Backup enabled: ${status.configuration.backup_enabled}`);
      output.appendLine(`  • Backups: ${status.configuration.backups.length}`);
    }

    output.appendLine("\nView full dashboard: https://app.promptguard.co/dashboard");
    output.appendLine("✓ Status retrieved successfully");

    const message =
      status.status === "active" ? "PromptGuard is active" : "PromptGuard is disabled";
    void vscode.window.showInformationMessage(message);
  } catch (error) {
    output.appendLine(`✗ Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(`PromptGuard status failed: ${errorMessage(error)}`);
  }
}
