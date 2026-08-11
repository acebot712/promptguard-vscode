# AGENTS.md

## Overview

VS Code extension for PromptGuard. Detects unprotected LLM SDK calls in the editor, shows diagnostics, integrates with the PromptGuard CLI for scanning and fixing, and provides status bar indicators.

Requires VS Code ^1.80 and the PromptGuard CLI on PATH (or configured via `promptguard.cliPath`).

## Repository Layout

```
src/
├── extension.ts       # Extension entry point (activate/deactivate)
├── cli.ts             # CLI integration
├── commands/          # VS Code commands
├── diagnostics/       # Problem detection and reporting
└── test/
    ├── runTest.ts     # Test runner setup
    └── suite/         # Test suites (*.test.ts)

out/                   # Compiled output (not committed)
```

## Setup

```bash
npm install
```

## Building and Testing

```bash
npm run compile                      # Build (tsc)
npm run watch                        # Watch mode
npm test                             # Run tests (requires VS Code instance)

# Linux headless
xvfb-run -a npm test
```

Tests use `@vscode/test-electron` and launch a real VS Code instance.

## Code Quality

```bash
npm run lint                         # ESLint
npm run lint:fix                     # ESLint with auto-fix
npm run format                       # Prettier
npm run format:check                 # Check formatting
```

## Coding Standards

- TypeScript compiled to `out/`
- ESLint + Prettier for linting and formatting
- Follow VS Code extension API patterns and lifecycle
- No runtime npm dependencies (all logic via CLI or VS Code APIs)
- Test with `@vscode/test-electron` (Mocha under the hood)

## This extension has no API types, because it never calls the API

`promptguard-python` and `promptguard-node` generate their API types from the
published OpenAPI spec, on a weekly `sync-from-api.yml` that opens a PR when the
spec moves. **This repo has no such workflow, and that is a decision, not an
oversight.** Recorded 2026-08-11.

The extension makes exactly one HTTP request in the whole codebase:
`src/cliInstaller.ts` asks the GitHub releases API for the latest
`promptguard-cli` build. It never speaks to `api.promptguard.co`. Every scan,
redact, status and project lookup shells out to the CLI and parses its stdout —
see `src/cli.ts`. Generating types from the OpenAPI spec would produce types for
requests this extension does not make.

**Its contract is with the CLI's stdout, not with the API**, and that contract
is real: exit code 2 means "findings, with valid JSON on stdout", and treating
non-zero as failure has already caused a bug here. `src/test/suite/cliContract.test.ts`
pins it by running the real `CliWrapper` against a stub binary that emits the
CLI's exact wire formats and exit codes.

**The honest weak point** is that this stub restates the shapes of
`SecurityScanResponse` and `RedactResponse` from `promptguard-cli/src/commands/*.rs`,
in a comment that names the Rust structs and asks the next person to keep them
aligned. That is the same hand-copy hazard that let the cross-SDK
`guard-contract.json` drift two minor versions for five months. It is smaller —
both sides are ours, the stub is exercised on every CI run, and a shape change
in the CLI surfaces as a failing test here rather than as silence — but a
comment is not a gate. If the CLI's JSON output ever grows past these few
commands, give it a published contract artifact and sync it the way the SDKs
sync `guard-contract.json`.

**Revisit this if** the extension starts calling the API directly instead of
going through the CLI. At that point copy the SDKs' `sync-from-api.yml`
wholesale; do not invent a second mechanism.

## Packaging

```bash
npx vsce package --no-dependencies
```

## Boundaries

### Never
- Commit API keys, tokens, or credentials
- Add runtime npm dependencies (keep the extension lightweight)
- Break compatibility with VS Code ^1.80
