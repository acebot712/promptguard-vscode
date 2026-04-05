# Contributing to PromptGuard VS Code Extension

Thank you for your interest in contributing to PromptGuard!

## Development Setup

```bash
git clone https://github.com/acebot712/promptguard-vscode.git
cd promptguard-vscode
npm install
pip install pre-commit && pre-commit install
```

## Code Quality

```bash
# Lint
npm run lint

# Format check
npm run format:check

# Compile
npm run compile
```

## Running Tests

1. Open the repo in VS Code
2. Press `F5` to launch the Extension Development Host
3. Run tests via: `npm test`

Tests require the VS Code test runner and run in a headless Electron environment in CI.

## Pull Requests

1. Fork the repo and create a feature branch from `main`.
2. Write tests for any new functionality.
3. Ensure `npm run lint` and `npm run format:check` pass with zero errors.
4. Ensure `npm run compile` succeeds.
5. Open a PR with a clear description of the change.

## Reporting Issues

Open an issue at https://github.com/acebot712/promptguard-vscode/issues with:
- VS Code version
- Extension version
- PromptGuard CLI version (if applicable)
- Minimal reproduction steps
