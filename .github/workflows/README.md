# GitHub Actions Workflows

## Release Workflow

The `release.yml` workflow automatically:
1. Builds the extension when you push a tag like `v0.1.0`
2. Packages it into a `.vsix` file
3. Creates a GitHub release with the VSIX file attached
4. Optionally publishes to VS Code Marketplace (if `VSCE_PAT` secret is set)

### How to Release

1. Update version in `package.json`
2. Commit and push:
   ```bash
   git add package.json
   git commit -m "Bump version to 0.1.0"
   git push
   ```
3. Create and push a tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. The workflow will automatically:
   - Build the extension
   - Create a GitHub release
   - Attach the VSIX file
   - Publish to marketplace (if `VSCE_PAT` is configured)

### Publishing to Marketplace

To enable automatic publishing to VS Code Marketplace:

1. Get a Personal Access Token (PAT) from https://marketplace.visualstudio.com/manage
2. Add it as a secret named `VSCE_PAT` in your GitHub repository settings
3. The workflow will automatically publish on tag pushes

**Note**: The publish job only runs on version tags (not pre-release tags like `v0.1.0-beta`)

## CI Workflow

The `ci.yml` workflow runs on every push and PR to:
- Install dependencies
- Compile TypeScript
- Verify the build succeeds

This ensures code quality before merging.

