> Historical implementation evidence from before consolidation. Paths, branch hashes and pending Git actions below describe that earlier checkpoint. README.md is authoritative for current location, authorization and fresh verification.

# Task 2 report: continuous Room direction

Scope: only C:/Users/ivanc/.codex/worktrees/room-spatial-upgrade/FluidEQ. Compared to controller's Task 1 tree 7c659a141edc4f6610a580cb38b6ea54030788fe. No staging, commits, push, original D: checkout edits, new dependencies, downloaded measurements, UI, ambience, or compare implementation.

## Implemented algorithm

Renderer version 1 keeps nearest-direction selection, original head samples, original 192 kHz linear doubling, and integer head-scale shifts. Renderer version 2 prepares interpolated responses on the control thread:

1. Load/double the already corrected head data without changing its correction or independently normalizing directions.
2. Compute a fixed onset landmark for each measured direction and ear: first sample at which cumulative squared energy reaches 5% of that response's energy. The landmark is an integer sample, gain-independent and fixed for the entire prepared head. No angle-dependent threshold or peak choice occurs during dragging. This is an arrival estimate, not an anatomical onset claim.
3. Find adjacent directions on the circular ring, including 345/0 degrees; normalize finite v2 angles before trigonometry/index conversion.
4. Use the existing feq_fft_in_place with bounded zero padding (4096..16384 samples). Remove each ear response's integer landmark by phase rotation. Interpolate its spectral magnitude linearly and aligned residual phase along the shortest arc. This avoids cancellation from mixing two delayed responses or two residual phases directly. DC interpolates as signed real amplitude; Nyquist remains real.
5. Inverse-transform aligned content. Restore the linearly interpolated landmark plus the v2 fractional head-scale shift with one normalized Blackman-windowed sinc FIR. Radius is ceil(16 * rate / 48000), bounded 8..128; shipped rates use 15/16/32/64 samples. This is finite fractional-delay reconstruction with rate-scaled time support. It is not an explicit direction-dependent low-pass or new diffuse-field correction.
6. Keep causal samples within the existing 2048-tap kernel budget, discarding negative-time support. No extra fixed delay is introduced. Existing arrival-distance delays, sub alignment, regular convolver latency, and direct-head low-latency architecture remain intact.

Exact measurement angles with head_scale=1 bypass interpolation and retain all original samples, including the existing doubled 192 kHz samples. A custom non-unit head scale intentionally gains fractional timing on v2, while v1 retains its original integer timing.

All new vectors, onset estimation, transforms, interpolation and diagnostics are control-thread-only. The audio callback still consumes prepared kernel sets and runs the same convolution path. Head dimensions are capped before allocation/indexing at the existing parser limits of 72 directions and 4096 native taps. Nonfinite head taps are refused while retaining the prior head; nonfinite/unbounded geometry and gains are refused before preparing kernels. Infinite/invalid creation rate is refused (upper C API guard 384 kHz). Unknown native renderer versions normalize to 1. No Task 1 contract regression was changed.

## Alternatives measured and rejected

- Aligned linear time-domain interpolation with finite sinc delay: synthetic timing/gain/bandwidth checks passed, but shipped midpoint tone differed by as much as -15.4 dB at sampled frequencies and midpoint energy fell to about 65% of endpoint mean. Residual HRTF phase still caused cancellation. Rejected.
- Aligned polar interpolation with unconstrained FFT fractional restoration: medium 48 kHz tone improved to about -1.30 dB worst sampled dip, but delayed synthetic impulses developed long sinc tails that biased gain/energy centroid. Rejected.
- An explicit upper-20%-of-Nyquist taper between grid points fixed that synthetic issue but imposed an unnecessary angular bandwidth change. Rejected in favor of finite sinc restoration after integer-landmark alignment.
- Final choice: aligned polar interpolation plus finite sinc restoration. No claim that this necessarily sounds superior; the numbers below describe its remaining tradeoffs.

## Real shipped-head measurements

Every one of 24 cells, both ears, actual small.txt/medium.txt/large.txt at 44.1/48/96/192 kHz. Fractions measured at cell midpoint. Energy ratio is output squared energy divided by mean endpoint squared energy. Tone is output magnitude compared with the arithmetic mean of endpoint magnitudes at 250/1000/4000/8000/12000/16000 Hz. Broad-band comparisons sum power at seven equally log-spaced probes within each one-third-octave band around those centers. These are finite sampled diagnostics, not a full perceptual guarantee.

