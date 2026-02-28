import * as vscode from "vscode";
import { CliWrapper } from "../cli";

export async function scanCommand(
  cli: CliWrapper,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  outputChannel.appendLine("PromptGuard: Scanning for LLM SDKs");
  outputChannel.show(true);

  try {
    outputChannel.appendLine("Running: promptguard scan...");
    const result = await cli.scan();

    outputChannel.appendLine("\n📊 LLM SDK Detection Report");
    outputChannel.appendLine("─".repeat(50));
    outputChannel.appendLine(`Total files scanned: ${result.total_files_scanned}`);
    outputChannel.appendLine(`Files with SDKs: ${result.files_with_sdks}`);
    outputChannel.appendLine(`Total instances: ${result.total_instances}`);

    if (result.providers.length === 0) {
      outputChannel.appendLine("\nNo LLM SDKs detected.");
      vscode.window.showInformationMessage("No LLM SDKs detected in this project");
      return;
    }

    outputChannel.appendLine("\nProviders detected:");
    for (const provider of result.providers) {
      outputChannel.appendLine(`\n  • ${provider.name} SDK`);
      outputChannel.appendLine(`    Files: ${provider.file_count}`);
      outputChannel.appendLine(`    Instances: ${provider.instance_count}`);
      if (provider.files.length > 0) {
        outputChannel.appendLine(`    Files:`);
        for (const file of provider.files.slice(0, 10)) {
          outputChannel.appendLine(`      - ${file}`);
        }
        if (provider.files.length > 10) {
          outputChannel.appendLine(`      ... and ${provider.files.length - 10} more`);
        }
      }
    }

    outputChannel.appendLine("\n✓ Scan completed");
    vscode.window.showInformationMessage(
      `Found ${result.providers.length} LLM provider(s) in ${result.files_with_sdks} file(s)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`✗ Error: ${message}`);
    void vscode.window.showErrorMessage(`PromptGuard scan failed: ${message}`);
  }
}
