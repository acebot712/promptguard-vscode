# Change Log

All notable changes to the PromptGuard VS Code extension will be documented in this file.

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