| Head   |     Hz | Energy ratio    | Sampled tone dB | 1/3-octave dB | Max centroid ITD deviation, us | Max discarded negative energy |
| ------ | -----: | --------------- | --------------- | ------------- | -----------------------------: | ----------------------------: |
| small  |  44100 | .93766.. .98926 | -4.228..1.131   | -.509...131   |                         70.782 |                       1.4678% |
| small  |  48000 | .94453.. .99150 | -5.121..1.166   | -.765...184   |                         69.805 |                       1.4986% |
| small  |  96000 | .94502.. .99172 | -5.125...418    | -.636...080   |                         41.068 |                        .9573% |
| small  | 192000 | .94759.. .99173 | -3.156..1.483   | -.467...089   |                         33.504 |                        .9388% |
| medium |  44100 | .94349.. .99128 | -5.287...769    | -.755...099   |                         73.548 |                       1.4523% |
| medium |  48000 | .94513.. .99177 | -1.296...577    | -.256...097   |                         45.613 |                        .8304% |
| medium |  96000 | .94519.. .99172 | -1.319...613    | -.408...077   |                         44.914 |                        .9877% |
| medium | 192000 | .94755.. .99169 | -2.268...974    | -.987...072   |                         36.353 |                        .9740% |
| large  |  44100 | .94499.. .99167 | -1.092...528    | -.739...120   |                         48.706 |                        .8344% |
| large  |  48000 | .94504.. .99175 | -5.220...324    | -1.222...327  |                         49.269 |                        .8884% |
| large  |  96000 | .94506.. .99172 | -1.114..1.060   | -.938...127   |                         68.367 |                       1.5801% |
| large  | 192000 | .94712.. .99168 | -2.923...721    | -.724...058   |                         37.132 |                        .9590% |

The centroid ITD comparison is to linearly interpolated endpoint energy centroids. Shape interpolation changes that centroid; it is not a direct error estimate for subjective localization. Negative energy is measured before causal truncation, within the padded synthesis window, with the exact final finite restoration filter.

Narrow-frequency exceptions remain. Medium 44.1 kHz's largest sampled dip is 157.5 degrees, left ear, 16 kHz: endpoint magnitudes .075973/.041823, output .032046, -5.287 dB from their magnitude mean. Medium 48 kHz's largest is 7.5 degrees, left ear, 8 kHz: .113341/.021708 to .058168, -1.296 dB. Small 44.1 kHz has a -4.228 dB exception at 52.5 degrees, right ear, 16 kHz with .435475/.255455 to .212327, so not every narrow exception can be dismissed as a near-zero source response. Full worst-frequency diagnostics are in task-2-measurements.log and the final CTest LastTest.log. The broad-band bound passes; narrow high-frequency coloration and causal pre-ringing truncation still deserve listening review.

Across every real boundary, +/-0.001-degree response-vector differences normalized by endpoint energy were <=.0006443. Synthetic boundary probes use angular epsilon .001 * 48000/rate degrees to compare constant physical sub-sample displacement rather than incorrectly applying one absolute sample-vector bound at four sample rates. No endpoint samples were changed to pass these checks.

## Coverage and verification

- New room-interpolation test: synthetic independently known ear delays and gains; midpoint delay within .3 sample and DC gain within .002; no >3% comb-related loss at 1/4/8/12/16 kHz; mirrored-head symmetry and finite positive bounded energy at .25-degree sweeps; all cell boundaries including 0/360 and +/-180; negative/large finite angles; helper NaN repair.
- Full pipeline: exact-grid v1/v2 sample equality, v1 nearest-direction retention, midpoint impulse agreement with prepared response, fractional head-scale timing, unchanged reported latency and sub onset. Bass management disabled for impulse timing. 44.1/48/96/192 kHz, regular and low-latency modes.
- Real heads: exact original sample equality at every grid direction, midpoint energy range .85..1.1 gate, 1/3-octave tone +/-3 dB gate, centroid ITD deviation <100 us gate, boundary continuity, and negative-time energy diagnostics.
- 440 Hz / .2-amplitude continuous input during a direction change across a cell boundary and compatible state transfer: worst adjacent output step .008737, nonzero transfer peak .147718, transferred output equals uninterrupted reference within 1e-6. Both latency modes. This proves the tested signal/state case, not click-free behavior for every possible repeated drag.
- Invalid rate, oversized head counts before dereference, nonfinite taps/angles, unbounded distance, unknown version.

Commands from the worktree (Visual Studio bundled CMake/CTest, vcvars64):

1. `cmd /c .superpowers\sdd\room-upgrade-plan\build-task-2.cmd` (cmake --build native/.build --parallel 4): successful native build. See task-2-build.log.
2. `ctest --test-dir native/.build --output-on-failure -R "^(room|room-presets|room-contract|room-interpolation|chain-surround|chain-transfer|chain-latency)$"`: 7/7 passed, exit 0, 13.85 seconds; recorded in task-2-tests.log. The final interpolation test passed 24,176 assertions.
3. `git diff --check 7c659a141edc4f6610a580cb38b6ea54030788fe --` the six scoped native paths: passed after removing two accidental blank lines at EOF. Git emitted only sandbox global-ignore and normal CRLF notices.

Final test-only iterations: MSVC /WX caught an int literal passed to std::fill on a float vector; corrected to 0.0f. The newly added head-scale impulse test initially configured a previously live renderer and therefore measured its intentional crossfade, not its final kernel; corrected fixture to a fresh prepared renderer. Earlier final-check command continued after the failed test compilation and ran the previous binary; its result is superseded by the build-success-gated final run. No assertions were weakened.

