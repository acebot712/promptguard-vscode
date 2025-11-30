import * as vscode from "vscode";
import { CliWrapper } from "../cli";
import { getStatusBar } from "../extension";
import { ExtensionError } from "../types";

export async function initCommand(cli: CliWrapper, outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine("PromptGuard: Initialize");
  outputChannel.show(true);

  try {
    // Check if user has API key, offer signup if not
    const hasApiKey = await vscode.window.showQuickPick(
      [
        { label: "I have an API key", value: "has_key" },
        { label: "Sign up / Get API key", value: "signup" },
        { label: "Cancel", value: "cancel" },
      ],
      {
        placeHolder: "Do you have a PromptGuard API key?",
        ignoreFocusOut: true,
      }
    );

    if (!hasApiKey || hasApiKey.value === "cancel") {
      return;
    }

    if (hasApiKey.value === "signup") {
      const openSignup = await vscode.window.showInformationMessage(
        "Open PromptGuard signup page?",
        "Open Browser",
        "Cancel"
      );

      if (openSignup === "Open Browser") {
        vscode.env.openExternal(vscode.Uri.parse("https://app.promptguard.co/signup"));
      }

      // After opening browser, ask if they want to continue
      const continueAfterSignup = await vscode.window.showQuickPick(
        [
          { label: "I have my API key now", value: "continue" },
          { label: "Cancel", value: "cancel" },
        ],
        {
          placeHolder: "Have you signed up and got your API key?",
          ignoreFocusOut: true,
        }
      );

      if (!continueAfterSignup || continueAfterSignup.value === "cancel") {
        return;
      }
    }

    // Prompt for API key
    const apiKey = await vscode.window.showInputBox({
      prompt: "Enter your PromptGuard API key",
      placeHolder: "pg_sk_...",
      ignoreFocusOut: true,
      password: true,
    });

    if (!apiKey) {
      vscode.window.showWarningMessage("Initialization cancelled: API key required");
      return;
    }

    // Optional: Select providers
    const providerOptions = [
      { label: "All providers", value: "all" },
      { label: "OpenAI", value: "openai" },
      { label: "Anthropic", value: "anthropic" },
      { label: "Cohere", value: "cohere" },
      { label: "HuggingFace", value: "huggingface" },
    ];

    const selectedProviders = await vscode.window.showQuickPick(providerOptions, {
      placeHolder: "Select providers to configure (or press Escape to use all)",
      canPickMany: true,
    });

    const providers = selectedProviders && selectedProviders.length > 0
      ? selectedProviders.map(p => p.value)
      : undefined;

    outputChannel.appendLine("Running: promptguard init...");

    await cli.init({
      apiKey,
      provider: providers,
      auto: true, // Auto-confirm to avoid blocking
    });

    outputChannel.appendLine("✓ PromptGuard initialized successfully");
    vscode.window.showInformationMessage("PromptGuard initialized successfully");

    // Refresh status
    const statusBar = getStatusBar();
    if (statusBar) {
      await statusBar.updateStatus();
    }
  } catch (error) {
    const err = error instanceof ExtensionError ? error : new ExtensionError(String(error), undefined, error);
    const message = err.message;
    outputChannel.appendLine(`✗ Error: ${message}`);
    vscode.window.showErrorMessage(`PromptGuard initialization failed: ${message}`);
  }
}

