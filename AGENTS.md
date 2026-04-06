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

## Packaging

```bash
npx vsce package --no-dependencies
```

## Boundaries

### Never
- Commit API keys, tokens, or credentials
- Add runtime npm dependencies (keep the extension lightweight)
- Break compatibility with VS Code ^1.80
