> Historical implementation evidence from before consolidation. Paths, branch hashes and pending Git actions below describe that earlier checkpoint. README.md is authoritative for current location, authorization and fresh verification.

# Task 1 report: Room contract, persistence and wire

## Status

Implemented the bounded contract/schema/persistence/wire task in `C:/Users/ivanc/.codex/worktrees/room-spatial-upgrade/FluidEQ`. No commits, staging, push, resets, or original checkout edits. Native audio algorithms and Room UI are intentionally owned by later tasks.

## API contract

`IRoomSettings`, `FeqChainSettings.room`, and `FeqRoomSettings` now carry:

| TypeScript           | Native                 | Range / default                                | Ownership                  |
| -------------------- | ---------------------- | ---------------------------------------------- | -------------------------- |
| rendererVersion      | renderer_version       | 1 or 2; default 1                              | room shape                 |
| earlyReflectionDb    | early_reflection_db    | -60..0; default 0; -60 exact off on renderer 2 | room shape                 |
| ambienceMix          | ambience_mix           | 0..1; default 0                                | room shape                 |
| ambienceDecayS       | ambience_decay_s       | 0.1..1.8; default 0.5                          | room shape                 |
| ambienceDampingHz    | ambience_damping_hz    | 1000..12000; default 6000                      | room shape                 |
| preservePosition     | preserve_position      | boolean / int flag; default false              | room shape                 |
| compareOriginal      | compare_original       | boolean / int flag; default false              | runtime comparison         |
| sourceAlreadySpatial | source_already_spatial | boolean / int flag; default false              | listener/source preference |

Missing/invalid renderer versions normalize to 1 in the TS settings clamp; wire decoders reject invalid versions. Numeric settings clamp through the shared ranges; nonfinite input takes the field default. Native settings defaults and chain configure copies propagate all eight fields. Actual sample-rate damping caps and -60 DSP behavior remain the native renderer task.

All existing preset identifiers and ordering remain intact, with version-1 legacy defaults. Saved rooms include the six sound-shape fields and exclude comparison/source preference. Old saved rooms load as version 1 with ambienceMix 0. Matching compares all six sound-shape additions. Applying room presets, named shapes, or chain presets preserves current comparison/source preference and existing head/correction choices. Portable named/exported chain presets clear comparison/source preference to false. Reset clears every Room setting to defaults except enabled.

## Exact wire contract

The leading 157 scalars and seven scalars per EQ band remain unchanged. Let B = 157 + 7 * bandCount.

Accepted legacy sizes are B, B+3 (normalizer), and B+4 (normalizer plus low_latency). New sizes are strictly B+15:

- B..B+2: normalizer mode, true peak ceiling, target loudness (unchanged).
- B+3: explicit low_latency 0 or 1, always present with the Room trailer.
- B+4: tag 1380929357 (0x524f4f4d, ASCII ROOM).
- B+5: trailer schema version 1 (distinct from renderer version).
- B+6: payload length 8.
- B+7..B+14: rendererVersion, earlyReflectionDb, ambienceMix, ambienceDecayS, ambienceDampingHz, preservePosition, compareOriginal, sourceAlreadySpatial.

Tagged trailer size is 11; maximum entire tail is 15. New Room data is emitted only when at least one new field differs from the legacy default. Otherwise the encoder retains the original normalizer and optional game-mode bytes. Old native decoders accept only B/B+3/B+4 and therefore reject B+15 without reinterpreting bands. New TS/native validators reject unsupported lengths, tags, schema versions, renderer versions, all nonfinite values, numeric bounds violations, and flags other than 0/1. Native rejection leaves the caller settings untouched. Both validators accept an explicit zero game-mode flag, matching native legacy behavior.

`FEQ_CHAIN_MAX_PARAMS` is 620 = 157 + 64*7 + 15. The host validates this before allocation; APO grammar caps parsed scalars at the same maximum and includes the core wire header through an explicit private include dependency. This also fixes the old host ceiling omitting game-mode's extra scalar. APO signatures already serialize every `dsp_values` scalar with 17-digit precision; no signature change is needed. Host/renderer snapshots already carry the entire encoded array; room-head slot and leading band count remain fixed. Legacy parity fixtures use their independent frozen layout and are untouched.

## Changed files

- src/common/dsp/chain.ts
- src/common/dsp/chainWire.ts
- src/common/dsp/roomPresets.ts
- src/common/dsp/presets.ts
- src/common/dsp/dspChainPresetFile.ts
- src/renderer/dsp/savedRooms.ts
- native/dsp-core/include/fluideq/chain.h
- native/dsp-core/include/fluideq/room.h
- native/dsp-core/src/chain.cpp
- native/dsp-core/src/chain_decode.cpp
- native/dsp-core/src/room.cpp (defaults only)
- native/dsp-host/src/main.cpp
- native/system-apo/src/config_grammar.cpp
- native/system-apo/CMakeLists.txt
- native/CMakeLists.txt
- native/system-apo/tests/dsp_chain_test.cpp (parser limit regression only)
- native/dsp-core/tests/room_contract_test.cpp (new)
- native/dsp-core/tests/room_contract_fixture.h (new, actual generated encoder output)
- src/**tests**/unit_tests/common/dspRoomContract.test.ts (new)
- .erb/scripts/generate-room-contract-fixture.ts (new)

