# Exit code 2 from the CLI means success, not failure

The CLI exits 2 when it finds something — a blocked threat, or unprotected LLM
call sites — with complete, valid JSON on stdout. It exits 0 when it finds
nothing and 1 on a real error. The extension therefore cannot treat a non-zero
exit as a failed command: it has to know which non-zero codes still carry
output worth parsing, and `CliWrapper` takes that set per call.

This is not a quirk to work around. The CLI's exit codes exist so `promptguard
scan` can gate a CI pipeline, where "found a problem" must fail the build. That
is the right design for a command-line tool and it is the reason the extension
has to do something slightly unusual.

## Consequences

The failure mode when this is forgotten is precisely inverted: the extension
reported "scan failed" at exactly the moments the scan had succeeded and found
something, and stayed quiet when there was nothing to report. It looked like
flakiness rather than a contract error, because the runs that worked were the
runs where nothing was wrong.

`cliContract.test.ts` pins it by driving the real `CliWrapper` against a stub
binary that exits 2 with a populated payload, so a future change that collapses
exit-code handling back to "non-zero is an error" fails here rather than in a
user's editor.
