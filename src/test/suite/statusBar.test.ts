import * as assert from "assert";
import { CliWrapper } from "../../cli";
import { PromptGuardStatusBar } from "../../statusBar";
import { CliExecutionError, StatusResult } from "../../types";

/**
 * Build a CliWrapper whose status() is replaced by the given implementation.
 * The status bar only calls status(), so nothing else needs stubbing.
 */
function stubCli(status: () => Promise<StatusResult>): CliWrapper {
  const cli = new CliWrapper();
  cli.status = status;
  return cli;
}

/** Tooltip as plain text (the status bar only ever sets string tooltips). */
function tooltipText(statusBar: PromptGuardStatusBar): string {
  const tooltip = statusBar.tooltip;
  return typeof tooltip === "string" ? tooltip : (tooltip?.value ?? "");
}

suite("Status Bar Test Suite", () => {
  let statusBar: PromptGuardStatusBar | undefined;

  teardown(() => {
    statusBar?.dispose();
    statusBar = undefined;
  });

  test("genuine not-initialized response renders 'Not initialized'", async () => {
    // The real CLI reports this with exit 0 and valid JSON (status.rs):
    // {"initialized": false, "status": "not_initialized"}
    statusBar = new PromptGuardStatusBar(
      stubCli(() => Promise.resolve({ initialized: false, status: "not_initialized" })),
    );
    await statusBar.updateStatus();
    assert.ok(statusBar.text.includes("Not initialized"), `unexpected text: ${statusBar.text}`);
  });

  test("active status renders 'Active' with the proxy URL in the tooltip", async () => {
    statusBar = new PromptGuardStatusBar(
      stubCli(() =>
        Promise.resolve({
          initialized: true,
          status: "active",
          proxy_url: "https://api.promptguard.co/api/v1",
        }),
      ),
    );
    await statusBar.updateStatus();
    assert.ok(statusBar.text.includes("Active"), `unexpected text: ${statusBar.text}`);
    assert.ok(tooltipText(statusBar).includes("https://api.promptguard.co/api/v1"));
  });

  test("disabled status renders 'Disabled'", async () => {
    statusBar = new PromptGuardStatusBar(
      stubCli(() => Promise.resolve({ initialized: true, status: "disabled" })),
    );
    await statusBar.updateStatus();
    assert.ok(statusBar.text.includes("Disabled"), `unexpected text: ${statusBar.text}`);
  });

  test("status failure renders 'Unavailable' with the cause — NOT 'Not initialized'", async () => {
    // Regression: CLI-missing/timeout/parse failures all rendered
    // "Not initialized", telling the user to re-init a workspace that may be
    // fully initialized while the real problem (e.g. missing binary) is hidden.
    statusBar = new PromptGuardStatusBar(
      stubCli(() =>
        Promise.reject(
          new CliExecutionError("Command failed: promptguard status --json — timed out after 30s"),
        ),
      ),
    );
    await statusBar.updateStatus();
    assert.ok(statusBar.text.includes("Unavailable"), `unexpected text: ${statusBar.text}`);
    assert.ok(!statusBar.text.includes("Not initialized"));
    assert.ok(
      tooltipText(statusBar).includes("timed out after 30s"),
      `tooltip must carry the cause, got: ${tooltipText(statusBar)}`,
    );
  });

  test("non-CLI errors (e.g. CLI not found) also render 'Unavailable' with the cause", async () => {
    statusBar = new PromptGuardStatusBar(
      stubCli(() =>
        Promise.reject(new Error("PromptGuard CLI not found. Please install it first:")),
      ),
    );
    await statusBar.updateStatus();
    assert.ok(statusBar.text.includes("Unavailable"), `unexpected text: ${statusBar.text}`);
    assert.ok(tooltipText(statusBar).includes("CLI not found"));
  });
});
