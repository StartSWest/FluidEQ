# User report 2026-10-01: slot ladder, profiles bar, high rates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Ivan's rule since 2026-09-27: no agents that edit files — this plan is executed natively, one task at a time). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three defects a FluidEQ 2.0.0 bug report proves (a profiles-bar error at every launch, a rename that loads the profile under its old name, a slot ladder that gives up at a rung another program holds) and extend the engine's rate test to the rates Windows really runs.

**Architecture:** App-side fixes in main (profile list) and the renderer (rename row); the slot ladder learns which rungs are held from the setup helper's own planner (`plan_move`), reported in its `status`; the rate sweep test gains 88.2, 176.4, 352.8 and 384 kHz. The engine DLL does not change, so no user gets an engine update prompt; the helper ships beside the app.

**Tech Stack:** TypeScript (Electron main + React renderer, Jest + Testing Library), C++20 (setup helper, engine tests, CMake/MSVC).

**Spec:** the bug report Ivan pasted on 2026-10-01 (FluidEQ 2.0.0; TOPPING USB DAC at 384 kHz; RME ADI-2 DAC working on GFX; output {FB4275F8} walked efx-single → mfx-single, then `attach --slot sfx-single` refused: "the SFX value already holds another effect, {5C8DC6DB-1A99-46FE-90E8-8229A41DD3EF}", then "Nothing more will be tried"; `ENOENT … presets\da39a3ee5e6b` + "Request failed on getPresetFileList: 4" at every launch; "Loading preset: Untitled profile 1" ×3 then `ENOENT … presets\041e5120c39d\Untitled profile 1` after the profile became "HD 800S").

## Global Constraints

- NO `setTimeout`, NO `setInterval`, no fixed waits in product code.
- Strict TS: no `any`, no `!`, no `@ts-ignore`, no `==`; no `eslint-disable` without an inline justification.
- No new user-facing strings (none needed); if one appears, all ten locales in the same commit.
- Files stay under 500 lines: new native logic goes in `setup/slot_report.*` (77/57 lines), not in `fx_list.cpp` (772) or `main.cpp` (606, which only gains the JSON emission).
- Scripted edits write temp + rename; anything with `$` or a backslash goes through the Edit tool.
- Commit in the shared checkout by private index + CAS `update-ref`, exact blobs, never sweeping other sessions' hunks; never `--no-verify`; pushing is Ivan's.
- Every new test is mutation-checked: break the rule in an export copy and see the named test fail.
- Run Jest directly (`node node_modules/jest/bin/jest.js …`), heavy runs at BelowNormal.
- The engine DLL (`native/system-apo/src`, `native/dsp-core`) is not touched by Tasks 1–4.

## Review Focus

1. Every rung below the current one held by somebody else → the ladder ends with no Windows prompt and a reason that says so (Task 3, "ends when every rung left is held").
2. Our own engine sitting in a single or legacy value → that rung is not reported held (Task 3 native test "our own rung is not held").
3. Windows' own default effect (any of the four `kWindowsDefaultApoClsids`) in a value → not held, because the helper takes it (Task 3 native test).
4. A rename confirmed with Enter, with ✓, or abandoned with ✕ or a click outside → no profile load in any of them (Task 2, three cases).
5. The profile list asked for an output whose folder exists but is empty → `[]` as before, not an error (Task 1 keeps the existing listing path; positive control case).

---

### Task 1: The profiles bar never errors before an output is known

**Files:**

- Modify: `src/main/ipc/profiles.ts:543-558` (`GET_PRESET_FILE_LIST`)
- Modify: `src/main/profileStore.ts:194-216` (comment of `presetDirForDevice`)
- Test: `src/__tests__/unit_tests/main/profileMutationIpc.test.ts`

**Interfaces:** none new.

Cause, one sentence: the window asks for the profile list as it mounts, before any output is known; `presetDirForDevice('')` names a folder (`da39a3ee5e6b`, the SHA-1 of the empty string) without making it, and `readdirSync` throws ENOENT on a missing folder instead of returning nothing — the opposite of what the comment above it says — so every launch logged the error and the bar called `setGlobalError`.

- [ ] **Step 1: Write the failing test** (inside the existing `describe`, after the rename cases)

