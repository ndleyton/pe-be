# RFC 0001: Migrate the Frontend Package Manager from npm to pnpm

- Status: Accepted
- Date: 2026-04-09
- Owner: Engineering

## Summary

Migrate `pe-be-tracker-frontend/` from npm to pnpm and replace the current custom dependency-update workflow with Dependabot.

This proposal is intentionally narrow:

- It changes the frontend package manager only.
- It does not change the frontend runtime, bundler, or deployment topology.
- It does not change backend dependency management, except that Dependabot should also take over backend dependency updates because GitHub now supports the `uv` ecosystem.

## Context

Today the repository is split across two dependency management approaches:

- Backend: `uv`
- Frontend: npm

The frontend currently relies on:

- `pe-be-tracker-frontend/package-lock.json`
- `npm ci` in `.github/workflows/frontend.yml`
- `npm ci` in `.github/workflows/e2e.yml`
- `npm ci` in `.github/workflows/release.yml`
- a custom weekly GitHub Actions workflow in `.github/workflows/dependency-update.yml`

Two deployment details shape this decision:

1. The current production VPS deployment does not build or ship the frontend from `deploy-vps.yml`; it explicitly excludes `pe-be-tracker-frontend/` from the rsync step.
2. The production compose file only runs `caddy`, `backend`, and `db`. The frontend package manager therefore affects developer installs, CI, release packaging, and any future frontend container build much more than it affects the live app runtime.

That means a migration away from npm is primarily an engineering-efficiency and deployment-pipeline change, not an end-user feature.

## Goals

- Reduce frontend dependency install time in local development and CI.
- Improve cache reuse in GitHub Actions and future Docker builds.
- Reduce on-disk duplication for frontend dependencies.
- Replace the bespoke frontend dependency update workflow with first-class Dependabot support.
- Keep the migration low-risk by preserving Node.js as the runtime.

## Non-goals

- Changing the frontend framework, build tool, or test stack.
- Changing browser runtime performance directly.
- Switching the frontend runtime from Node.js to Bun.
- Moving the backend away from `uv`.

## Decision

Adopt pnpm for `pe-be-tracker-frontend/`, managed through Corepack on Node 20, and standardize automated dependency updates through `.github/dependabot.yml`.

The migration should:

- add a `packageManager` field to `pe-be-tracker-frontend/package.json`
- generate and commit `pe-be-tracker-frontend/pnpm-lock.yaml`
- delete `pe-be-tracker-frontend/package-lock.json`
- replace `npm` commands in frontend-facing workflows and docs with `pnpm`
- retire the frontend portion of `.github/workflows/dependency-update.yml`
- add Dependabot entries for both:
  - frontend with `package-ecosystem: "npm"` targeting the pnpm-managed frontend directory
  - backend with `package-ecosystem: "uv"` targeting `backend/`

## Why pnpm

### 1. It is the lowest-risk move away from npm

pnpm keeps the existing Node.js runtime, `package.json` scripts, Vite workflow, Playwright workflow, and GitHub Actions shape intact. That keeps the blast radius much smaller than a Bun migration, which would introduce a new runtime, new CLI semantics, and more deployment churn than this repository currently needs.

### 2. It improves install and cache behavior where this repo actually pays the cost

The frontend is installed repeatedly in CI:

- `frontend.yml`
- `e2e.yml`
- `release.yml`

pnpm's content-addressable store and lockfile-driven installs are a better fit for repeated CI runs and self-hosted runner caches than npm's current setup. The expected gain is shorter repeated install phases and less duplicated disk usage on developer machines and runners.

### 3. It fits the current deployment model

The live VPS deployment does not currently deploy the frontend source tree, so the package manager choice is mainly about:

- local developer setup
- CI throughput
- release artifact generation
- future containerized frontend builds

pnpm helps in all four areas without requiring a change in how production is served today.

### 4. It works with Dependabot

GitHub Dependabot supports pnpm projects through the `npm` ecosystem configuration, and it separately supports `uv`. That lets this repository remove the custom weekly dependency update job and rely on a standard GitHub-native update flow instead.

## Why not stay on npm

Staying on npm preserves the current state but leaves three problems in place:

- slower repeated installs than pnpm is likely to provide
- no clear storage/caching advantage for CI or future Docker builds
- continued reliance on a custom dependency update workflow even though Dependabot can now cover the relevant ecosystems

If we are going to spend migration effort at all, staying on npm gives the repo the least return.

## Why not Bun

Bun is attractive on speed, but it is the wrong tradeoff for this repository right now.

Reasons to reject Bun for this RFC:

- It changes both the package manager and the runtime/toolchain assumptions.
- It would require broader validation across Vite, Playwright, GitHub Actions, and any future Docker build path.
- The repository's current need is better install performance and dependency automation, not a runtime change.
- pnpm delivers most of the operational upside with materially less migration risk.

This RFC is about moving away from npm with minimal blast radius. pnpm is the better fit for that goal.

## Deployment and Performance Impact

### Browser Runtime

There is no expected browser runtime performance gain from this change by itself. Bundle size, route performance, and API latency should remain unchanged unless separate follow-up work changes the application build output.

### Local Development

Expected gains:

- faster repeat installs after the first store population
- lower disk usage across projects and reinstalls
- clearer lockfile ownership for frontend dependency updates

Expected costs:

- one-time migration friction for contributors who do not already use Corepack/pnpm

### GitHub Actions

This is where the repo should see the most practical gain.

Expected gains:

