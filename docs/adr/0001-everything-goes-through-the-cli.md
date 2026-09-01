# The extension reaches PromptGuard only by running the CLI

This extension never calls `api.promptguard.co`. Every scan, redaction, status
check and project lookup spawns the PromptGuard CLI and parses its stdout. The
one HTTP request in the codebase asks GitHub for the latest CLI release, so
that the extension can offer to install the thing it depends on.

The alternative was an API client here: the extension already has to hold an
API key, and calling the API directly would remove the requirement that a
separate binary be installed and on `PATH`. That requirement is a real cost —
the extension is inert without it, and "install the CLI" is a step users skip.
It was still the wrong trade. An API client here would mean a second
implementation of credential resolution, retry and error handling, a second set
of types to keep in step with the spec, and a second place to fix when the API
moves — for a surface the CLI already implements and already tests. Keeping one
implementation means the editor and the terminal cannot disagree about what a
scan found.

## Consequences

The extension's contract is with the CLI's stdout rather than with the API, so
it needs no generated API types and no weekly spec sync. What it needs instead
is a pinned understanding of the CLI's exit codes and output shapes, which
`cliContract.test.ts` provides by running the real wrapper against a stub that
emits them.

That contract is not uniform, and the difference matters when something
changes. A project scan, a status report and a project list are shapes the CLI
assembles itself; it owns them, and only this repo follows. A threat scan and a
redaction are shapes the CLI parses from the API and re-serialises **verbatim**,
renames and all — so the API's field names arrive here unchanged, and a field
renamed in the API propagates through a CLI that never looks at it into an
extension that never called it. "This extension does not depend on the API"
is true of the mechanism and false of the shapes.

The stub restates those shapes by hand, in a comment naming the Rust structs
they came from. Both sides are ours and CI exercises the stub on every run, so
a shape change surfaces as a failing test here rather than as silence — but a
comment is not a gate. If the CLI's JSON output grows past these few commands,
give it a published contract artifact and sync it the way the SDKs sync
`guard-contract.json`.
