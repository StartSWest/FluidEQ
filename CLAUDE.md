# FluidEQ

> **Servio (Service And Store Platform)** — vertical-agnostic multi-tenant SaaS
> for businesses that book appointments, sell products, or both. Each tenant is
> an `Organization` with isolated data, reached by subdomain or custom domain.
> `offersServices` / `offersProducts` gate the storefront, nav, routes and admin
> sidebar.
>
> **Shared workstation rules** — how to work, report, and handle git — live in
> the parent `../CLAUDE.md` when present. This file contains what is true of
> _this_ repository and remains valid in a standalone clone.
>
> **Reference lives in `docs/`, not here.** Open when the task needs it:
> [architecture](docs/ARCHITECTURE.md) ·
> [production](docs/PRODUCTION.md) ·
> [migrations](docs/MIGRATIONS.md) ·
> [testing](docs/TESTING.md) ·
> [lint backlog](docs/LINT_BACKLOG.md) ·
> [dev environment](docs/DEV_ENVIRONMENT.md) ·
> [production logs](docs/PRODUCTION_LOGS.md) ·
> [Stripe](docs/STRIPE_SETUP.md) ·
> [responsive](docs/RESPONSIVE.md) ·
> [cron](docs/CRON_SETUP.md)

---

## The three that matter most

1. **Every Prisma query filters by `organizationId`** — see below. No exceptions
   outside global models like `Organization` itself.
2. **Every API route rate-limits as its FIRST check**, before auth or tenant
   resolution, using a `RATE_LIMIT_GROUPS` preset.
3. **Schema changes only via `pnpm db:migrate`.** A reset is never a drift fix;
   the dev database is shared by the main checkout and every worktree.

---

## Multi-tenant

Tenant travels by **subdomain or custom domain**, resolved in `src/proxy.ts`,
which passes `x-tenant-identifier`, `x-tenant-lookup-type` and `x-tenant-id` to
handlers. Helpers in `src/lib/tenant.ts`:

- `getCurrentTenant()` — Server Components.
- `getTenantFromRequest(request)` — public API routes. Reject a null tenant with
  `NotFoundError("Store")`.
- `requireAdminTenantFromRequest(request, session)` — admin API routes; verifies
  tenant _and_ admin ownership.

Dev access is path-based: `http://localhost:3000/store/<slug>`. "Tenant not
found" in dev almost always means you used the bare host.

### Storefront routing traps — recurring bug classes

- **Storefront login links go to `/auth/login`, never straight to `/login`.**
  There is no per-store login form; `(store)/auth/login/page.tsx` is a redirect
  shim that sends the user to the apex `/login` with an absolute `callbackUrl`
  back to the store page. The session cookie is set on `.${PLATFORM_DOMAIN}` so
  it propagates to every subdomain. Hard-coding the apex `/login` skips the shim
  and strands the user on the apex after sign-in. Same for `/auth/signup`.
  **In tests:** the storefront URL 307s to the apex, so asserting
  `url).toContain("/auth/login")` after a redirect is a race — assert on the
  apex `/login` with its `callbackUrl` query instead.
- **`useTenantPath().basePath` is `""` in prod subdomain mode.** Dev gives
  `/store/<slug>`. Code deriving the slug from
  `basePath.replace(/^\/store\//, "")` works in dev and silently no-ops in prod.
  When a client component needs the slug, read it server-side via
  `getCurrentTenant()` and pass it as a prop.
- **Action handlers that need auth redirect, they do not toast.** Add-to-cart,
  wishlist and book redirect to `/auth/login?callbackUrl=<current path>` rather
  than showing "Unauthorized". Cart store uses `redirectToStoreLogin()`;
  page-level guards use the `useRequireAuth` hook.

---

## Migrations

Full recovery procedures, the DDL carve-out and the P3005/P3006 playbooks are in
[docs/MIGRATIONS.md](docs/MIGRATIONS.md). The rules:

**Allowed:** `pnpm db:migrate` (after editing `schema.prisma`) and `prisma
migrate deploy` (Coolify container CMD only). `pnpm dev` also runs `migrate
dev` on startup. `pnpm db:reset` is a destructive operator command: run it only
when Ivan explicitly asks to wipe the shared dev database.

**Never:** hand-craft a `migration.sql` outside the documented carve-out, pipe
`migrate diff` into a file, touch `_prisma_migrations`, edit or rename anything
in `prisma/migrations/` (append-only), or `db push` a change that ships.

**Never use a reset to recover drift**, nor accept Prisma's offer to reset.
Every checkout and worktree shares ONE dev database; a reset wipes all of them.

**If `migrate dev` fails — stop and ask.** Report the error code and what it
means for prod. Do not improvise.

