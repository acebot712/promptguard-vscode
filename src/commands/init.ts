import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { SecretsManager } from "../secrets";
import { errorMessage } from "../utils";

export async function initCommand(
  cli: CliWrapper,
  output: vscode.OutputChannel,
  secrets: SecretsManager,
): Promise<void> {
  output.appendLine("PromptGuard: Initialize");
  output.show(true);

  try {
    let apiKey: string | undefined;

    const existingKey = await secrets.getApiKey();
    if (existingKey) {
      const choice = await vscode.window.showQuickPick(
        [
          { label: "Use stored API key", value: "use_stored" },
          { label: "Enter a new API key", value: "new_key" },
          { label: "Cancel", value: "cancel" },
        ],
        {
          placeHolder: "A PromptGuard API key is already stored.",
          ignoreFocusOut: true,
        },
      );

      if (!choice || choice.value === "cancel") {
        return;
      }

      if (choice.value === "use_stored") {
        apiKey = existingKey;
      }
    }

    if (!apiKey) {
      const hasApiKey = await vscode.window.showQuickPick(
        [
          { label: "I have an API key", value: "has_key" },
          { label: "Sign up / Get API key", value: "signup" },
          { label: "Cancel", value: "cancel" },
        ],
        {
          placeHolder: "Do you have a PromptGuard API key?",
          ignoreFocusOut: true,
        },
      );

      if (!hasApiKey || hasApiKey.value === "cancel") {
        return;
      }

      if (hasApiKey.value === "signup") {
        const openSignup = await vscode.window.showInformationMessage(
          "Open PromptGuard signup page?",
          "Open Browser",
          "Cancel",
        );

        if (openSignup === "Open Browser") {
          void vscode.env.openExternal(vscode.Uri.parse("https://app.promptguard.co/signup"));
        }

        const continueAfterSignup = await vscode.window.showQuickPick(
          [
            { label: "I have my API key now", value: "continue" },
            { label: "Cancel", value: "cancel" },
          ],
          {
            placeHolder: "Have you signed up and got your API key?",
            ignoreFocusOut: true,
          },
        );

        if (!continueAfterSignup || continueAfterSignup.value === "cancel") {
          return;
        }
      }

      apiKey = await secrets.promptAndStoreApiKey();
      if (!apiKey) {
        void vscode.window.showWarningMessage("Initialization cancelled: API key required");
        return;
      }
    }

    const providerOptions = [
      { label: "All providers", value: "all" },
      { label: "OpenAI", value: "openai" },
      { label: "Anthropic", value: "anthropic" },
      { label: "Cohere", value: "cohere" },
      { label: "HuggingFace", value: "huggingface" },
      { label: "Gemini (Google)", value: "gemini" },
      { label: "Groq", value: "groq" },
      { label: "AWS Bedrock", value: "bedrock" },
    ];

    const selectedProviders = await vscode.window.showQuickPick(providerOptions, {
      placeHolder: "Select providers to configure (or press Escape to use all)",
      canPickMany: true,
    });

    const providers =
      selectedProviders && selectedProviders.length > 0
        ? selectedProviders.map((p) => p.value)
        : undefined;

    output.appendLine("Running: promptguard init...");

    await cli.init({
      apiKey,
      provider: providers,
      auto: true,
    });

    output.appendLine("✓ PromptGuard initialized successfully");
    void vscode.window.showInformationMessage("PromptGuard initialized successfully");
    void vscode.commands.executeCommand("promptguard.refreshUI");
  } catch (error) {
    output.appendLine(`✗ Error: ${errorMessage(error)}`);
    void vscode.window.showErrorMessage(
      `PromptGuard initialization failed: ${errorMessage(error)}`,
    );
  }
}