```ts
it('answers an output with no profile folder yet with no profiles, not an error', async () => {
  // What the window asks as it mounts, before any output is known: a
  // folder that is named but was never made (a 2.0.0 report showed the
  // error at every launch).
  activeDeviceId = 'not-known-yet';
  const reply = await fire(ChannelEnum.GET_PRESET_FILE_LIST, []);
  expect(errors).toEqual([]);
  expect(reply).toHaveBeenCalledWith(ChannelEnum.GET_PRESET_FILE_LIST, {
    result: [],
  });
});

it('still lists an output that has profiles', async () => {
  // The positive control: the folder that exists is read as before.
  const reply = await fire(ChannelEnum.GET_PRESET_FILE_LIST, []);
  expect(errors).toEqual([]);
  expect(reply).toHaveBeenCalledWith(ChannelEnum.GET_PRESET_FILE_LIST, {
    result: [SHARED],
  });
});
```

- [ ] **Step 2: Run it and see the first case fail**

Run: `node node_modules/jest/bin/jest.js src/__tests__/unit_tests/main/profileMutationIpc.test.ts -t "profile folder|still lists"`
Expected: "answers an output with no profile folder yet…" FAILS (`errors` holds `PRESET_FILE_ERROR`); "still lists…" PASSES.

- [ ] **Step 3: Fix the handler**

```ts
onWindowMessage(ChannelEnum.GET_PRESET_FILE_LIST, async (event) => {
  const channel = ChannelEnum.GET_PRESET_FILE_LIST;

  try {
    const dir = activePresetDir();
    // A folder that is not there holds no profiles. The window asks as it
    // mounts, before any output is known, and `presetDirForDevice` names a
    // folder for the empty id without making it; `readdirSync` throws
    // ENOENT on a missing folder rather than returning nothing, so every
    // launch logged "Request failed on getPresetFileList" and put the
    // profiles bar's error in front of the user (a 2.0.0 report).
    const fileNames: string[] = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((fileName) => !isAutomaticPresetName(fileName))
      : [];
    log.info(`Fetched ${fileNames.length} files`);
    const reply: TSuccess<string[]> = { result: fileNames };
    event.reply(channel, reply);
  } catch (e) {
    log.error('Failed to get filenames');
    log.error(e);
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});
```

And in `profileStore.ts`, replace the sentence "reading a directory that is not there fails the same way as reading an empty one, and the profiles bar already draws nothing until an output is known." with: "the list handler answers a folder that is not there with no profiles (`GET_PRESET_FILE_LIST` in `ipc/profiles.ts`) — `readdirSync` itself throws on one."

- [ ] **Step 4: Run the file** — Run: `node node_modules/jest/bin/jest.js src/__tests__/unit_tests/main/profileMutationIpc.test.ts` — Expected: all PASS.
- [ ] **Step 5: Mutation check** — in an export copy revert the `existsSync` guard; the first new case must fail by name.
- [ ] **Step 6: Commit** (private index) — "Answer an output with no profile folder with no profiles, not an error"

---

### Task 2: A rename never loads the profile under its old name

**Files:**

- Modify: `src/renderer/components/PresetListItem.tsx` (edit row, delete-confirm row, `handleConfirmDelete`)
- Test: `src/__tests__/unit_tests/PresetsBar.test.tsx`

**Interfaces:** none new.

