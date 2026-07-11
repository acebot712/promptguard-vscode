import * as vscode from "vscode";
import { CliExecutionError } from "./types";

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

/**
 * Whether an error indicates the PromptGuard plan quota was exceeded. The
 * CLI reports API errors on stderr (`Error: ... quota exceeded ...`), which
 * CliExecutionError captures separately from its message — so both must be
 * inspected. Exported so tests exercise the real predicate.
 */
export function isQuotaError(error: unknown): boolean {
  const stderr = error instanceof CliExecutionError ? (error.stderr ?? "") : "";
  const haystack = `${errorMessage(error)}\n${stderr}`.toLowerCase();
  return haystack.includes("quota exceeded") || haystack.includes("quota_exceeded");
}

export async function handleQuotaError(error: unknown): Promise<boolean> {
  if (!isQuotaError(error)) {
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