**Drift in a worktree** ("applied to the database but missing from the local
migrations directory") is usually not corruption. It is a migration that exists
as uncommitted work in another checkout but was already applied to the shared dev
DB. Diagnose before touching anything:

```bash
git log --all --oneline -- prisma/migrations/<the-named-migration>
git -C <main-checkout> status --short -- prisma/
```

Fix by getting the migration into git — commit it on `master` with its
`schema.prisma` change so the parity check passes — then rebase the worktree.
Never copy the folder between checkouts, and never reset.

---

## Servio-specific coding choices

General good practice is assumed. These are the calls a sensible default would
get wrong.

- **Validation is `src/lib/validation.ts`, not Zod.** Zod is a dependency but
  reserved. (SmartFlix uses Zod; this project does not. Do not carry the habit
  across.) All validators throw `ValidationError`.
- **Explicitly type Prisma `include`/`select` callback params.**
  `skipLibCheck: true` lets them degrade to `any` locally while the prod build
  still catches them.
- **Errors at boundaries only** — API routes and event handlers, using the typed
  classes from `@/lib/logger`. `handleApiError(error, logger, route)` maps them
  to responses. Libraries throw with context rather than logging.
- **`src/app/` route groups, never `src/features/`.** Split a file when it stops
  having a single responsibility, not at a line count.
- **No barrel exports** — they break tree-shaking.
- `satisfies` over `as`. Type-only imports as `import { type Foo }`.
- **No nested ternaries and no non-null `!` in new code.** These two are the
  only code rules still living in prose, because the linter cannot be switched on
  yet — there are 90 and 27 existing sites respectively. Everything else
  mechanically checkable is now an eslint error. Do not add to the pile; the
  cleanup plan is [docs/LINT_BACKLOG.md](docs/LINT_BACKLOG.md).
- **`/api/health` is never rate-limited.** Coolify's health check pings it; a
  throttled probe marks healthy nodes down and stalls traffic.
- **Never `import 'dotenv'` in shared config or application code** — it crashes
  the prod image. Wrap dev commands with `dotenv-cli` instead. Why, plus the
  Docker and `prisma.config.ts` runtime rules, is in
  [docs/PRODUCTION.md](docs/PRODUCTION.md).
- CSS: `rem` for font sizes, spacing and sizing; `px` only for borders,
  box-shadows and SVG attributes.

---

## Tests that must exist

- A bug fix ships with a regression test pinning it. **Write the failing test
  first.**
- A new API route gets `tests/api/<same-path>.test.ts` covering the rate-limit
  short-circuit, the auth gate, tenant scoping, a validation rejection and the
  happy path.
- A new `src/lib/*.ts` gets `tests/unit/lib/<same-path>.test.ts`.

Conventions that bite when writing them — `vi.hoisted` ordering, the auto-mocked
logger, per-test rate-limit IPs, happy-dom's `Location` — are in
[docs/TESTING.md](docs/TESTING.md).

---

## Commands and the gate

```bash
pnpm lint          # eslint + tsc --noEmit
pnpm test          # lint + vitest, no coverage
pnpm coverage      # vitest + thresholds — what pre-push runs
pnpm test:browser  # seeds the qa-test tenant, then Playwright (needs `pnpm dev`)
pnpm test:all      # lint && coverage && test:browser
```

Never `pnpm build` while the dev server runs.

**Pre-push runs automatically via Husky**, in order:

1. **CLAUDE.md drift** (`scripts/check-claude-md.mjs`) — every `pnpm <script>`
   named in this file or a doc it links to must exist in `package.json`, and
   every relative link must resolve. Add a command here, add the script too.
2. **Schema↔migrations parity** (`scripts/check-schema-parity.js`) — fails if
   `prisma/schema.prisma` changed without a matching new migration folder in the
   same range.
3. **`pnpm lint`** — eslint with `--max-warnings 0`, so a warning blocks, plus
   `tsc --noEmit`.
4. **`pnpm coverage`** — an 80% floor that `autoUpdate` ratchets upward, never
   down.

**Pull requests to `master` run GitHub Actions CI** on a standard Ubuntu runner:
instruction drift, schema↔migration parity, frozen install, Prisma and Next.js
type generation, lint/type-check, coverage, and a production build. Superseded
runs are cancelled, each run has a 20-minute timeout, and no artifacts are
uploaded. The account-level Actions budget is a hard $0 cap, so CI stops rather
than creating overage charges after the included allowance is exhausted.
Browser tests remain local-only.

This private repository's GitHub Free plan cannot enforce required status checks
with branch protection. Treat a green `Verify` check as mandatory before merge;
enable it as a required check if the repository becomes public or the plan later
includes private-repository branch protection.

## UI changes

Always look at a UI change before delivering it. Open it and check that it
does not break the layout and that it stays responsive, however small it is.
One button can break a full-width layout and make a horizontal scrollbar
appear. Check the narrow widths, not just the desktop one.
