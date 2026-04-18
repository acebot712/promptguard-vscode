# Change Log

All notable changes to the PromptGuard VS Code extension will be documented in this file.

## [0.5.2] - 2026-04-18

### Fixed

- Packaged `.vsix` no longer includes the test suite, internal CI configs (`.github/`), AGENTS.md, `.pre-commit-config.yaml`, or ESLint/Prettier configs. Install size shrinks from ~74 KB / 46 files to ~53 KB / 29 files.

### Changed

- Bumped 7 dev-dependencies to current minor versions (`@eslint/js`, `@types/node`, `@typescript-eslint/*`, `eslint`, `glob`, `typescript-eslint`). `@types/vscode` deliberately held at `^1.80.0` to match `engines.vscode`.

## [0.2.1] - 2026-02-24

### Added

- AWS Bedrock provider support in init command
- Security scanning and PII redaction features to README
- Marketplace keywords for discoverability (cohere, aws-bedrock, gemini)

### Changed

- Updated documentation link to docs.promptguard.co

## [0.2.0] - 2026-02-20

### Added

- Precise diagnostic ranges using line/column data from CLI
- CodeAction provider for quick fixes on detected SDK usage
- Scan Selection command (right-click to scan selected text for threats)
- Redact Selection command (right-click to redact PII from selection)
- Scan File command (context menu on files in explorer)
- Secure API key storage using VS Code SecretStorage
- Sidebar tree view showing managed files and protection status
- Auto-download CLI installer from GitHub releases
- Progress indicators for long-running operations
- Helpful notification when CLI is not found
- Comprehensive test suite for all features

## [0.1.3] - 2026-01-15

### Added

- Gemini and Groq providers to init command

### Fixed

- Command injection vulnerability by using execFile instead of exec
- Redundant statusBar reference duplication

## [0.1.2] - 2025-12-01

### Changed

- Improved type safety by removing all 'any' types and unsafe type assertions
- Replaced polling mechanism with event-driven status updates for better performance
- Enhanced CLI wrapper with proper TypeScript types

### Fixed

- Fixed remaining type safety issues in CLI wrapper
- Removed unsafe `(window as any)` hacks

## [0.1.1] - 2025-11-30

### Added

- Extension icon for marketplace display

## [0.1.0] - 2025-11-30

### Added

- Initial release
- LLM SDK detection with diagnostics
- Status bar indicator
- Command palette integration
- CLI wrapper for all PromptGuard commands
- Support for TypeScript, JavaScript, and Python
- Auto-detection of CLI binary location

