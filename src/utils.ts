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
