# Contributing to PromptGuard VS Code Extension

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 22 | [nodejs.org](https://nodejs.org/) |
| npm | latest | Comes with Node.js |
| VS Code | >= 1.80.0 | [code.visualstudio.com](https://code.visualstudio.com/) |
| pre-commit | latest | `pip install pre-commit` |
| xvfb | latest (Linux only) | `sudo apt install xvfb` |

## Quick Start

```bash
git clone https://github.com/acebot712/promptguard-vscode.git
cd promptguard-vscode
npm install
pre-commit install          # Install pre-commit hooks
npm run compile             # Compile TypeScript
npm test                    # Run tests (requires VS Code test runner)
```

## Development Workflow

### Build

```bash
npm run compile             # One-time TypeScript compilation
npm run watch               # Watch mode - recompile on changes
```

### Code Quality

```bash
npm run lint                # ESLint on src/
npm run lint:fix            # ESLint with auto-fix
npm run format              # Format with Prettier
npm run format:check        # Check formatting without fixing
```

The project uses ESLint + Prettier (not Biome).

### Debugging in VS Code

The repo includes `.vscode/launch.json` with two configurations:

1. **Run Extension** -- press `F5` to launch an Extension Development Host with the extension loaded. Edit code, then restart the host (`Ctrl+Shift+F5`) to pick up changes.

2. **Extension Tests** -- select "Extension Tests" in the Run/Debug dropdown and press `F5` to run the test suite in a VS Code instance with full extension API access.

Both configurations run `npm run compile` as a pre-launch task automatically.

## Testing

### Running Tests

```bash
npm test                    # Run all tests (macOS/Windows)
xvfb-run -a npm test        # Run all tests on headless Linux (CI)
```

Tests use `@vscode/test-electron` and Mocha. They launch a real VS Code instance, so they cannot run in a plain Node.js process.

### Test Files

| File | What it tests |
|---|---|
| `src/test/suite/extension.test.ts` | Extension activation, command registration |
| `src/test/suite/cli.test.ts` | CLI binary detection and invocation |
| `src/test/suite/cliInstaller.test.ts` | CLI auto-install flow |
| `src/test/suite/diagnostics.test.ts` | Diagnostic provider (inline warnings for unprotected LLM calls) |
| `src/test/suite/codeActions.test.ts` | Quick-fix code actions |
| `src/test/suite/treeView.test.ts` | Sidebar tree view provider |
| `src/test/suite/secrets.test.ts` | Hardcoded secret detection |
| `src/test/suite/types.test.ts` | Type definitions and interfaces |

### Test Entry Point

Tests are bootstrapped via `src/test/runTest.ts` which downloads and launches VS Code, then runs `src/test/suite/index.ts` which discovers all `*.test.ts` files using Mocha's glob runner.

## Packaging

### Build a Local VSIX

```bash
npm install -g @vscode/vsce
vsce package --no-dependencies
```

This produces a `.vsix` file you can install in VS Code via:

```
View > Command Palette > "Extensions: Install from VSIX..."
```

The `--no-dependencies` flag is used because the extension has no runtime npm dependencies (only devDependencies).

## CI/CD

CI runs on every push to `main` and on PRs (`.github/workflows/ci.yml`):

| Step | What it does |
|---|---|
| **Lint** | `npm run lint` (ESLint) |
| **Format** | `npm run format:check` (Prettier) |
| **Compile** | `npm run compile` (tsc) |
| **Verify** | Checks `out/extension.js` exists after compilation |
| **Test** | `xvfb-run -a npm test` (headless VS Code on Linux) |
| **Package** | `vsce package --no-dependencies` (verify VSIX builds) |

Reproduce CI locally:

```bash
npm run lint && npm run format:check && npm run compile && npm test
```

On Linux, wrap the test step:

```bash
xvfb-run -a npm test
```

## Releasing

Releases are triggered by pushing a tag matching `v*`:

```bash
# 1. Update version in package.json
# 2. Commit and push to main
git tag v0.4.0
git push origin v0.4.0
```

The release workflow (`.github/workflows/release.yml`):

1. Lints, compiles, and packages the extension
2. Creates a GitHub Release with the `.vsix` attached
3. Publishes to the VS Code Marketplace via `vsce publish`

Marketplace publishing requires a `VSCE_PAT` (Personal Access Token) secret in GitHub repo settings. Tags containing a hyphen (e.g., `v0.4.0-beta`) create a release but skip marketplace publishing.

## PR Checklist

- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run compile` succeeds
- [ ] `npm test` passes (use `xvfb-run -a npm test` on Linux)
- [ ] New functionality has tests in `src/test/suite/`
- [ ] PR description explains the change

## Reporting Issues

Open an issue at https://github.com/acebot712/promptguard-vscode/issues with:

- VS Code version
- Extension version
- PromptGuard CLI version (if applicable)
- Minimal reproduction steps
