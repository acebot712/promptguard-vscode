import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { installCli, isCliInstalled } from "../cliInstaller";

export async function installCliCommand(
  context: vscode.ExtensionContext,
  cli: CliWrapper,
  output: vscode.OutputChannel,
): Promise<void> {
  if (isCliInstalled(context)) {
    const choice = await vscode.window.showQuickPick(["Reinstall CLI", "Cancel"], {
      placeHolder: "PromptGuard CLI is already installed. What would you like to do?",
    });

    if (choice !== "Reinstall CLI") {
      return;
    }
  }

  const installedPath = await installCli(context, output);
  if (installedPath) {
    cli.resetCache();
    void vscode.commands.executeCommand("promptguard.refreshUI");
  }
}
