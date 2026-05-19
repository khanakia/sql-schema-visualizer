# Publishing

How `@khanakia/sql-schema-core` and `@khanakia/sql-schema-react` get to npm. The web app (`apps/web`) is `private` and never published — it deploys to GitHub Pages separately.

## TL;DR

```
# bump versions in the two library package.json files, then:
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z && git push origin main --tags
gh release create vX.Y.Z --generate-notes      # → CI auto-publishes to npm
```

---

## One-time setup (done)

1. **npm org membership** — the publishing npm account is a member of the [`khanakia` org](https://www.npmjs.com/settings/khanakia/packages) with publish rights.
2. **Automation token** — npmjs.com → *Access Tokens* → *Generate New Token* → **Granular Access Token**, type **Automation**, **Read and write** on the `@khanakia` scope.
3. **Repo secret** — added as `NPM_TOKEN`:
   ```
   gh secret set NPM_TOKEN --repo khanakia/sql-schema-visualizer
   ```
   (paste the token at the prompt — never commit it)

Both libraries already declare `"publishConfig": { "access": "public" }` plus `repository` / `homepage` / `bugs`, so scoped public publish + the npm page work out of the box.

## How auto-publish works

`.github/workflows/publish.yml`:

```mermaid
flowchart LR
  R[GitHub Release published\nor manual dispatch] --> I[pnpm install --frozen-lockfile]
  I --> T[pnpm --filter core test]
  T --> B[pnpm run build:libs\n(tsup ESM + d.ts)]
  B --> P[pnpm -r publish --access public]
  P --> N1[(npm: @khanakia/sql-schema-core)]
  P --> N2[(npm: @khanakia/sql-schema-react)]
```

- Triggers: a **GitHub Release being _published_**, or manual **workflow_dispatch**.
- `pnpm -r publish` publishes every non-private workspace package; `apps/web` (`private: true`) is skipped automatically.
- npm **provenance** is on (`id-token: write` + `NPM_CONFIG_PROVENANCE=true`).
- npm rejects a version that already exists — so every release **must bump versions** first.

## Cutting a release

1. Bump `version` in **both**:
   - `packages/core/package.json`
   - `packages/react/package.json`
   (keep them in lockstep; `@khanakia/sql-schema-react` depends on core via `workspace:*`, which pnpm rewrites to the published version on publish.)
2. Commit + tag + push:
   ```
   git commit -am "release: v0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```
3. Create the GitHub Release (this is what fires the publish workflow):
   ```
   gh release create v0.2.0 --generate-notes
   ```
4. Watch it:
   ```
   task publish:status        # gh run list --workflow=publish.yml
   ```

## First publish (v0.1.0)

The `v0.1.0` release was created **before** the publish workflow existed, so it didn't auto-trigger. Publish it once manually:

```
task publish:dispatch         # = gh workflow run publish.yml
task publish:status
```

After that, the release-driven flow above is fully automatic.

## Manual / local fallback

If CI is unavailable:

```
npm login                     # to an account in the @khanakia org
task publish:local            # build:libs + pnpm -r publish --access public
```

## Verifying

```
npm view @khanakia/sql-schema-core version
npm view @khanakia/sql-schema-react version
```

or visit <https://www.npmjs.com/settings/khanakia/packages>.

## Versioning policy

- `core` and `react` are released together at the same version for simplicity.
- Pre-1.0: minor = features, patch = fixes; breaking changes allowed in minors.
- Optional future improvement: adopt [Changesets](https://github.com/changesets/changesets) to automate version bumps + changelogs instead of hand-editing the two `package.json` files.
