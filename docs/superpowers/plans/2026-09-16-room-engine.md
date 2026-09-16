# Room, sub-project 1: the engine stage and the wire — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `FeqRoom` stage in the DSP rack that renders every channel of a stream as a speaker in a shoebox room through a measured head, out on the front pair; its settings on the chain wire; the head sets shipped; the engine loading a head from its config folder; every claim held by a test. Nothing on screen yet beyond the status fields the card will read.

**Architecture:** `FeqRoom` is a dsp-core stage like `FeqDimension`: created with the chain, configured on the control thread (kernels built there and handed to the audio thread through an atomic exchange, faded in by the convolver's blend), processed after Bass Punch and before Dimension. Kernels are one per (channel, ear): the direct HRIR of the speaker's direction plus four image-source wall reflections through the HRIRs of their directions. The head is a ring of 24 directions × 2 ears × 256 taps at three rates, shipped as text under `assets/room/heads/` and written by the app into the engine's config folder as `fluideq-room-head.txt`.

**Tech Stack:** C++17 (MSVC, `feq_strict`), the existing partitioned convolver (`fluideq/convolver.h`, partition 512), TypeScript (main + common), Jest, the native test executables under `native/CMakeLists.txt` and `native/system-apo/CMakeLists.txt`.

**Spec:** `docs/superpowers/specs/2026-09-16-room-design.md`

## Global Constraints

- No `setTimeout`/`setInterval` anywhere; no allocation on the audio thread; every buffer allocated in `create`.
- `FEQ_CHAIN_PARAM_LEAD` moves from 115 to 138 (twenty-three room scalars): regenerate `kReferenceLine` in `native/system-apo/tests/dsp_chain_fixture.h` from the real encoder in the same commit; `dspChainWire.test.ts` reads the header.
- Files under 500 lines; comments state constraints and measured numbers, never what the next line does.
- Every user-facing string in ten locales (none in this sub-project: no UI).
- Status text pinned on both sides: `status_test.cpp` and `engineHealth.test.ts` in the same commit when fields are added.
- Heads: SADIE II (Apache 2.0, cite DOI 10.3390/app8112029) and MIT KEMAR (free, cite MIT Media Lab 1994). Never HeSuVi's files.
- Commit by private index (`GIT_INDEX_FILE`), `--no-verify`, after `tsc`, `eslint`, `prettier` by hand; native tests through `.erb/scripts/build-native-dsp.ts --test`.

---

### Task 1: The head file format and its parser (engine side)

**Files:**

- Create: `native/system-apo/src/room_head.h`, `native/system-apo/src/room_head.cpp`
- Test: `native/system-apo/tests/room_head_test.cpp`
- Modify: `native/system-apo/CMakeLists.txt` (test target + source in the DLL)

**Interfaces:**

- Produces: `struct RoomHead { uint32_t directions; uint32_t taps; double sample_rate; std::vector<float> left; std::vector<float> right; }` (ring order: azimuth 0°, 15°, … 345° clockwise seen from above, left ear then right ear per direction, `taps` floats each); `std::optional<RoomHead> parse_room_head(const std::string& text, double stream_rate)` picks the block whose rate matches `stream_rate` (44100, 48000, 96000; 192000 takes the 96000 block and marks `needs_doubling = true`).

The file the app writes (`fluideq-room-head.txt`):

```
# FluidEQ room head v1 medium
rate 44100 directions 24 taps 256
<24*2*256 numbers, one direction's left ear then right ear, space separated, one direction per line>
rate 48000 directions 24 taps 256
...
rate 96000 directions 24 taps 256
...
```

- [ ] **Step 1: Write the failing test**

```cpp
// native/system-apo/tests/room_head_test.cpp
#include "../src/room_head.h"
#include <cstdio>
#include <string>
using fluideq_engine::parse_room_head;
namespace {
int g_failures = 0;
void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) { std::printf("  FAIL %s:%d: %s\n", file, line, expr); ++g_failures; }
}
#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)
std::string block(int rate, int directions, int taps) {
  std::string out = "rate " + std::to_string(rate) + " directions " +
      std::to_string(directions) + " taps " + std::to_string(taps) + "\n";
  for (int d = 0; d < directions; ++d) {
    for (int ear = 0; ear < 2; ++ear) {
      for (int t = 0; t < taps; ++t) {
        out += (t == 0 ? (ear == 0 ? "1 " : "0.5 ") : "0 ");
      }
    }
    out += "\n";
  }
  return out;
}
}  // namespace
int main() {
  std::printf("room head file\n");
  const std::string text = "# FluidEQ room head v1 medium\n" +
      block(44100, 24, 8) + block(48000, 24, 8) + block(96000, 24, 8);
  auto head = parse_room_head(text, 48000);
  CHECK(head.has_value());
  CHECK(head && head->directions == 24 && head->taps == 8);
  CHECK(head && head->sample_rate == 48000);
  CHECK(head && head->left.size() == 24 * 8 && head->right.size() == 24 * 8);
  CHECK(head && head->left[0] == 1.0f && head->right[0] == 0.5f);
  CHECK(head && !head->needs_doubling);
  auto high = parse_room_head(text, 192000);
  CHECK(high && high->sample_rate == 96000 && high->needs_doubling);
  CHECK(!parse_room_head(text, 22050).has_value());
  CHECK(!parse_room_head("# FluidEQ room head v1\nrate 48000 directions 24 taps 8\n1 2 3\n", 48000).has_value());
  CHECK(!parse_room_head("", 48000).has_value());
  if (g_failures == 0) { std::printf("\nall checks passed\n"); return 0; }
  std::printf("\n%d check(s) failed\n", g_failures); return 1;
}
```

- [ ] **Step 2: Add the test target and run it to see it fail to build**

In `native/system-apo/CMakeLists.txt` after the channel-layout test:

```cmake
# The head file the app writes for the room: a missing block or a short one
# must read as "no head", never as a head of zeros.
add_executable(fluideq-engine-room-head-test
  tests/room_head_test.cpp src/room_head.cpp)
target_link_libraries(fluideq-engine-room-head-test PRIVATE feq_strict)
add_test(NAME engine-room-head COMMAND fluideq-engine-room-head-test)
```

Run: `node node_modules/ts-node/dist/bin.js .erb/scripts/build-native-dsp.ts --test`
Expected: build fails (no `room_head.h`).

- [ ] **Step 3: Write the parser**

```cpp
// native/system-apo/src/room_head.h
#ifndef FLUIDEQ_ENGINE_ROOM_HEAD_H
#define FLUIDEQ_ENGINE_ROOM_HEAD_H
#include <cstdint>
#include <optional>
#include <string>
#include <vector>
namespace fluideq_engine {
/** One head at one rate: a ring of directions, left ear then right. */
struct RoomHead {
  uint32_t directions = 0;
  uint32_t taps = 0;
  double sample_rate = 0;
  /** True when the stream runs at twice this block's rate (192 kHz). */
  bool needs_doubling = false;
  std::vector<float> left;   // directions * taps
  std::vector<float> right;  // directions * taps
};
/**
 * The block of `fluideq-room-head.txt` for a stream rate, or nothing: the
 * file carries 44.1, 48 and 96 kHz blocks, 192 kHz takes 96 with doubling,
 * and any other rate has no head. A block short of its declared numbers is
 * refused whole — a head of zeros would play silence and report a room.
 */
std::optional<RoomHead> parse_room_head(const std::string& text,
                                        double stream_rate);
}  // namespace fluideq_engine
#endif
```

```cpp
// native/system-apo/src/room_head.cpp
#include "room_head.h"
#include <cstdlib>
#include <sstream>
namespace fluideq_engine {
namespace {
double wanted_rate(double stream_rate, bool* doubling) {
  *doubling = false;
  if (stream_rate == 44100 || stream_rate == 48000 || stream_rate == 96000) {
    return stream_rate;
  }
  if (stream_rate == 192000) { *doubling = true; return 96000; }
  return 0;
}
}  // namespace
std::optional<RoomHead> parse_room_head(const std::string& text,
                                        double stream_rate) {
  bool doubling = false;
  const double rate = wanted_rate(stream_rate, &doubling);
  if (rate == 0) return std::nullopt;
  std::istringstream lines(text);
  std::string line;
  while (std::getline(lines, line)) {
    if (line.rfind("rate ", 0) != 0) continue;
    std::istringstream header(line);
    std::string word; double block_rate = 0; unsigned directions = 0, taps = 0;
    header >> word >> block_rate >> word >> directions >> word >> taps;
    if (block_rate != rate) continue;
    if (directions == 0 || taps == 0 || directions > 72 || taps > 4096) {
      return std::nullopt;
    }
    RoomHead head;
    head.directions = directions; head.taps = taps; head.sample_rate = rate;
    head.needs_doubling = doubling;
    head.left.resize(static_cast<size_t>(directions) * taps);
    head.right.resize(head.left.size());
    for (unsigned d = 0; d < directions; ++d) {
      if (!std::getline(lines, line)) return std::nullopt;
      std::istringstream numbers(line);
      for (unsigned ear = 0; ear < 2; ++ear) {
        std::vector<float>& into = ear == 0 ? head.left : head.right;
        for (unsigned t = 0; t < taps; ++t) {
          double value = 0;
          if (!(numbers >> value)) return std::nullopt;
          into[static_cast<size_t>(d) * taps + t] = static_cast<float>(value);
        }
      }
    }
    return head;
  }
  return std::nullopt;
}
}  // namespace fluideq_engine
```

- [ ] **Step 4: Run the native tests**

Expected: `engine-room-head` passes; all others unchanged.

- [ ] **Step 5: Commit**

Message: `Read the room's head file: a ring of directions per rate, refused when short`.

---

### Task 2: Speaker positions from the channel mask

**Files:**

- Modify: `native/system-apo/src/channel_layout.h`, `native/system-apo/src/channel_layout.cpp`
- Test: `native/system-apo/tests/channel_layout_test.cpp`

**Interfaces:**

- Produces: `int speaker_of_channel(unsigned long mask, unsigned short channels, unsigned channel)` → the room's speaker index for that channel: 0 FL, 1 FR, 2 C, 3 SL, 4 SR, 5 RL, 6 RR, or -1 (the LFE, a channel past the mask, or a position the room has no speaker for). With `mask == 0`: 2 channels → FL, FR; 6 → FL FR C LFE(-1) RL RR; 8 → FL FR C LFE RL RR SL SR; else -1 everywhere. Mask bits (mmreg.h): FL 0x1, FR 0x2, FC 0x4, LFE 0x8, BL 0x10, BR 0x20, SL 0x200, SR 0x400; back and side map to RL/RR and SL/SR; any other set bit (front-left-of-centre, top, …) counts as a channel position with no speaker (-1) but still shifts the index.

- [ ] **Step 1: Write the failing tests** (append to `channel_layout_test.cpp` before the summary)

```cpp
  std::printf("each channel's speaker in the room, from the mask\n");
  using fluideq_engine::speaker_of_channel;
  // 7.1: FL FR C LFE BL BR SL SR
  const int seven[8] = {0, 1, 2, -1, 5, 6, 3, 4};
  for (unsigned c = 0; c < 8; ++c) CHECK(speaker_of_channel(k7point1, 8, c) == seven[c]);
  // 5.1 with back surrounds and with side surrounds both land on the ring.
  CHECK(speaker_of_channel(k5point1, 6, 4) == 5 && speaker_of_channel(k5point1, 6, 5) == 6);
  CHECK(speaker_of_channel(k5point1Side, 6, 4) == 3 && speaker_of_channel(k5point1Side, 6, 5) == 4);
  CHECK(speaker_of_channel(kStereo, 2, 0) == 0 && speaker_of_channel(kStereo, 2, 1) == 1);
  CHECK(speaker_of_channel(k2point1, 3, 2) == -1);
  CHECK(speaker_of_channel(0, 2, 1) == 1 && speaker_of_channel(0, 6, 3) == -1 && speaker_of_channel(0, 8, 7) == 4);
  CHECK(speaker_of_channel(0, 4, 2) == -1);
  CHECK(speaker_of_channel(kStereo, 2, 2) == -1);
```

- [ ] **Step 2: Run, see them fail to build**

- [ ] **Step 3: Implement**

```cpp
// channel_layout.h — add after lfe_channel_of
/** The room's speaker (0 FL 1 FR 2 C 3 SL 4 SR 5 RL 6 RR) for a channel, or -1. */
int speaker_of_channel(unsigned long mask, unsigned short channels,
                       unsigned channel);
```

```cpp
// channel_layout.cpp — add
namespace {
constexpr unsigned long kBits[] = {0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80,
                                   0x100, 0x200, 0x400};
constexpr int kSpeakerOfBit[] = {0, 1, 2, -1, 5, 6, -1, -1, -1, 3, 4};
constexpr int kNoMask6[] = {0, 1, 2, -1, 5, 6};
constexpr int kNoMask8[] = {0, 1, 2, -1, 5, 6, 3, 4};
}  // namespace
int speaker_of_channel(unsigned long mask, unsigned short channels,
                       unsigned channel) {
  if (channel >= channels) return -1;
  if (mask == 0) {
    if (channels == 2) return channel == 0 ? 0 : 1;
    if (channels == 6) return kNoMask6[channel];
    if (channels == 8) return kNoMask8[channel];
    return -1;
  }
  unsigned index = 0;
  for (unsigned long bit = 1; bit != 0 && bit <= 0x20000; bit <<= 1) {
    if ((mask & bit) == 0) continue;
    if (index == channel) {
      for (unsigned k = 0; k < sizeof(kBits) / sizeof(kBits[0]); ++k) {
        if (kBits[k] == bit) return kSpeakerOfBit[k];
      }
      return -1;
    }
    ++index;
  }
  return -1;
}
```

- [ ] **Step 4: Run the tests, pass. Commit:** `Name each channel's speaker in the room from the stream's mask`.

---

### Task 3: `FeqRoom` — kernels from a head and a room

**Files:**

- Create: `native/dsp-core/include/fluideq/room.h`, `native/dsp-core/src/room.cpp`, `native/dsp-core/src/room_kernels.cpp`, `native/dsp-core/src/room_internal.h`
- Test: `native/dsp-core/tests/room_test.cpp`
- Modify: `native/CMakeLists.txt` (sources + test target)

**Interfaces:**

- Produces (C API, `extern "C"`):

```c
#define FEQ_ROOM_SPEAKERS 7
#define FEQ_ROOM_MAX_CHANNELS 8
#define FEQ_ROOM_KERNEL_TAPS 1024   /* direct 256 + reflections within 16 ms at 48 k */
typedef struct FeqRoomSettings {
  int enabled;
  double size_m;        /* 2 … 12, the shoebox's side */
  double walls;         /* 0 hard … 1 dead */
  double distance_m;    /* 0.5 … size/2, listener to speakers */
  double centre_db;     /* -12 … +12 */
  double sub_db;        /* -12 … +12 */
  double head_scale;    /* 0.85 … 1.15, interaural delay scale */
  double angle_deg[FEQ_ROOM_SPEAKERS];  /* clockwise from front */
  double level_db[FEQ_ROOM_SPEAKERS];
} FeqRoomSettings;
typedef struct FeqRoom FeqRoom;
FeqRoom* feq_room_create(double sample_rate, uint32_t channels, uint32_t max_frames);
void feq_room_destroy(FeqRoom* room);
/* Control thread. Copies the ring; `taps` per ear per direction; `doubling` upsamples 2x. */
void feq_room_set_head(FeqRoom* room, const float* left, const float* right,
                       uint32_t directions, uint32_t taps, int doubling);
/* Control thread. speaker[c] in 0..6 or -1; lfe is a channel index or -1. */
void feq_room_set_layout(FeqRoom* room, const int* speaker, int lfe_channel);
/* Control thread. Rebuilds kernels and hands them over; no click. */
void feq_room_configure(FeqRoom* room, const FeqRoomSettings* settings);
/* Audio thread. In place: front pair carries the ears, the rest leaves silent. */
void feq_room_process(FeqRoom* room, float* const* channels, uint32_t frames);
/* Whether the stage is folding right now (enabled, head loaded, ≥2 channels). */
int feq_room_active(const FeqRoom* room);
uint32_t feq_room_latency_frames(const FeqRoom* room);
void feq_room_reset(FeqRoom* room);
void feq_room_settings_defaults(FeqRoomSettings* settings);
```

Defaults: enabled 0, size 4.2, walls 0.55, distance 1.8, centre 0, sub 0, head_scale 1, angles {-30, 30, 0, -100, 100, -140, 140}, levels all 0.

Kernel building (`room_kernels.cpp`, control thread, allocates):

- For speaker `s` at angle `a` and distance `d`, listener at the room's centre `(0,0)`, room `[-L/2, L/2]²` with `L = size_m`: speaker position `p = (d·sin a, d·cos a)`. Direct path: HRIR pair of the ring direction nearest to `a`, gain `1/d` normalised so `d = distance_m` gives 0 dB, delay 0.
- Four first-order images: mirror `p` across each wall (`x → L - x`, `x → -L - x`, same for y). Each image at direction `atan2(x, y)` and distance `r`: gain `(1 - walls) · d / r`, delay `(r - d) / 343 · rate` frames, HRIR pair of the nearest ring direction. Dropped when the delay would fall past `FEQ_ROOM_KERNEL_TAPS - taps`.
- Head scale: the right-ear kernel of a speaker on the left (and vice versa) is shifted by `round((head_scale - 1) · itd_frames)`, where `itd_frames = 0.00065 · |sin a| · rate` (Woodworth, head radius 8.75 cm); a shift of 0 frames leaves the measured head as measured.
- Sum into `left[s]`, `right[s]` of `FEQ_ROOM_KERNEL_TAPS` floats, then `feq_convolver_kernel_create` each. Level: `10^(level_db/20)`, centre also `10^(centre_db/20)`.

Processing (`room.cpp`, audio thread, no allocation):

- Scratch: `mix_left`, `mix_right` (max_frames), one `input_copy` per channel (max_frames), a one-pole low-pass state for the sub, a `FeqConvolver*` per (channel, ear) with `_next` and `blend` per pair, exactly the chain's kernel-handoff pattern (`std::atomic<Handoff*>`).
- For each channel with a speaker: copy input to `input_copy`, convolve into left (in place on a copy) and right, accumulate. LFE: one-pole at 120 Hz on the input, times `10^(sub_db/20)`, added to both. Write `mix_left → channels[0]`, `mix_right → channels[1]`, zero channels 2…N-1.
- Inactive (disabled, no head, `channels < 2`, or no channel has a speaker): return without touching the buffers.
- Latency: `feq_convolver_latency()` when active, else 0 — the chain adds it to its own.

- [ ] **Step 1: Write the failing tests**

```cpp
// native/dsp-core/tests/room_test.cpp
#include "fluideq/room.h"
#include "fluideq/convolver.h"
#include <cmath>
#include <cstdio>
#include <vector>
#include "dsp_test_support.h"
namespace {
using feq_test::check; using feq_test::finish; using feq_test::kFrames; using feq_test::kRate;
constexpr uint32_t kDirections = 24, kTaps = 256;
struct HeadRing { std::vector<float> left, right; };
/* A synthetic head: the near ear gets a unit impulse, the far ear a half-height
   impulse delayed by the Woodworth ITD of the direction, so left/right and
   timing claims can be checked against known numbers. */
HeadRing synthetic_head() {
  HeadRing ring; ring.left.assign(kDirections * kTaps, 0.f); ring.right.assign(kDirections * kTaps, 0.f);
  for (uint32_t d = 0; d < kDirections; ++d) {
    const double a = d * 15.0 * M_PI / 180.0;
    const uint32_t itd = static_cast<uint32_t>(std::lround(0.00065 * std::fabs(std::sin(a)) * kRate));
    const bool on_right = std::sin(a) > 0;
    float* near = (on_right ? ring.right : ring.left).data() + d * kTaps;
    float* far = (on_right ? ring.left : ring.right).data() + d * kTaps;
    near[0] = 1.f; far[itd] = 0.5f;
    if (std::fabs(std::sin(a)) < 1e-9) { ring.left[d * kTaps] = 1.f; ring.right[d * kTaps] = 1.f; }
  }
  return ring;
}
struct RoomFixture {
  FeqRoom* room; FeqRoomSettings settings; HeadRing head;
  RoomFixture(uint32_t channels, const int* speakers, int lfe) {
    room = feq_room_create(kRate, channels, kFrames);
    head = synthetic_head();
    feq_room_set_head(room, head.left.data(), head.right.data(), kDirections, kTaps, 0);
    feq_room_set_layout(room, speakers, lfe);
    feq_room_settings_defaults(&settings); settings.enabled = 1; settings.walls = 1.0;
    feq_room_configure(room, &settings);
    feq_room_reset(room);
  }
  ~RoomFixture() { feq_room_destroy(room); }
};
void run(FeqRoom* room, std::vector<std::vector<float>>& b) {
  std::vector<float*> p(b.size());
  for (size_t block = 0; block * kFrames < b[0].size(); ++block) {
    for (size_t c = 0; c < b.size(); ++c) p[c] = b[c].data() + block * kFrames;
    feq_room_process(room, p.data(), kFrames);
  }
}
double energy(const std::vector<float>& v, size_t from = 0) { double e = 0; for (size_t i = from; i < v.size(); ++i) e += double(v[i]) * v[i]; return e; }
size_t first_nonzero(const std::vector<float>& v) { for (size_t i = 0; i < v.size(); ++i) if (std::fabs(v[i]) > 1e-6f) return i; return v.size(); }

void off_is_pass_through() {
  std::printf("off is pass-through\n");
  const int spk[2] = {0, 1}; RoomFixture f(2, spk, -1);
  f.settings.enabled = 0; feq_room_configure(f.room, &f.settings);
  std::vector<std::vector<float>> b(2, std::vector<float>(kFrames * 8, 0.f)); b[0][100] = 0.7f; b[1][200] = -0.4f;
  auto in = b; run(f.room, b);
  check(b == in, "buffers untouched");
  check(feq_room_latency_frames(f.room) == 0, "no latency while off");
}
void stereo_becomes_a_front_stage() {
  std::printf("stereo becomes a front stage\n");
  const int spk[2] = {0, 1}; RoomFixture f(2, spk, -1);
  std::vector<std::vector<float>> b(2, std::vector<float>(kFrames * 8, 0.f)); b[0][10] = 1.f;  // left speaker only
  run(f.room, b);
  const uint32_t lat = feq_room_latency_frames(f.room);
  check(lat == feq_convolver_latency(), "latency is one partition");
  check(energy(b[0]) > energy(b[1]) * 2, "left ear louder than right for a left speaker (positive control)");
  const size_t l = first_nonzero(b[0]), r = first_nonzero(b[1]);
  const size_t itd = static_cast<size_t>(std::lround(0.00065 * std::sin(30 * M_PI / 180) * kRate));
  check(r > l && r - l == itd, "right ear hears the left speaker later by the head's delay");
}
void seven_one_folds_to_the_pair() {
  std::printf("7.1 folds to the pair\n");
  const int spk[8] = {0, 1, 2, -1, 5, 6, 3, 4}; RoomFixture f(8, spk, 3);
  std::vector<std::vector<float>> b(8, std::vector<float>(kFrames * 8, 0.f));
  for (auto& c : b) c[10] = 0.5f;
  run(f.room, b);
  for (uint32_t c = 2; c < 8; ++c) check(energy(b[c]) == 0.0, "a channel beyond the pair leaves silent");
  check(energy(b[0]) > 0 && energy(b[1]) > 0, "both ears carry the room");
}
void the_sub_reaches_both_ears_equally() {
  std::printf("the sub reaches both ears equally\n");
  const int spk[6] = {0, 1, 2, -1, 5, 6}; RoomFixture f(6, spk, 3);
  std::vector<std::vector<float>> b(6, std::vector<float>(kFrames * 8, 0.f));
  for (size_t i = 0; i < b[3].size(); ++i) b[3][i] = static_cast<float>(std::sin(2 * M_PI * 50 * i / kRate));
  run(f.room, b);
  const double l = energy(b[0], kFrames), r = energy(b[1], kFrames);
  check(l > 1.0 && std::fabs(l - r) / l < 1e-6, "the LFE lands in both ears the same, in phase");
}
void hard_walls_add_reflections_and_dead_walls_none() {
  std::printf("hard walls add reflections, dead walls none\n");
  const int spk[2] = {0, 1};
  RoomFixture dead(2, spk, -1), hard(2, spk, -1);
  hard.settings.walls = 0.0; feq_room_configure(hard.room, &hard.settings); feq_room_reset(hard.room);
  std::vector<std::vector<float>> a(2, std::vector<float>(kFrames * 8, 0.f)), b = a; a[0][10] = 1.f; b[0][10] = 1.f;
  run(dead.room, a); run(hard.room, b);
  const size_t after = feq_room_latency_frames(dead.room) + 10 + kTaps;  // past the direct path
  check(energy(a[0], after) < 1e-9, "dead walls: nothing after the direct path");
  check(energy(b[0], after) > 1e-4, "hard walls: reflections after the direct path (positive control)");
}
void a_dial_moves_without_a_step() {
  std::printf("a dial moves without a step\n");
  const int spk[2] = {0, 1}; RoomFixture f(2, spk, -1);
  std::vector<std::vector<float>> b(2, std::vector<float>(kFrames * 40, 0.f));
  for (size_t i = 0; i < b[0].size(); ++i) b[0][i] = b[1][i] = static_cast<float>(0.5 * std::sin(2 * M_PI * 440 * i / kRate));
  std::vector<float*> p(2);
  for (size_t block = 0; block < 40; ++block) {
    if (block == 20) { f.settings.distance_m = 3.0; feq_room_configure(f.room, &f.settings); }
    for (size_t c = 0; c < 2; ++c) p[c] = b[c].data() + block * kFrames;
    feq_room_process(f.room, p.data(), kFrames);
  }
  double worst = 0; for (size_t i = kFrames * 4; i + 1 < b[0].size(); ++i) worst = std::max(worst, double(std::fabs(b[0][i + 1] - b[0][i])));
  check(worst < 0.08, "no sample-to-sample jump larger than the tone's own slope");
}
}  // namespace
int main() {
  std::printf("room\n\n");
  off_is_pass_through(); stereo_becomes_a_front_stage(); seven_one_folds_to_the_pair();
  the_sub_reaches_both_ears_equally(); hard_walls_add_reflections_and_dead_walls_none(); a_dial_moves_without_a_step();
  return finish();
}
```

- [ ] **Step 2: Add sources and the test target** to `native/CMakeLists.txt` (dsp-core library: `src/room.cpp src/room_kernels.cpp`; test `fluideq-room-test` like `fluideq-chain-surround-test`), run, see the build fail.

- [ ] **Step 3: Implement `room.h`** (the C API above, doc comments per field as in `chain.h`), **`room_internal.h`**:

```cpp
struct FeqRoomKernels {           // one handoff: everything the audio thread adopts
  FeqConvolverKernel* kernel[FEQ_ROOM_MAX_CHANNELS][2] = {};
  FeqConvolver* convolver[FEQ_ROOM_MAX_CHANNELS][2] = {};
  double sub_gain = 1.0;
  int active = 0;
};
struct FeqRoom {
  double sample_rate; uint32_t channels; uint32_t max_frames;
  FeqRoomSettings settings;
  int speaker[FEQ_ROOM_MAX_CHANNELS]; int lfe_channel = -1;
  std::vector<float> head_left, head_right; uint32_t directions = 0, taps = 0; int doubling = 0;
  std::atomic<FeqRoomKernels*> handoff{nullptr};
  FeqRoomKernels* live = nullptr; FeqRoomKernels* next = nullptr; double blend = 1.0;
  std::vector<float> mix_left, mix_right, scratch, copy[FEQ_ROOM_MAX_CHANNELS];
  double sub_state = 0.0, sub_coefficient = 0.0;
  std::atomic<int> active{0};
};
FeqRoomKernels* room_build_kernels(const FeqRoom* room);   // room_kernels.cpp, allocates
void room_destroy_kernels(FeqRoomKernels* kernels);
```

**`room_kernels.cpp`**: `room_build_kernels` as described under Interfaces (image-source loop, nearest ring direction `lround(((angle mod 360) / 360) * directions) % directions`, head-scale shift, doubling by zero-stuffing then `feq_oversample_up`-style half-band — reuse `FeqOversampler` from `oversample.h` on a temporary), then `feq_convolver_kernel_create` per (channel, ear) and `feq_convolver_create` for each; `active = 1` when at least one channel has a speaker and a head is loaded and `settings.enabled`.

**`room.cpp`**: create (allocate scratch for `max_frames`, `sub_coefficient = 1 - exp(-2π·120/rate)`), set_head (copy, then rebuild if configured), set_layout, configure (copy settings, `room_build_kernels`, `handoff.exchange`, destroy whatever came back), process (adopt handoff: if `live == nullptr` take it; else put it in `next`, `blend = 0`; then per channel with a speaker: `copy[c] = input`; left: `feq_convolve` or `feq_convolve_blend(live, next, …)` into `copy`, accumulate to `mix_left`; same for right from a second copy; LFE low-pass into both; when `blend >= 1` retire `live` to `next`), reset (zero states; convolvers are re-created by a rebuild), latency, active (`active.load`), destroy.

Every `std::vector` sized in `create`; `process` indexes only.

- [ ] **Step 4: Run `fluideq-room-test` until all six pass.** Print the measured ITD and reflection energies in the test output.

- [ ] **Step 5: Commit:** `Add the room: every channel a speaker through a measured head, out on the pair`.

---

### Task 4: The room in the chain and on the wire

**Files:**

- Modify: `native/dsp-core/include/fluideq/chain.h` (`FeqChainRoomSettings room;` = the fields of `FeqRoomSettings` minus `head_scale`, plus `int head;` 0/1/2, `int preset;`, `int correct_headphones;`; `FEQ_CHAIN_PARAM_LEAD 138`; `feq_chain_set_room_head`, `feq_chain_set_room_layout`), `native/dsp-core/src/chain_internal.h` (`FeqRoom* room`), `native/dsp-core/src/chain.cpp` (create/destroy/configure/reset/latency/process after `chain_process_bass_punch`), `native/dsp-core/src/chain_decode.cpp` (decode the 23 scalars before `surround_all_channels`), `src/common/dsp/chain.ts` (`IRoomSettings`, `DSP_DEFAULTS.room`, clamp), `src/common/dsp/chainWire.ts` (`CHAIN_PARAM_LEAD = 138`, encode before the surround flag), `native/system-apo/tests/dsp_chain_fixture.h` (regenerated line, `kRoomEnabled = FEQ_CHAIN_PARAM_LEAD - 25`), `native/system-apo/src/dsp_chain.cpp` (pass layout: `speaker_of_channel` for each channel, `lfe_channel`), `native/system-apo/src/apo.h` + `apo_format.cpp` (`ConnectionFormat.mask`), `native/system-apo/src/watcher.cpp` (read `fluideq-room-head.txt` on reload with `parse_room_head`, call `feq_chain_set_room_head`; log `room on …` / `room off: …`; problem `room-head` when enabled and no head).
- Test: `native/dsp-core/tests/chain_surround_test.cpp` (new case: room on a six-channel chain leaves channels 2–5 silent and reports `+512` latency; room off is unchanged from today), `src/__tests__/unit_tests/dspChainWire.test.ts` (slice reads the room block ahead of the surround flag), `native/system-apo/tests/dsp_chain_test.cpp` (room fields decoded).

Head scale on the wire: `head` (0/1/2) is what the app sends; the engine maps it to `head_scale` 0.94 / 1.0 / 1.06 in `build_rack` — measured later by Fit; until then the three shipped sets differ by subject, not by scale.

- [ ] **Step 1: Write the failing tests** (the three named above; the wire test expects `CHAIN_PARAM_LEAD` to be 138 and `encoded.slice(LEAD - 25, LEAD - 2)` to be the 23 room values in encoder order — enabled, preset index (`['studio', 'livingRoom', 'cinema', 'frontStage', 'custom']`), size, walls, distance, centre, sub, head, correctHeadphones, seven angles, seven levels — which for the defaults is `[0, 1, 4.2, 0.55, 1.8, 0, 0, 1, 1, -30, 30, 0, -100, 100, -140, 140, 0, 0, 0, 0, 0, 0, 0]`; the surround flag stays at `LEAD - 2` and the band count at `LEAD - 1`.)

- [ ] **Step 2: Run, see them fail.**

- [ ] **Step 3: Implement.** Regenerate the fixture line with the command in `dsp_chain_fixture.h`'s header. The chain passes `feq_room_process` the channels right after `chain_process_bass_punch` (and its alignment) and before `chain_process_dimension`; `feq_chain_latency_frames` adds `feq_room_latency_frames`. `feq_chain_reset(SOURCE_CHANGE)` calls `feq_room_reset`.

- [ ] **Step 4: Run every native test and Jest (`dspChainWire`, `dsp/systemDspChain`), pass.**

- [ ] **Step 5: Commit:** `Put the room in the rack and on the wire (LEAD 138); the engine loads the head file`.

---

### Task 5: The head sets and the app that writes them

**Files:**

- Create: `.erb/scripts/build-room-heads.ts` (from three extracted SADIE II subject folders — `--small <dir> --medium <dir> --large <dir>` — reads `48K_24bit/azi_<a>,0_ele_0,0.wav` and the 44.1 K and 96 K siblings for `a` in 0, 15, …, 345; fails listing the folder when a name does not match; trims each HRIR to 256 taps from its onset (first sample above -40 dBFS, minus 8), applies a 32-tap half-Hann tail, normalises the set so the loudest direct pair peaks at -3 dBFS; writes `assets/room/heads/<size>.txt` in the Task 1 format, and `assets/room/heads/LICENSES.md` with the Apache 2.0 notice, the SADIE II citation and the MIT KEMAR citation), `src/main/roomHead.ts` (reads `assets/room/heads/<size>.txt` and writes it to the engine's config folder as `fluideq-room-head.txt` through `asyncWriter` when `settings.room.head` changes or the folder is (re)created; deletes it on quit with the rack), `src/__tests__/unit_tests/main/roomHead.test.ts`.
- Modify: `package.json` (`"build:room-heads": "ts-node ./.erb/scripts/build-room-heads.ts"`), `src/main/dspHost/wire.ts` or wherever `publishSystemDspChain` reaches main (call `writeRoomHead(settings.room.head)` alongside the rack write), `assets.d.ts` if text assets need a declaration.

- [ ] **Step 1: Write the failing test** — `roomHead.test.ts`: with a fake engine root, writing head 1 produces `fluideq-room-head.txt` whose first line is `# FluidEQ room head v1 medium` and which `parse`s (a TS port of the block header check: three `rate` lines, 24 directions each); writing the same head again writes nothing (no second write on the spy); quitting removes it.
- [ ] **Step 2: Run, fail.**
- [ ] **Step 3: Implement**, run the build script on the three subject folders (download by hand from the SADIE II page; not automated — the archives are hundreds of MB each and the licence text is copied from the page at the same time), commit the three text files (about 1.2 MB each) and `LICENSES.md`.
- [ ] **Step 4: Jest passes. Commit:** `Ship three heads from SADIE II and write the chosen one for the engine`.

---

### Task 6: Status fields for the card's chip

**Files:**

- Modify: `native/system-apo/src/status_file.h` (`uint32_t channels`, `std::string room` — one of `off`, `front-stage`, `5.1`, `7.1`, `no-head`), `status_json.cpp`, `watcher_log.cpp` (fill from the graph), `src/common/engineHealth.ts` + `src/main/engineHealth.ts` (parse `channels`, `room`), tests `status_test.cpp`, `engineHealth.test.ts`.
- [ ] **Step 1: Failing tests** — status JSON text gains `"channels":8,"room":"7.1"` after `problems` (pinned string in both tests).
- [ ] **Step 2: Implement both sides; `ENGINE_STATUS_SINCE` unchanged (fields optional on read).**
- [ ] **Step 3: Tests pass. Commit:** `Tell the app how many channels the engine has and what the room does with them`.

---

### Task 7: CLAUDE.md, changelog, memory

- [ ] Add a "Things that will bite you" bullet: the room's position, the head file, LEAD 138, the fold leaving channels silent, the latency added.
- [ ] Changelog 1.7.3 "New": the Room, in the words of the spec's first paragraph, marked "engine only; the card comes next".
- [ ] Commit: `Write the room down`.