Cause, one sentence: the list selects — and attaches — a profile on any click inside its row (`widgets/List.tsx`, `onClick(entry.value)`), and nothing in the rename row stops a click, so placing the cursor in the field, ✓ and ✕ all bubbled up as a selection of the old name; after ✓ the rename reached main first and the load of the old name failed with ENOENT. (Keys are already safe: the row's key handler ignores events from its children.)

- [ ] **Step 1: Write the failing tests** (beside "should disallow invalid renamed presets…")

```tsx
const renderBar = async () => {
  fetchPresets.mockReturnValue(samplePresetNames);
  const user = userEvent.setup();
  await act(async () => {
    setup(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <PresetsBar
          fetchPresets={fetchPresets}
          loadPreset={loadPreset}
          savePreset={savePreset}
          createPreset={createPreset}
          renamePreset={renamePreset}
          deletePreset={deletePreset}
        />
      </FluidEqProviderWrapper>,
    );
  });
  return user;
};

it('renames with the ✓ button without loading the old name', async () => {
  renamePreset.mockResolvedValue(undefined);
  const user = await renderBar();
  await user.click(screen.getAllByLabelText(editIconLabel)[0]);
  const field = screen.getByLabelText(editModeLabel);
  await user.click(field);
  await clearAndType(user, field, 'Apple 2');
  await user.click(screen.getByLabelText('Accept'));
  expect(renamePreset).toHaveBeenCalledWith('Apple', 'Apple 2');
  expect(loadPreset).not.toHaveBeenCalled();
});

it('renames with Enter without loading anything', async () => {
  renamePreset.mockResolvedValue(undefined);
  const user = await renderBar();
  await user.click(screen.getAllByLabelText(editIconLabel)[0]);
  await clearAndType(user, screen.getByLabelText(editModeLabel), 'Apple 2');
  await user.keyboard('{Enter}');
  expect(renamePreset).toHaveBeenCalledWith('Apple', 'Apple 2');
  expect(loadPreset).not.toHaveBeenCalled();
});

it('cancels a rename without attaching the profile', async () => {
  const user = await renderBar();
  await user.click(screen.getAllByLabelText(editIconLabel)[0]);
  await user.click(screen.getByLabelText('Cancel'));
  expect(renamePreset).not.toHaveBeenCalled();
  expect(loadPreset).not.toHaveBeenCalled();
});

it('still loads a profile clicked by its name', async () => {
  // The positive control: the row itself keeps selecting.
  const user = await renderBar();
  await user.click(screen.getByLabelText(samplePresetNames[1]));
  expect(loadPreset).toHaveBeenCalledWith(samplePresetNames[1]);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node node_modules/jest/bin/jest.js src/__tests__/unit_tests/PresetsBar.test.tsx -t "rename|cancels|clicked by its name"`
Expected: "renames with the ✓ button…" and "cancels a rename…" FAIL (`loadPreset` called with 'Apple'); the Enter case and the positive control PASS.

- [ ] **Step 3: Stop clicks at the two editor rows**

In `PresetListItem.tsx`, above the component's early returns:

```tsx
// The rename and the delete question belong to this row, not to the list
// it sits in: the list selects — and attaches — a profile on any click
// inside its row, so a click on the field, ✓ or ✕ also loaded the profile,
// and after ✓ it loaded it by the name the rename had just taken away
// ("Failed to read preset", a 2.0.0 report). Keys need nothing: the row
// ignores those that come from its children.
const keepClickInRow = (e: MouseEvent) => e.stopPropagation();
```

The confirm row:

```tsx
      // A layout box that only keeps clicks from the list underneath; the
      // two buttons inside are the controls and have role and keys of their own.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div
        className="preset-confirm-delete"
        ref={confirmRowRef}
        onClick={keepClickInRow}
      >
```

The rename row:

```tsx
      // As the confirm row above: only keeps clicks from the list underneath.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div className="preset-rename" ref={editRowRef} onClick={keepClickInRow}>
```

And `handleConfirmDelete` drops its own `e?.stopPropagation()` (the row now does it; keeping both is dead code). `handleDeleteClicked` keeps its stop: the bin sits in the normal row, which still selects.

- [ ] **Step 4: Run the bar's and the item's tests** — `node node_modules/jest/bin/jest.js src/__tests__/unit_tests/PresetsBar.test.tsx src/__tests__/unit_tests/PresetListItem.test.tsx` — all PASS; `npx tsc --noEmit -p . --pretty false` exit 0; ESLint on the two files clean.
- [ ] **Step 5: Look at it** — app harness (`.claude/harness-app`, :4460): rename by ✓, by Enter, cancel; the row keeps its spacing; no profile marked ON changes.
- [ ] **Step 6: Mutation check** — remove `onClick={keepClickInRow}` from the rename row in an export copy; "renames with the ✓ button…" must fail by name.
- [ ] **Step 7: Commit** — "Keep a rename's clicks in its row, so ✓ never loads the old name"

---

### Task 3: The slot ladder steps past a rung somebody else holds

**Files:**

- Modify: `native/system-apo/setup/slot_report.h`, `native/system-apo/setup/slot_report.cpp` (new `held_slots`)
- Modify: `native/system-apo/setup/main.cpp:387-398` (status emits `slotsHeld`)
- Test: `native/system-apo/tests/slot_report_test.cpp`
- Modify: `src/common/audioEngine.ts` (`TEngineSlotName`, `slotsHeld`)
- Modify: `src/main/engineStatus.ts` (parse `slotsHeld`; `parseSlotsTried` → `parseSlotList`)
- Modify: `src/main/engineOutputRepair.ts` (`nextSlot` skips held rungs; `whatToTry`; ladder comment)
- Test: `src/__tests__/unit_tests/main/engineOutputRepair.test.ts`, `src/__tests__/unit_tests/main/engineStatusSlots.test.ts`
- Modify: `CLAUDE.md` (slot ladder bullet)

**Interfaces:**

- Produces (C++): `std::vector<Slot> held_slots(const FxValues& values, const FxValues& backup, std::wstring_view clsid);` — in ladder order, every rung `plan_move` refuses.
- Produces (JSON): endpoint member `"slotsHeld":["sfx-single",…]` (names as `slot_name`).
- Produces (TS): `IFluidEngineEndpoint.slotsHeld?: TEngineSlotName[]`; `nextSlot(current, tried = [], held = [])`.

Cause, one sentence: a single or legacy value holding another program's effect is refused by the helper, and the app treated that refusal as the end of the ladder (`useRepairWhenEngineNeverRan` settles on any failed ask), so the report's output stopped at sfx-single with GFX and LFX untried — and GFX is what played on the same user's RME — after spending a Windows prompt on the refusal.

- [ ] **Step 1: Native failing test** (`slot_report_test.cpp`; register the three in `main`)

```cpp
using fluideq_engine::setup::Slot;
using fluideq_engine::setup::held_slots;

constexpr wchar_t kOurs[] = L"{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}";
// The effect that held the report's SFX value.
constexpr wchar_t kVendor[] = L"{5C8DC6DB-1A99-46FE-90E8-8229A41DD3EF}";
// "WM LFX APO", Windows' own: the helper takes its slot.
constexpr wchar_t kWindowsLfx[] = L"{62DC1A93-AE24-464C-A43E-452F824C4250}";

void a_vendors_single_value_is_held() {
  std::printf("a vendor's single value is held, Windows' own is not\n");
  FxValues values;
  values.single[kSfx] = kVendor;
  values.single[kEfx] = kOurs;
  values.legacy[0] = kWindowsLfx;
  CHECK(held_slots(values, values, kOurs) ==
        std::vector<Slot>{Slot::SfxSingle});
}

void our_own_rung_is_not_held() {
  std::printf("our own rung is not held\n");
  FxValues values;
  values.single[kSfx] = kOurs;
  CHECK(held_slots(values, values, kOurs).empty());
}

void every_rung_below_held() {
  std::printf("every one-value rung held\n");
  FxValues values;
  values.single[kSfx] = kVendor;
  values.single[kMfx] = kVendor;
  values.single[kEfx] = kVendor;
  values.legacy[0] = kVendor;
  values.legacy[1] = kVendor;
  CHECK(held_slots(values, values, kOurs) ==
        (std::vector<Slot>{Slot::EfxSingle, Slot::MfxSingle, Slot::SfxSingle,
                           Slot::Gfx, Slot::Lfx}));
}
```

(`legacy[0]` is LFX and `legacy[1]` GFX, as in `fx_list_test.cpp`; the expected order is ladder order: GFX before LFX.)

- [ ] **Step 2: Build and see it fail to compile** — scratch build of `fluideq-engine-slot-report-test` (export of `native` + `assets/room/heads` at HEAD, generated `parameters.h` copied in, BelowNormal): Expected: `held_slots` undeclared.

- [ ] **Step 3: Implement `held_slots`**

`slot_report.h` (add `#include <string_view>` and `#include <vector>`):

```cpp
/**
 * The rungs of the slot ladder this output would refuse now, in ladder
 * order: a single or legacy value that somebody else's effect holds —
 * neither ours nor Windows' own default — exactly as `plan_move` refuses it.
 *
 * The app steps past these rather than asking for them. Asked for, a held
 * rung cost a Windows prompt for nothing and ended the ladder: a 2.0.0
 * report's output had a vendor's effect in its SFX value, the walk stopped
 * there, and GFX — what played on the same user's RME — was never offered.
 */
std::vector<Slot> held_slots(const FxValues& values, const FxValues& backup,
                             std::wstring_view clsid);
```

`slot_report.cpp`:

```cpp
std::vector<Slot> held_slots(const FxValues& values, const FxValues& backup,
                             std::wstring_view clsid) {
  std::vector<Slot> held;
  for (const Slot slot :
       {Slot::Efx, Slot::Mfx, Slot::Sfx, Slot::EfxSingle, Slot::MfxSingle,
        Slot::SfxSingle, Slot::Gfx, Slot::Lfx}) {
    if (!plan_move(values, backup, clsid, slot).refused.empty()) {
      held.push_back(slot);
    }
  }
  return held;
}
```

`main.cpp` (add `using fluideq_engine::setup::held_slots;` beside the other `using` lines), right after the `slotsTried` array is closed:

```cpp
    // And which rungs somebody else's effect holds (`held_slots`), so the
    // app steps past them instead of spending a Windows prompt on a refusal.
    out += L",\"slotsHeld\":[";
    const std::vector<Slot> held = held_slots(
        values, load_backup(endpoints[at].guid).value_or(values), kEngineClsid);
    for (size_t step = 0; step < held.size(); ++step) {
      if (step != 0) {
        out += L',';
      }
      out += L'"';
      out += slot_name(held[step]);
      out += L'"';
    }
    out += L']';
```

- [ ] **Step 4: Native tests pass** — build and run `fluideq-engine-slot-report-test` and `fluideq-engine-fx-list-test`: "all checks passed" in both.

- [ ] **Step 5: TS failing tests**

`engineOutputRepair.test.ts` (in `describe('the slot ladder')`):

```ts
it('steps past a rung another program holds', () => {
  // The 2.0.0 report: a vendor's effect in the SFX value, GFX next.
  expect(
    nextSlot('mfx-single', ['efx-single', 'mfx-single'], ['sfx-single']),
  ).toBe('gfx');
});

it('ends when every rung left is held', () => {
  expect(
    nextSlot(
      'mfx-single',
      ['efx-single', 'mfx-single'],
      ['sfx-single', 'gfx', 'lfx'],
    ),
  ).toBeUndefined();
});
```

and beside the other `whatToTry` cases:

```ts
it('moves past a held rung, and says so when nothing is left', () => {
  const at = {
    guid: RME,
    attached: true,
    backupExists: true,
    slot: 'mfx-single' as const,
    slotsTried: ['efx-single', 'mfx-single'] as TEngineSlot[],
  };
  expect(
    whatToTry(
      status({ endpoints: [{ ...at, slotsHeld: ['sfx-single'] }] }),
      RME,
    ),
  ).toEqual({ kind: 'move', from: 'mfx-single', to: 'gfx' });
  expect(
    whatToTry(
      status({
        endpoints: [{ ...at, slotsHeld: ['sfx-single', 'gfx', 'lfx'] }],
      }),
      RME,
    ),
  ).toMatchObject({
    kind: 'nothing',
    because: expect.stringContaining('held by other programs'),
  });
});
```

`engineStatusSlots.test.ts`:

```ts
it('carries the rungs another program holds, dropping names it does not know', () => {
  expect(
    statusWith({
      slot: 'mfx-single',
      slotsHeld: ['sfx-single', 'from-the-future'],
    }).slotsHeld,
  ).toEqual(['sfx-single']);
});
```

Run: `node node_modules/jest/bin/jest.js src/__tests__/unit_tests/main/engineOutputRepair.test.ts src/__tests__/unit_tests/main/engineStatusSlots.test.ts` — Expected: the new cases FAIL (types and behaviour missing).

- [ ] **Step 6: Implement**

`audioEngine.ts`:

```ts
/** A place the engine can be registered on an output, newest to oldest. */
export type TEngineSlotName =
  | 'efx'
  | 'mfx'
  | 'sfx'
  | 'efx-single'
  | 'mfx-single'
  | 'sfx-single'
  | 'gfx'
  | 'lfx';
```

`slot?: TEngineSlotName;`, `slotsTried?: TEngineSlotName[];` (same docs), and:

```ts
  /**
   * The rungs another program's effect holds on this output, which the
   * helper would refuse — the slot ladder steps past them (`nextSlot`).
   * Absent from an older helper.
   */
  slotsHeld?: TEngineSlotName[];
```

`engineStatus.ts`: rename `parseSlotsTried` to `parseSlotList` (doc: "slot names as the helper wrote them; an unknown name is dropped entry by entry"), return type `TEngineSlotName[] | undefined`; add `slotsHeld?: unknown;` to the raw endpoint guard type; in `parseStatusEndpoints`:

```ts
        const slotsTried = parseSlotList(endpoint.slotsTried);
        const slotsHeld = parseSlotList(endpoint.slotsHeld);
        …
          ...(slotsTried ? { slotsTried } : {}),
          ...(slotsHeld ? { slotsHeld } : {}),
```

`engineOutputRepair.ts`:

```ts
export const nextSlot = (
  current: TEngineSlot,
  tried: readonly TEngineSlot[] = [],
  held: readonly TEngineSlot[] = [],
): TEngineSlot | undefined => {
  // (history comment unchanged)
  const history =
    tried.length > 0
      ? [...new Set([...historyBehind(tried[0]), ...tried])]
      : historyBehind(current);
  return SLOT_LADDER.find(
    (rung) =>
      rung !== current && !history.includes(rung) && !held.includes(rung),
  );
};
```

```ts
const to = nextSlot(endpoint.slot, endpoint.slotsTried, endpoint.slotsHeld);
if (!to) {
  const held = endpoint.slotsHeld ?? [];
  return {
    kind: 'nothing',
    because:
      `every slot has been tried on this output (last: ${endpoint.slot})` +
      (held.length > 0
        ? `; held by other programs' effects: ${held.join(', ')}`
        : ''),
  };
}
```

and the `SLOT_LADDER` comment's "the helper refuses otherwise, and that refusal ends the ladder" becomes: "the helper refuses otherwise. It names such rungs in its status (`slotsHeld`) and `nextSlot` steps past them, so a held rung costs no prompt; a refusal is left only for an output that changed between that status and the attach, and it still ends the ladder."

- [ ] **Step 7: Run** — the two TS files PASS; `npx tsc --noEmit -p . --pretty false` exit 0; ESLint clean on the touched files.
- [ ] **Step 8: Mutation checks** — drop `!held.includes(rung)` → "steps past a rung…" fails; make `held_slots` return `{}` → `a_vendors_single_value_is_held` fails; the emission in `main.cpp` has no unit test, so run the newly built helper's `status | Out-String` (read-only, unelevated, from the scratch build) and see `"slotsHeld":[…]` on every endpoint.
- [ ] **Step 9: CLAUDE.md** — in the slot ladder bullet, after "The first rung that is heard stays.", add: "A rung another program's effect holds is skipped, not asked for: the helper's `status` names them per output (`slotsHeld`, from `plan_move` itself) and `nextSlot` steps past them — a 2.0.0 report's ladder had stopped at a vendor's SFX value with GFX, which played on the same user's RME, never tried."
- [ ] **Step 10: Commit** — "Step the slot ladder past rungs another program holds"

---

### Task 4: The rate test covers every rate Windows runs an output at

**Files:**

- Modify: `native/system-apo/tests/rate_sweep_test.cpp:9-21, 53`
- Modify: `CLAUDE.md` (the "measured at 44.1, 48, 96 and 192 kHz" bullet)

Already measured on 2026-10-01 in a scratch build of HEAD with the eight rates: every check passes (the −20 dB peak exact, the shelf within 0.08 dB, the rack 4.80–4.98 dB). So this task is coverage, and its premise fix: the comment says 192 kHz "is the highest a shared-mode endpoint is offered", and the report's TOPPING ran the engine at 384 kHz in shared mode.

- [ ] **Step 1:** `constexpr uint32_t kRates[] = {44100, 48000, 88200, 96000, 176400, 192000, 352800, 384000};` with the comment rewritten: the eight rates Windows offers a shared-mode output, 384 kHz included (a TOPPING DAC in a 2.0.0 report ran the engine there).
- [ ] **Step 2:** Build and run `fluideq-engine-rate-sweep-test` — "all checks passed".
- [ ] **Step 3:** CLAUDE.md: the bullet names the eight rates, and adds the cost measured on Ivan's i9-14900HX with a Bass Punch + Maximizer rack: 0.65 ms of work per 10 ms block at 48 kHz, 2.9 ms at 384 kHz on a performance core, up to 5.3 ms on an efficiency core.
- [ ] **Step 4: Commit** — "Measure the EQ and the rack at all eight output rates"

---

### Task 5: Verify and land

- [ ] Full Jest from an emptied export (BelowNormal, capped workers); native `ctest -j 12` for the setup and engine tests touched; `npx tsc` ×2 (app + e2e); `pnpm lint` on touched files; encoding check.
- [ ] Ivan's look: Task 2 in his window (rename by ✓, Enter, cancel). Tasks 1 and 3 have nothing to look at in a healthy window: say so.
- [ ] Commits stay local; Ivan pushes (2.0.1). No engine update reaches users: the DLL is unchanged and the helper ships beside the app.
