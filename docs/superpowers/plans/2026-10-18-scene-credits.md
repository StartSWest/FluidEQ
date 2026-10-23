# Scene credits: own scenes for good, no subscription — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Ivan: no worker agents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Plus subscription with credit packs: a scene is made by its owner or bought once for one credit and kept for good; the Studio and publishing are free; an unpublished scene plays only as a watermarked draft inside the Studio.

**Architecture:** The server keeps an append-only credit ledger and an ownership table, and every gate that asked "is this account paying" asks "does this account own this scene" instead. Stripe Checkout sells the packs (one-time payments, Ivan's own Stripe account); a signed webhook writes the credits. The app replaces its one global `entitled()` with a per-scene ownership set from the server, keeps every version it has downloaded on disk, and the server keeps only a scene's current and previous version.

**Tech Stack:** Supabase Postgres migrations + Deno edge functions (fluideq-premium, PGlite whole-chain tests); Electron main/preload/renderer (TypeScript, React, Jest); Stripe Checkout + webhooks.

**Spec:** this document's "Decisions" section — Ivan's words from 2026-10-18 in this session, quoted.

## Decisions (the spec)

Ivan, 2026-10-18: "no habrá sub mensuales", "o las hacen ellos mismos o las compran", "paquetes de crédito … 5 USD por 5 escenas … si quieren más que paguen otro paquete", "quien la hace la ve, pero quien no la hace la paga", "necesitan publicar para poder ver", "todas las escenas … 10 s … y pedir confirmación; si no hay crédito comprar ahí mismo; si hay crédito: ¿seguro? no se puede deshacer, se gastará el crédito", "podrán reproducir cualquiera de las versiones … sin malgastar recursos del servidor", and "ok lets do it" to:

- Packs: **5 credits $4.99**, **12 credits $9.99**, **30 credits $19.99**. Every scene costs **1 credit**.
- **3 starter credits** once per confirmed account.
- A creator earns **1 credit** each time a _paying_ buyer takes their scene, and **3 credits** per approved scene (replaces the maker month). Creators are never paid money.
- An owned scene works everywhere: graph, desktop background, player, desk lights.
- Current Plus members keep, for good, every scene they added, plus bonus credits: **10** for a paid member, **5** for a gift, trial or maker month.
- Every scene can be played for **10 seconds** by anyone signed in before buying.
- Versions: an owner may play any version **this computer has had**; the server keeps only the **current and the previous** version of each scene.
- Drafts: unpublished scenes play only on the Studio stage, small, no full screen, watermarked "Draft · publish to see it full", for everyone including paying accounts. The maker sees their own **published** scene everywhere for free.

## Global Constraints

- No `setTimeout`/`setInterval`; the store refreshes on window focus/visibility like `trialStore.ts`.
- Every user-facing string in all ten locales in the same commit; register per `i18n-register-and-names`.
- Server tests build every migration in order with the chain-without-the-migration as control; mutation-check every new rule.
- Commit by private index in the shared checkout; server deploys only on Ivan's word, from a clean `git archive`.
- Secrets (Stripe keys, webhook secret) are Supabase secrets Ivan sets; no key in any file or message.
- The current Plus path keeps working until the cutover migration (Task 9): until then ownership is checked **or** `is_paying`.

## Review Focus

1. A Stripe webhook delivered twice, or a refund after the credit was spent → credits granted once; a refund drives the balance negative and blocks buying until it is back to zero.
2. Two buys of the last credit at once (two windows) → exactly one scene bought, the other refused `no_credits`.
3. A buyer farming starter credits on alt accounts to reward their own scene → rewards only from buyers who have paid for a pack, never from the author to themself.
4. A scene unpublished or blocked after it was bought → the owner keeps the copy on disk and can play it; it cannot be re-downloaded and nobody new can buy it.
5. A member who paid BMAC after the cutover → listed for a refund in the admin page (Task 9), never silently charged for nothing.

---

### Task 1 (DONE 6962ade): Credits and ownership tables, starter credits (server 0055)

**Files:**

- Create: `fluideq-premium/supabase/migrations/0055_scene_credits.sql`
- Test: `fluideq-premium/tests/scene-credits.test.mjs`

**Interfaces:**

- Produces tables `credit_ledger(id bigint identity, user_id uuid fk cascade, delta integer not null <> 0, kind text check in ('purchase','spend','starter','creator-sale','creator-approved','refund','migration','admin'), ref text not null, created_at)` with `unique (kind, ref)`; `owned_scenes(user_id, author_id uuid, scene_id text, source text check in ('credit','migration','admin'), acquired_at, primary key (user_id, author_id, scene_id))`; `credit_packs(id text pk, credits int, price_cents int, stripe_price_id text, active bool)` seeded `pack-5 / 5 / 499`, `pack-12 / 12 / 999`, `pack-30 / 30 / 1999`.
- Produces `credit_balance(p_user uuid) returns integer` (private), `owns_scene(p_user uuid, p_author uuid, p_scene text) returns boolean` (private: owned row, or the author, or an official scene for an official publisher), `my_store() returns jsonb {balance, starterClaimed, owned:[{authorId,sceneId}]}`, `claim_starter_credits() returns integer` (confirmed email only, once: ledger `starter` ref = user id).
- RLS on, revoked from anon/authenticated; reads only through the functions.

- [ ] Step 1: tests `the balance is the sum of the ledger`, `starter credits come once and only to a confirmed account`, `nobody reads another account's credits`, `the author and an official publisher own their scenes without buying` — then the control without 0055.
- [ ] Step 2: run, expect fail (`relation credit_ledger does not exist`).
- [ ] Step 3: write the migration.
- [ ] Step 4: run, expect pass; mutation-check starter-once and the ledger's `unique(kind, ref)`.
- [ ] Step 5: commit (server repo).

### Task 2 (DONE 6962ade): Buying a scene (server 0055 cont.)

**Interfaces:**

- Produces `buy_scene(p_author uuid, p_scene text) returns jsonb {balance, owned:true}`; raises `no_credits`, `already_owned`, `own_scene`, `unknown_scene`, `blocked`, `negative_balance`. Serialized per buyer with `pg_advisory_xact_lock(hashtext('credits:' || uid))`. Member scene must be in `published_scenes` and not blocked; official must be in `scene_packs`. Writes ledger `spend -1` ref `<author>:<scene>`, an `owned_scenes` row, and — when the buyer has any `purchase` row, is not the author, and the scene is a member's — ledger `creator-sale +1` for the author ref `<buyer>:<author>:<scene>`.

- [ ] Step 1: tests `buying spends one credit and owns the scene`, `the last credit buys exactly one scene when two buys race` (two sessions, advisory lock), `a second buy of the same scene is refused and spends nothing`, `a creator earns from a paying buyer and never from starter-only buyers or themself`, `a blocked or unpublished scene cannot be bought`, `a negative balance cannot buy`.
- [ ] Steps 2–5 as above.

### Task 3 (DONE 4b578a5): Gates move from paying to owning (server 0056)

**Files:** Create `0056_owning_opens_scenes.sql`; test `owning-opens-scenes.test.mjs`.

**DONE 4b578a5.** `official_scene_preview` and member scene files open to any signed-in account (the taste; the app holds it to 10 s); `official_sample_scenes` lists every official scene; `record_scene_add`, `record_official_scene_add`, `like_scene` need `may_keep_scene` (owned, or Plus until the cutover). Dropped on the way: the 30-tastes-a-day cap (a member taste is a storage read the server cannot count) and a gallery `owned` column (its new shape broke re-running earlier migrations; owned comes from `my_store`).

- [ ] Tests: `an owner downloads and likes a scene they bought`, `a paying member still does (until the cutover)`, `anybody signed in can taste any published scene, at most 30 a day`, `the gallery says which scenes the asker owns`; control without 0056.

### Task 4 (DECIDED 10-19: server keeps only the current version, as today; the app keeps every version it had — folded into Task 8): Versions

**Files:** Create `0057_two_versions_kept.sql`; modify `supabase/functions/publish-member-scene` and `_shared/officialshare.ts` (re-vendor per `vendor --check`); test `two-versions-kept.test.mjs` + the function test.

**Interfaces:** member payloads stored at `<author>/<scene>/v<version>/pack.json` (and picture); on publish the function deletes every stored version below the previous one. `official_scene_previous(scene_id pk, version, envelope)` keeps one prior official envelope. `scene_version_payload(p_author, p_scene, p_version)` answers the stored current/previous to an owner only.

- [ ] Tests: `publishing a third version leaves the current and previous stored`, `only an owner fetches a stored older version`, `a version no longer stored answers not_kept`.

### Task 5 (DONE 454924c, migration 0057 `credit_purchases`): Stripe checkout and webhook

**Files:** Create `supabase/functions/create-credit-checkout/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `_shared/stripe.ts` (signature check: HMAC-SHA256 of `t.payload` against `STRIPE_WEBHOOK_SECRET`, 5-minute tolerance, constant-time compare); tests `credit-checkout-function.test.mjs`, `stripe-webhook-function.test.mjs` (real handlers, mocked fetch, the repo's PostgREST emulator pattern).

**Interfaces:** `create-credit-checkout` (JWT required) takes `{packId}`, creates a Checkout Session (`mode=payment`, the pack's `stripe_price_id`, `client_reference_id`=user id, `metadata.pack`), returns `{url}`. `stripe-webhook` (no JWT, signature required): `checkout.session.completed` with `payment_status=paid` → `grant_purchase(p_user, p_pack, p_session)` (service role; ledger `purchase` ref = session id); `charge.refunded` / `charge.dispute.created` → `revoke_purchase(p_session)` (ledger `refund` −credits, may go negative). Any other event → 200, nothing written.

- [ ] Tests: `a paid session grants its pack once however often it is delivered`, `an unsigned or stale or tampered event is refused 400 and writes nothing`, `an unpaid session grants nothing`, `a refund takes the credits back even when spent`, `checkout refuses an unknown or inactive pack and a signed-out caller`.

### Task 6: App — store state and ownership replace `entitled()`

**Files:** Create `src/common/sceneStore.ts` (types + parsers: `ISceneStore {balance, starterClaimed, owned: Set<lookId>}`, `parseSceneStore`), `src/main/plus/sceneStoreApi.ts` (`fetchStore`, `buyScene`, `claimStarter`, `startCheckout`), `src/main/ipc/sceneStore.ts` (channels `scene-store-get`, `scene-store-buy`, `scene-store-checkout`), `src/main/sceneStoreBridge.ts`, `src/renderer/plus/sceneStore.ts` (store hook, refresh on focus/visibility); modify `src/main/plus/galleryAccess.ts` (`owns(lookId): boolean` beside `entitled()`; `entitled()` becomes "owns anything or paying" only where a page needs it), and every main gate listed by `grep -n "entitled()"` in `visibleScenes.ts`, `scenePacks.ts`, `sceneTaste.ts`, `wallpaper/manager.ts`, `lighting/lightingService.ts`, `plusGallery.ts`, `memberSharing.ts` → `owns(lookId)`.

- [ ] Tests per module (`sceneStore.test.ts`, `sceneStoreIpc.test.ts`, gate tests updated): `a scene not owned does not play on the graph, the desktop or the lights`, `a bought scene plays everywhere at once after buying`, `the store asks again on focus, never on a clock`.

### Task 7: App — taste, buy confirmation, packs, credits in the account

**Files:** Create `src/renderer/plus/BuySceneDialog.tsx` (with credits: "Use 1 credit for <name>? It is yours for good. This cannot be undone." quiet Cancel / loud Use 1 credit; without: the three packs, loud on 12), `src/renderer/account/CreditsCard.tsx`; modify `GalleryCard.tsx`, `ScenePage.tsx` (Owned / Get · 1 credit; 10-second taste for every scene via `SceneTaste`), `AccountDialog.tsx`; i18n `store.*` in ten locales; styles reuse `gallery-report-dialog` rows and `button small`/`subtle`.

- [ ] Tests: `buying asks first and spends only on yes`, `no credits opens the packs and the checkout in the browser`, `coming back with credits shows the confirmation again`, `an owned scene shows Owned and no buy button`; harness check at 900/1280/1920 in en/de/ru.

### Task 8: Studio free, drafts watermarked, versions kept on disk

**Files:** modify `src/main/ipc/studioProjectsIpc.ts`, `projectAccess.ts`, `studioLooksCopy.ts`, `studioInspect.ts` (no Plus gate; `STUDIO_TRIAL_PROJECTS` removed), the Studio stage component (draft watermark, no full screen, no "Add to my looks" for an unpublished scene), `src/main/memberScenes/store.ts` (keep each downloaded version under `<look>/v<version>/`, newest 10 per scene), `SceneVersions.tsx` (play a kept version).

- [ ] Tests: `an unpublished scene never reaches the graph or the desktop`, `the stage marks a draft and offers no full screen`, `a version this computer had plays again after an update`, `the eleventh version kept drops the oldest`.

### Task 9: Cutover — Plus ends (server 0058, app, terms)

**Files:** Create `0058_plus_becomes_credits.sql`: for every account with a live `entitlements` row: `owned_scenes` from `scene_adds` + `official_scene_adds` (source `migration`), ledger `migration` +10 (plan `plus`) or +5 (`gift`, `trial`, `maker`); `is_paying` callers switched to `owns_scene` only; `maker_note_decision` grants ledger `creator-approved +3`; trial/maker/gift functions retired; board ranks accounts that own a bought scene or have an approved one. Admin: "Paid after the cutover" list (BMAC charges with `paid_at > cutover`) for refunds. Terms: new edition (credits, licence for the life of FluidEQ, no cash value, refunds of unused credits within 14 days, creators earn credits only) in ten locales with its notice; release-note lines.

- [ ] Tests: `a paid member keeps every scene they added and gets 10 credits`, `a gift member gets 5`, `the cutover twice changes nothing`, `an approved scene earns 3 credits once`.
- [ ] Ivan's steps (his alone): create the Stripe account and products, set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, turn off the BMAC membership tiers on cutover day.
