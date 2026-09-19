# Optional Plus free month implementation plan

> For agentic workers: implement the bounded app and server tasks with the parallel-agent workflow and review their integration before committing.

**Goal:** Let eligible new accounts explicitly accept a free 30-day Plus trial in the Plus tab, while keeping FluidEQ's free core prominent and payment separately opt-in.

**Architecture:** The private server owns eligibility, a one-time trial ledger, acceptance and expiry. The desktop main process exposes validated account-bound requests; React shows the offer, agreement and active/ended states only in Plus. The administrator controls new activations, initially disabled.

**Tech stack:** PostgreSQL/Supabase, Electron, TypeScript, React, SCSS and the existing ten-language dictionaries.

**Spec:** Approved Plus-tab mockups and conversation of 2026-09-19: no card, no automatic payment, unchecked consent, exact end date, free app continues, separate subscription choice.

## Global constraints

- 30 days from server-side activation, once per confirmed eligible account; no automatic activation.
- Eligibility starts with accounts created after the offer is first enabled. Disabling stops new grants, never shortens existing grants.
- Paid memberships and gifts remain valid and cannot be overwritten by a trial. Merchant sync must preserve an active trial.
- Trial plan is `trial`, with `cancel_at_period_end = true`; no paid offline grace after its end.
- Record Plus terms version 8 and separate free-trial terms version 1 atomically with the grant.
- Free EQ, playback, free presets and free visualizers continue. Plus extras include premium visualizers, Studio export/publishing, desktop scenes, RGB lighting, advanced Room customization/Fit and the optional leaderboard.
- No timers, global welcome popup, unsolicited prompt, card collection or checkout on trial activation.
- All copy ships in en, es, de, fr, hi, it, ja, pt, ru and zh.
- Preserve other work; use isolated checkouts, focused commits and normal pushes. Do not deploy or enable the live offer.

## Contract

`plus_trial_offer()` returns JSON `{ enabled, days: 30, state, startedAt, endsAt, termsVersion: 8, trialTermsVersion: 1 }`, where state is `unavailable | sign-in | eligible | active | ended | ineligible` and dates are ISO strings or null. Active paid/gift access takes precedence over displaying a trial.

`start_plus_trial(p_terms_version integer, p_trial_terms_version integer)` grants atomically and returns the same JSON. Errors distinguish `terms_outdated`, `trial_unavailable`, `trial_ineligible` and authentication. Retries return the original grant, never extend it.

`admin_plus_trial_settings()` and `admin_set_plus_trial_offer(p_enabled boolean)` return `{ enabled, days: 30, eligibleSince: ISO string | null }`. Both require server-side administrator authorization.

## Tasks

- [x] Server: create private migration `0040_plus_trials.sql` and executable PGlite tests. Cover disabled offers, cohort eligibility, mandatory consent versions, duplicate starts, exact expiry, gift/paid priority, merchant refresh and authorization. Leave default disabled.
- [x] Desktop contract and IPC: create `common/plusTrial.ts`, `main/plus/trialApi.ts`, `main/ipc/plusTrial.ts` and `main/plusTrialBridge.ts`. Validate responses and consent input; reject account-switch races; refresh the entitlement after a successful start.
- [x] Entitlement: ensure trial expiry is announced on launch/focus/resume even when cached status has just expired or the network is unavailable; keep free access intact. Exclude trials from the global paid-member welcome.
- [x] Plus UI: build an event-driven trial store and reusable offer/active/ended card, free-first welcome copy and accurate Plus feature list. Add a trial agreement page to Account with an unchecked checkbox and the full terms; distinguish trial access on the Account card.
- [x] Administration: add the disabled-by-default new-account offer control to the existing Plus administration surface, with cohort date and a clear explanation that disabling preserves active trials.
- [x] Localization: add a focused trial dictionary in all ten locales, including offer, consent, expiry, admin and failure copy.
- [x] Automated verification and component previews: typecheck, focused lint, encoding/styles checks, behavioral app tests and SQL tests; inspect normal/narrow/long-translation UI and consent flow. Independent cross-repository review completed with no remaining actionable findings.
- [ ] Release validation: inspect the updated running FluidEQ window and perform the desktop/server integration check in an authorized test environment before enabling the offer.

## Behavioral checks

The checks must demonstrate that an unchecked agreement cannot start the grant, signup alone does not start it, reloading/retrying cannot extend it, expiry removes only Plus access and never opens billing, and an account switch cannot receive another account's trial result. Server tests execute the SQL rather than merely checking source strings. UI checks exercise the same React components used by the app.

## Verification record — 2026-09-19

- Full desktop Jest run: 641 of 645 suites passed initially (7,312 passing tests). The remaining four suites exposed three gallery fixtures needing the new account subscriptions/copy and a filesystem test lacking worktree write permission. After fixture updates and the required file access, all four passed in a seven-suite, 93-test rerun. No product behavior or assertions were bypassed to obtain the result.
- Private server: all 83 SQL/handler tests passed. Tests execute the migration and real edge handlers with external HTTP fixtures; no live accounts, payments or production services were changed.
- TypeScript, focused ESLint, stylesheet validation and UTF-8/encoding validation passed. The existing scene-picture tests still emit React act warnings while passing.
- Browser verification used the real React/SCSS components with local IPC fixtures: 1280px and 1920px desktop layouts, 375px German consent/expiry, expanded terms, unchecked consent, activation, signup explanation, a separate paid continuation page, and explicit admin Save. No horizontal overflow remained and no browser warnings/errors occurred after fixture setup was corrected.
- The running native FluidEQ window was not inspected: computer-use permission denied access to Electron. Browser component checks are not a claim of native-window or live desktop/server verification. PostgreSQL multiconnection lock stress testing also remains outside the local PGlite checks.
- The public app and private server changes remain isolated from concurrent work. The offer is disabled by default; deployment and enablement require a separate release decision.
