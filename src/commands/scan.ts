import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function scanCommand(cli: CliWrapper, output: vscode.OutputChannel): Promise<void> {
  output.appendLine("PromptGuard: Scanning for LLM SDKs");
  output.show(true);

  try {
    output.appendLine("Running: promptguard scan...");
    const result = await cli.scan();

    output.appendLine("\n📊 LLM SDK Detection Report");
    output.appendLine("─".repeat(50));
    output.appendLine(`Total files scanned: ${result.total_files_scanned}`);
    output.appendLine(`Files with SDKs: ${result.files_with_sdks}`);
    output.appendLine(`Total instances: ${result.total_instances}`);

    if (result.providers.length === 0) {
      output.appendLine("\nNo LLM SDKs detected.");
      void vscode.window.showInformationMessage("No LLM SDKs detected in this project");
      return;
    }

    output.appendLine("\nProviders detected:");
    for (const provider of result.providers) {
      output.appendLine(`\n  • ${provider.name} SDK`);
      output.appendLine(`    Files: ${provider.file_count}`);
      output.appendLine(`    Instances: ${provider.instance_count}`);
      if (provider.files.length > 0) {
        output.appendLine(`    Files:`);
        for (const file of provider.files.slice(0, 10)) {
          output.appendLine(`      - ${file}`);
        }
        if (provider.files.length > 10) {
          output.appendLine(`      ... and ${provider.files.length - 10} more`);
        }
      }
    }

    output.appendLine("\n✓ Scan completed");
    void vscode.window.showInformationMessage(
      `Found ${result.providers.length} LLM provider(s) in ${result.files_with_sdks} file(s)`,
    );
  } catch (error) {
    output.appendLine(`✗ Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(`PromptGuard scan failed: ${errorMessage(error)}`);
  }
}