## Verification

Runtime: bundled node at `C:/Users/ivanc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`; no dependencies installed. Existing node_modules junction reused.

1. Fixture generation: `node -e "require('./node_modules/ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS'}});require('./.erb/scripts/generate-room-contract-fixture.ts');"` — passed. Jest verifies the checked-in native fixture exactly matches current encoder output.
2. `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath` with dspRoomContract, dspChainWire, dspRoomPresets, dspRoomSpeakers, dspRoomLibrary, gameMode — 6 suites / 44 tests passed after final TS changes. Separate dspChainPresetFile suite — 4 tests passed. Total 7 suites / 48 tests passed.
3. Legacy-byte audit: evaluated `chainWire.ts` from baseline tree 37d5c2d0ad370f6cb2aee3f47697ef7fc55df145 and compared output to current encoder for default Room + all 11 presets, each with game mode off/on — all 24 snapshots exactly identical.
4. Targeted ESLint of the seven scoped source/test TS files — zero errors. The generator lives under normally ignored `.erb`; forcing it into the project linter is unsupported because neither ESLint tsconfig includes scripts. It was executed successfully for fixture generation; no lint/tsconfig rules were changed.
5. `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` — fails only on three unrelated baseline errors: dspHostLatencyWire.test.ts:38/40 refers to missing IHostTelemetry.processingLatency; VoicingQuickPick.tsx:19 omits required RichPick.groupLabel. No Room contract diagnostics.
6. Controller-run native rebuild — passed after declaring the config grammar's core header include dependency. New `room-contract` native test passes. Controller focused CTest: 10/11 passed, including room, room-presets, room-contract, chain-surround, chain-transfer, chain-latency, dimension, engine-config, engine-channel-layout, engine-room-head. engine-dsp-chain has three existing `gaming_rack_off` failures (lines 575/576/579 before the added parser regression shifts lines): low_latency false, unchanged latency, curves nonzero. Controller is independently checking frozen baseline. Evidence: `.superpowers/sdd/room-upgrade-plan/native-contract-build.log`, `native-contract-tests.log`. Controller needs to ensure the last parser-limit regression addition was included in its final build/run.

Jest initially ran zero tests because ignored built bundles were absent. Copied the original checkout's existing main.js and renderer.js into the isolated worktree's ignored dist folders, leaving default Jest bootstrap unchanged. These are bootstrap artifacts, not runtime verification of changed source. ESLint initially tried its config's automatic `pnpm postinstall` because ignored renderer DLL manifest was missing; the sandbox blocked it before installation. Copied existing ignored renderer.json and renderer.dev.dll.js into the worktree, then scoped lint succeeded. No original files or dependency directories were changed.

## Pending / concerns

- Controller owns native DSP implementation, UI, runtime/aural validation, integration, commits/push.
- Existing full-typecheck failures remain outside this task's scope.
- Native engine-dsp-chain game-mode failures need the controller's baseline classification; no assertions were weakened.
- Native new renderer behavior is not implemented by this task: new fields now reach the DSP intact.

## Review fix round 1: sparse array payloads

Confirmed the review finding: Array.every skips absent indices, while undefined Room numeric values pass the negative range comparisons; the host serializer leaves those buffer entries zero-filled. Replaced the global finite-number Array.every check with an index-by-index loop so every declared scalar is visited and a missing value is rejected before any legacy or Room branch.

Regression coverage:

- Sparse early-reflection and ambience-mix slots each fail validation while maintaining their original array length; replacing the hole with an explicit valid zero passes as the positive control.
- Deleting every scalar position in turn fails for all four supported layouts: legacy without normalizer, legacy with normalizer, legacy with game mode, and the extended Room trailer. Dense versions pass before the mutations.

Exact checks run after the fix (bundled Node executable, worktree cwd):

- `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/__tests__/unit_tests/common/dspRoomContract.test.ts src/__tests__/unit_tests/dspChainWire.test.ts src/__tests__/unit_tests/dspHostWireLayout.test.ts` — 3 suites, 41 tests passed, exit 0.
- `node node_modules/eslint/bin/eslint.js src/common/dsp/chainWire.ts src/__tests__/unit_tests/common/dspRoomContract.test.ts` — passed, exit 0, no diagnostics.
- `git diff --check 37d5c2d0ad370f6cb2aee3f47697ef7fc55df145 -- src/common/dsp/chainWire.ts src/__tests__/unit_tests/common/dspRoomContract.test.ts` — passed, exit 0 (only sandbox global-ignore read warning).

No native files changed in this round. Controller independently confirmed the native engine-dsp-chain failures exactly match the frozen baseline's same three assertions; controller owns rerunning the latest parser-limit test build. No staging or commits.
