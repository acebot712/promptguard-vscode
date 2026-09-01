# PromptGuard VS Code Extension

The PromptGuard extension for VS Code. It surfaces unprotected LLM call sites
in the editor, and offers scanning and redaction from the command palette. It
holds no security logic of its own: everything is obtained by running the
PromptGuard CLI and reading what it prints.

## Language

### What this is

**Extension**:
This package, as VS Code names the thing a user installs from the Marketplace.
_Avoid_: plugin — `promptguard-plugin` is a different repository (the
multi-host agent plugin), and calling both "the plugin" has already cost a
conversation the time to work out which was meant. Also avoid: add-on, IDE
integration.

**CLI wrapper**:
The single seam every CLI invocation passes through. Nothing else in the
extension spawns a process.
_Avoid_: client, service, adapter, runner

### The contract with the CLI

**Findings exit**:
The CLI's exit code 2, meaning "I ran successfully and found something" — a
threat, or an unprotected call site — with complete output on stdout. It is
distinct from an error exit, which carries nothing worth parsing. Treating any
non-zero exit as failure made the extension report a failed scan at exactly the
moments it had something to say.
_Avoid_: error code, failure exit, non-zero exit

**Stdout contract**:
The set of shapes and exit codes the extension relies on the CLI producing.
This, and not the PromptGuard API, is what the extension is written against.
_Avoid_: API contract, CLI API, protocol

**CLI-owned shape**:
Output the CLI assembles itself — a project scan, a status report, a project
list. The CLI is free to change these, and only this repo has to follow.
_Avoid_: CLI response, local shape

**Forwarded shape**:
Output the CLI parses from the PromptGuard API and re-emits unchanged, so the
API's own field names arrive here verbatim — a threat scan result, a redaction
result. The CLI is a pass-through for these, not a translator, which means a
field renamed in the API reaches this extension even though it never calls the
API.
_Avoid_: proxied shape, API response (this repo never receives one directly)

### What a user sees

**Call site**:
A source location that constructs an LLM provider's SDK client. The same term
the CLI uses for the thing it detects.
_Avoid_: instance, usage, occurrence

**Diagnostic**:
The editor marking on a call site, and its entry in the Problems panel. It
reports *coverage* — whether that call is routed through PromptGuard — never
whether any content is malicious.
_Avoid_: error, warning (those name one severity, not the concept), problem,
issue, finding

**Quick fix**:
The action offered against a diagnostic, which delegates to a command rather
than editing the file itself.
_Avoid_: code action (VS Code's API name for the mechanism, not the thing a
user sees), autofix, remediation

**Managed file**:
A file the CLI has transformed and recorded, which the extension lists rather
than discovers.
_Avoid_: tracked file, protected file, modified file

### Terms owned elsewhere

**Threat scan**:
Sending content to be classified. Reaches the API through the CLI.

**Redaction**:
Replacing PII in content. A separate operation from a threat scan.

**Provider**:
An LLM vendor whose SDK the CLI recognises.
_Avoid_: vendor, model, SDK (when the vendor is meant)
