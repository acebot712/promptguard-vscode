import * as vscode from "vscode";

export const SUPPORTED_LANGUAGES: string[] = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
  "python",
];

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const BILLING_URL = "https://app.promptguard.co/billing";

export async function handleQuotaError(error: unknown): Promise<boolean> {
  const msg = errorMessage(error).toLowerCase();
  if (!msg.includes("quota exceeded") && !msg.includes("quota_exceeded")) {
    return false;
  }

  const action = await vscode.window.showWarningMessage(
    "You've exceeded your PromptGuard plan quota. Upgrade to continue using security features.",
    "Upgrade Plan",
    "Dismiss",
  );

  if (action === "Upgrade Plan") {
    void vscode.env.openExternal(vscode.Uri.parse(BILLING_URL));
  }

  return true;
}
