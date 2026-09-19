# Final Room validation checklist

**Current handoff instruction (2026-09-19): implementation is approved. Continue in `D:/DEV/_PERSONAL/FluidEQ` on `main`. The prior worktree isolation and no-commit instructions are superseded by the user's request to commit, push and merge everything into main. Preserve concurrent edits and follow the repository checks and normal commit/push workflow. Newer main commit eeea63a3a retired Ocean and renamed Black to Dark; use current main theme tokens and do not restore retired themes from these historical mockup examples.**

This is an execution checklist, not a record of passing checks. Record results/evidence as each check actually runs. Use the final source snapshot and record its tree/commit; do not rely on old test binaries or the copied bootstrap bundle.

## Automated and offline checks

- Build the current native code successfully before CTest. Run focused Room/ambience/interpolation/contract/lifetime/surround/transfer/latency/Dimension/analysis-wire tests, then repository required gates once. Retain baseline failure evidence separately. Never run an old test executable after a failed build.
- Run targeted common/renderer/host tests for profile ownership, wire versioning, native report ownership, direct speaker interaction, entitlement/source changes, save/restore/reset. Run TypeScript, changed-file ESLint, style and encoding checks. Inventory exact pre-existing failures against frozen baseline/current main before labeling them unrelated.
- Legacy byte compatibility: independent bench against frozen baseline tree37d5c2d0ad370f6cb2aee3f47697ef7fc55df145 and final code, all16 impulse banks. Feature-off behavior must match expected legacy samples. Do not overwrite the frozen banks.
- V2: all four supported rates, stereo/5.1/7.1, regular/low buffering. Direct/sub/reflection/late/reference timing, Space0, Ambience0, mute/solo/unfed release, silence/reset/seek, source/head/profile changes, repeated compare, honest match-unavailable state. Tail captures need enough time for the full decay; the frozen4096-frame legacy bank is too short to establish late decay at192k.
- Native ownership counters under burst configuration/adoption/transfer and saturation; no audio callback allocation, destruction, locks or I/O. Verify bounded fallback sound when adoption/transfer waits for reclamation.
- Offline CPU: benchmark baseline and final under comparable idle conditions, same compiler/optimization/hardware, rates/channel counts/128-frame blocks, include preparation timing and peak/percentiles. Current sequential baseline runs varied substantially from machine load/thermals; do not claim a regression or improvement from unmatched isolated runs. Distinguish Room-only CPU timing from entire rack/endpoint underruns.
- Record waveform/energy/true-peak/headroom results for the six actual featured values using shipped head. Do not claim subjective superiority from these measurements.

## Real-component browser checks

Use artifact build-room-ui.cjs and room-ui-harness.tsx. They mount actual product components/styles with clearly labelled simulated source/entitlement. Rebuild after final edits. Browser tools only; no raw CDP workaround. Keep a fresh console baseline. This is UI evidence, not installed-engine playback evidence.

1. Desktop1280x720, Ocean: select FL, confirm the first Room view remains selected and the editor is fully visible beside/below the compact graph. Its title/angle/distance/level/mute/solo match selected speaker.
2. Drag a speaker: editor appears on press/start, remains during movement and updates. Default mirrored partner moves; Shift/Ctrl independently moves one. Pointer release commits; cancel/escape/lost capture leaves no stuck drag. Select another speaker and sub; their available controls are correct.
3. Keyboard: tab into speakers, Enter/Space selects without page jump, arrows adjust meaningfully, tab to numeric controls and mute/solo. Focus visible and stable. No SVG img role swallowing interactive descendants. Locked/unfed speakers still disclose their state.
4. Browse Featured/Classic/Saved; select each; apply closes browser and turns Room on. Personal head/correction survive. Edit profile -> Custom; Restore returns selected shape, full Reset restores all Room choices except power. Unknown reopened Custom never invents a restore source.
5. Classic retains old sound version and makes new controls honestly unavailable until explicit upgrade/new-profile selection. Verify upgrade is an explicit action and preserves intended custom geometry.
6. Save same trimmed/case-insensitive name twice; old shape/id survives, new name clearly differs, reload preserves both. Long names and maximum suffix do not overflow. Simulated locked/quota storage cannot announce a persistent save.
7. Toggle Room/Tune/Fit; validate manual listener choices free and guided Fit/shaping Plus boundary. Free built-in profiles, bass/upmix and mute/solo remain available. Missing/idle/stereo-expanded/front-stage/5.1/7.1 sources and centre/sub availability match actual source contract.
8. Compare shows unavailable/learning/ready/Original truthfully from actual native-report interface (QA report simulation, if used, must be explicitly labelled). Surround reference is labelled fold-down. Manual already-spatial bypass is clearly user-chosen. Position protection does not rewrite stored Dimension settings.
9. Repeat at375px and320px content width, Black theme, German longest labels, and reduced motion. No horizontal page overflow/clipped speaker controls/menus, unreadable chip rows or overlapping overlays. A narrow page may scroll within the first Room view; speaker editing must never require Tune navigation.
10. Inspect current console/errors after final rebuild. Save representative desktop selected-pane, narrow selected-pane, Tune, Fit and profile-browser screenshots as evidence with viewport/source/entitlement labelled.

## Runtime/listening gate

Do not auto-launch another FluidEQ window, install the native engine, or restart Windows audio. When code/build/UI/commit are ready, user action may be needed to run the verified build and listen. Report that limit plainly; don't substitute harness visuals for native playback.

Record installed DLL/host identity, endpoint format, source route and complete rack settings. Exercise system and Library playback, both buffering modes, switching/profile/head changes, compare, seeks/silence/output changes and sustained playback. Report actual total measured delay and underruns separately from Room's buffering. Hardware target is p99 under half callback budget and no underruns; frozen192k8ch128-frame legacy already missed it, so an offline run alone cannot satisfy this gate.

Listening: equal-level comparison on familiar music/dialogue/transients and known positional scenes. Check tone/centre/front-back/direction/fatigue independently of preference; test more than one headphone when available. THX comparison only if legitimately available and clearly described. User listening, not UI approval, decides whether sound is successful. Keep this open until real evidence exists.

## Integration

The existing main work was committed and pushed first, then the complete Room implementation was consolidated into main. Continue from the main checkout and preserve any new concurrent changes. Stage explicit owned paths/hunks, inspect the staged diff, run normal hooks, commit and push the remaining feature work. Do not redo the historical private-tree reconciliation.
