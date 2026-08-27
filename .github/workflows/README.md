# GitHub Actions Workflows

## Release Workflow

`release.yml` fires on a `v*` tag and:

1. **`notes-gate`** — refuses the release unless `CHANGELOG.md` has a non-empty
   section for this version.
2. **`build`** — verifies the tag matches `package.json`, installs, lints,
   compiles, runs the tests under `xvfb`, packages the `.vsix`, uploads it as
   the `extension` artifact, and creates the GitHub Release with it attached.
3. **`publish`** — downloads that **same** `.vsix` and publishes it to the VS
   Code Marketplace with `vsce publish --packagePath`.

Step 3 is worth reading twice. It used to re-checkout and re-run `vsce publish`,
which repackages from source — so the Marketplace got a *different build* from
the one attached to the Release and exercised by the tests. It now publishes the
tested bytes.

### Publishing is NOT optional

This file previously said publishing happens "if `VSCE_PAT` is set". That was
never true, and the difference matters: `publish` is gated only on the tag shape
(`v*`, no pre-release suffix), so **on a matching tag with no `VSCE_PAT` the job
fails the release** rather than skipping quietly.

That is the correct behaviour and should stay. A publish step that silently
skips when its credential is missing is how you ship a tag that looks released
and never reached anyone — the same failure this project has already hit twice
elsewhere (a secret scanner with no API key, and an API-contract gate with no
token, both reporting success for months while doing nothing).

To enable publishing:

1. Get a Personal Access Token from <https://marketplace.visualstudio.com/manage>
2. Add it as a repository secret named `VSCE_PAT`

### How to release

1. Add the version's section to `CHANGELOG.md` — `notes-gate` rejects the tag
   otherwise.
2. Bump `version` in `package.json`, commit, push.
3. Tag and push:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

Pre-release tags (`v0.1.0-beta`) build and create a Release but do not publish
to the Marketplace.

## CI Workflow

`ci.yml` runs on every push and PR to `main`, as **two parallel jobs** so a
formatting nit does not wait behind the test run:

| Job | Does |
|---|---|
| `lint` | `npm run lint`, `npm run format:check` |
| `test` | compile, assert `out/extension.js` exists, `xvfb-run npm test`, `vsce package` |

Neither gates the other; both report as soon as they know.

Docs-only changes are skipped via `paths-ignore`.