## Exact product/test files

- native/dsp-core/src/room_interpolation.h (new)
- native/dsp-core/src/room_interpolation.cpp (new)
- native/dsp-core/src/room_kernels.cpp
- native/dsp-core/src/room.cpp
- native/dsp-core/tests/room_interpolation_test.cpp (new)
- native/CMakeLists.txt

Scratch report/measurement/edit scripts are under .superpowers/sdd/room-upgrade-plan and are not product files. Controller's scratch bench must add room_interpolation.cpp to its manually enumerated source list. Controller owns frozen-baseline byte comparison, cost/real-time profiling, integration, review, commit/push, device/runtime and listening validation.

## Remaining concerns / boundaries

- Existing retirement overflow and transfer handoff destruction risks are unchanged. No new audio-thread heap lifetime path was added; Task 3 owns the repair.
- Existing 2048-tap arrival/reflection capacity and direct-distance cap remain. At high rates, late content truncates earlier in time; Task 3 owns rate-aware v2 capacity. The final helper currently uses the same kernel budget and will need that new budget propagated when it changes.
- Legacy frozen impulse-bank comparison and v2 preparation/processing timing are controller-owned; this report does not claim they ran here. Exact-grid and original measurement identity checks did run.
- The prior unrelated three engine-dsp-chain game-mode failures were not changed or rerun as part of this seven-target set.
- No THX comparison, total-device-zero-latency claim, subjective superiority, real-device underrun claim, or final listening approval.

## Review fix round 1: zero spectral-bin phase limits

Confirmed the review finding against tree be353c87e6f0cfb6fdd68354a903267fdd63c896. Taking arg(b * conj(a)) returns zero if either bin is zero, discarding the nonzero endpoint's phase. A silent measured direction could consequently jump to a nontrivial neighboring response at the exact-grid bypass.

Changed only room_interpolation.cpp and room_interpolation_test.cpp. Compute each endpoint's aligned phase individually; a zero-magnitude bin borrows its nonzero neighbor's aligned phase. The phase difference is wrapped with std::remainder before interpolation. If both bins are zero their interpolated magnitude remains zero. This preserves the nonzero endpoint limit from either angular direction without changing magnitude interpolation, landmark/delay handling, allocation ownership, or v1 rendering.

New regressions use (a) a completely silent direction neighboring a response with unequal adjacent taps and a later negative tap, and (b) equal taps two samples apart with exact isolated fs/4 spectral zeros neighboring that same nontrivial response. Approach the nonzero endpoint from both sides, require normalized response error <1e-5, retain a positive finite midpoint, and verify the isolated-zero frequency's complex response (including a nonzero imaginary part).

Exact commands from the managed worktree:

1. Before the fix, `cmd /c .superpowers\sdd\room-upgrade-plan\build-task-2.cmd`, then `native/.build/fluideq-room-interpolation-test.exe` after checking build success. Build passed. Test exit 1, 24,184 assertions, 3 failures. Output:

```text
FAIL zero-bin neighbor preserves the nonzero endpoint's phase limit
zero-bin silent=1 endpoint errors 0.480428769 / 4.88974537e-07
FAIL zero-bin neighbor preserves the nonzero endpoint's phase limit
FAIL isolated spectral zero retains the neighboring endpoint's complex response
zero-bin silent=0 endpoint errors 0.00512364382 / 1.18904478e-07
3 check(s) failed
```

Evidence: task-2-fix1-red-build.log and task-2-fix1-red.log.

2. After the fix, `cmd /c .superpowers\sdd\room-upgrade-plan\build-task-2.cmd` passed, exit 0. Then:

```text
"C:/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/ctest.exe" --test-dir native/.build --output-on-failure -R "^(room|room-presets|room-contract|room-interpolation|chain-surround|chain-transfer|chain-latency)$"
```

Output: 7/7 passed, 0 failures, exit 0, 13.72 seconds. New regression output:

```text
zero-bin silent=1 endpoint errors 4.88384083e-07 / 4.88384083e-07
zero-bin silent=0 endpoint errors 1.18904479e-07 / 1.18904478e-07
24184 assertions
all checks passed
```

Evidence: task-2-fix1-build.log, task-2-fix1-tests.log, native/.build/Testing/Temporary/LastTest.log. Real-head tone/energy/timing limits retain the previous printed values; the symmetric tied worst case for medium 48 kHz reports 352.5 degrees/right instead of 7.5 degrees/left, with identical printed metrics.

3. `git diff --no-index --check <file extracted with git show be353c87:...> <current file>` returned exit 1 (files differ) with empty whitespace-diagnostic output for both changed files. Used task-2-fix1-check.py to extract exact reviewed blobs and run these checks. Ordinary tree-to-working diff treats these still-untracked files as deletions because the controller snapshots them through an alternate index; it does not inspect their current contents, so the explicit no-index check is the relevant whitespace evidence for this round.

No staging or commits. Native build is idle. Controller independently reported all 16 legacy impulse banks matched baseline SHA256; that comparison was not rerun in this fix round.
