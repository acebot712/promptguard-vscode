import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { errorMessage } from "../utils";

export async function selectProjectCommand(
  cli: CliWrapper,
  output: vscode.OutputChannel,
): Promise<void> {
  output.appendLine("PromptGuard: Fetching projects...");
  output.show(true);

  try {
    const result = await cli.listProjects();

    if (!result.projects || result.projects.length === 0) {
      void vscode.window.showInformationMessage(
        "No projects found. Create a project in the PromptGuard dashboard first.",
      );
      return;
    }

    const items = result.projects.map((p) => ({
      label: p.name,
      description: p.id === result.active_project ? "(active)" : p.id,
      detail: p.description,
      projectId: p.id,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a project for this workspace",
      title: "PromptGuard: Select Project",
    });

    if (!selected) {
      return;
    }

    await cli.selectProject(selected.projectId);

    output.appendLine(`Selected project: ${selected.label} (${selected.projectId})`);
    void vscode.window.showInformationMessage(`PromptGuard project set to "${selected.label}"`);
  } catch (error) {
    output.appendLine(`Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(`Failed to select project: ${errorMessage(error)}`);
  }
}