- shorter dependency install steps in `frontend.yml`, `e2e.yml`, and `release.yml`
- better cache reuse with the pnpm store
- lower network churn on self-hosted runners after warm-up

Success should be measured by comparing median times before and after migration for:

- install step duration
- total frontend CI job duration
- release asset build duration

### Docker and Release Packaging

The frontend `Dockerfile` is not on the current production path, but it is still worth fixing as part of the migration because it is the repo's reference container build.

Today it installs production-only dependencies and then runs a Vite build, which is not the right shape for a frontend build pipeline because the build requires dev dependencies.

The pnpm migration should use this as an opportunity to adopt a cleaner pattern:

1. copy `package.json` and `pnpm-lock.yaml`
2. prefetch dependencies
3. perform a frozen install
4. build the static bundle
5. copy `dist/` into the nginx image

That improves determinism and makes future frontend image builds faster and easier to cache.

### Production Deployment

There is little to no direct production deployment impact today because:

- `.github/workflows/deploy-vps.yml` excludes `pe-be-tracker-frontend/`
- `docker-compose.prod.yml` has no frontend service

The gain is indirect:

- faster release packaging in GitHub Actions
- cleaner future path if the team later chooses to containerize or artifact-deploy the frontend

## Dependabot Plan

The repository should move from `.github/workflows/dependency-update.yml` to `.github/dependabot.yml`.

Recommended configuration:

- Frontend:
  - ecosystem: `npm`
  - directory: `/pe-be-tracker-frontend`
  - schedule: weekly
  - open pull request limit: small and bounded
  - grouping: group routine frontend dependency updates to reduce PR noise
- Backend:
  - ecosystem: `uv`
  - directory: `/backend`
  - schedule: weekly

Notes:

- pnpm projects still use `package-ecosystem: "npm"` in Dependabot config.
- Backend no longer needs a custom update workflow just because it uses `uv`; GitHub now supports that ecosystem.
- If the team wants security-only noise reduction, use grouped version updates plus the normal Dependabot security update flow instead of maintaining custom `npm update` automation.

## Migration Plan

### Phase 0: Baseline

Capture current medians from recent GitHub Actions runs:

- frontend dependency install duration
- e2e frontend install duration
- release frontend install duration

This gives the migration a measurable before/after comparison.

### Phase 1: Introduce pnpm

- enable Corepack in docs and CI
- add `packageManager` to `pe-be-tracker-frontend/package.json`
- generate `pnpm-lock.yaml`
- remove `package-lock.json`
- verify `pnpm install`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build`

### Phase 2: Update CI

Update:

- `.github/workflows/frontend.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/release.yml`

Changes:

- use pnpm-aware setup in GitHub Actions
- cache pnpm store instead of npm cache
- replace `npm ci` with frozen pnpm installs
- replace `npx` usage with `pnpm exec` where appropriate

### Phase 3: Fix the Frontend Dockerfile

- switch from `package*.json` to `package.json` plus `pnpm-lock.yaml`
- install build dependencies correctly
- build with pnpm
- keep the runtime image nginx-only with copied static assets

### Phase 4: Replace the Custom Dependency Update Workflow

- add `.github/dependabot.yml`
- disable or remove `.github/workflows/dependency-update.yml`
- verify Dependabot opens PRs successfully for both frontend and backend

### Phase 5: Documentation Cleanup

Update npm references in:

- `README.md`
- `pe-be-tracker-frontend/README.md`
- `.github/ci-cd.md`
- any workflow comments or contributor docs that mention `npm install` or `npm ci`

## Risks and Mitigations

### Risk: hidden reliance on npm's flatter dependency layout

Some tools occasionally assume transitive packages are hoisted in npm-specific ways.

Mitigation:

- validate lint, unit tests, build, and Playwright after migration
- only introduce pnpm hoisting compatibility flags if a concrete package requires it

### Risk: contributor friction during the cutover

Developers without Corepack enabled may hit setup issues.

Mitigation:

- document `corepack enable`
- pin the package manager version in `package.json`
- keep the migration scoped to the frontend only

### Risk: temporary CI slowdown during cache warm-up

The first few pnpm runs may not show improvement until caches are warm.

Mitigation:

- evaluate medians across multiple runs rather than one cold run

## Rollback Plan

If the migration causes blocking compatibility issues:

1. restore `package-lock.json`
2. revert workflow commands from pnpm to npm
3. remove `pnpm-lock.yaml`
4. keep the Dependabot decision separate if it is already working for backend `uv`

## Success Criteria

- Frontend CI install time decreases versus the npm baseline.
- Release frontend build/package time decreases or stays flat with better determinism.
- The repository no longer depends on `.github/workflows/dependency-update.yml` for frontend dependency updates.
- Dependabot successfully opens update PRs for:
  - frontend pnpm dependencies
  - backend uv dependencies
- Developer setup remains a single-runtime Node workflow rather than a Node plus Bun workflow.

## Open Questions

- Do we want to migrate only the frontend to Dependabot first, or cut over backend `uv` at the same time?
- Do we want grouped Dependabot PRs by dependency type, or a single frontend update group to minimize noise?
- Do we want to keep the frontend Dockerfile as a maintained path, or document that release artifacts are the only supported frontend delivery mechanism for now?

## External References

- GitHub Docs, Dependabot supported ecosystems and repositories: <https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories>
- GitHub Docs, Dependabot quickstart guide: <https://docs.github.com/en/code-security/getting-started/dependabot-quickstart-guide>
- pnpm documentation homepage: <https://pnpm.io/>
