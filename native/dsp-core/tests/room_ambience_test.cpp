#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdlib>
#include <new>
#include <set>
#include <thread>
#include <vector>

#include "../src/room_internal.h"
#include "dsp_test_support.h"
#include "room_legacy_transition_fixture.h"
#include "room_legacy_transition_golden.h"
static thread_local bool audio = false;
static std::atomic<int> allocations{0}, releases{0}, balance{0};
void* operator new(size_t n) {
  if (audio) ++allocations;
  if (void* p = std::malloc(n)) {
    ++balance;
    return p;
  }
  throw std::bad_alloc();
}
void operator delete(void* p) noexcept {
  if (audio && p) ++releases;
  if (p) --balance;
  std::free(p);
}
void* operator new[](size_t n) { return ::operator new(n); }
void operator delete[](void* p) noexcept { ::operator delete(p); }
void operator delete(void* p, size_t) noexcept { ::operator delete(p); }
void operator delete[](void* p, size_t) noexcept { ::operator delete(p); }
namespace {
using feq_test::check;
constexpr uint32_t block = 128;
bool distinct_room_owners(const FeqRoom* first, const FeqRoom* second) {
  const FeqRoomKernels* owners[16] = {};
  size_t count = 0;
  for (const auto* room : {first, second}) {
    owners[count++] = room->live;
    owners[count++] = room->next;
    owners[count++] = room->pending;
    owners[count++] = room->handoff.load();
    for (const auto& slot : room->retired) owners[count++] = slot.load();
  }
  for (size_t i = 0; i < count; ++i)
    for (size_t j = i + 1; j < count; ++j)
      if (owners[i] != nullptr && owners[i] == owners[j]) return false;
  return true;
}
struct Fixture {
  FeqRoom* r;
  FeqRoomSettings s{};
  Fixture(double rate = 48000, bool low = false) {
    r = feq_room_create(rate, 2, block);
    float h[24] = {};
    std::fill(h, h + 24, 1.0f);
    int speakers[2] = {0, 1};
    feq_room_set_head(r, h, h, 24, 1, 0);
    feq_room_set_layout(r, speakers, -1);
    feq_room_set_low_latency(r, low ? 1 : 0);
    feq_room_settings_defaults(&s);
    s.enabled = 1;
    s.renderer_version = 2;
    s.bass_management = 0;
  }
  void configure() { feq_room_configure(r, &s); }
  ~Fixture() { feq_room_destroy(r); }
};
std::vector<float> run(Fixture& f, size_t frames, bool impulse = true) {
  frames = (frames + block - 1) / block * block;
  std::vector<float> out(frames), right(frames);
  if (impulse) out[0] = 1;
  for (size_t at = 0; at < frames; at += block) {
    float* p[2] = {out.data() + at, right.data() + at};
    audio = true;
    feq_room_process(f.r, p, block);
    audio = false;
  }
  return out;
}
double energy(const std::vector<float>& v, size_t begin = 0) {
  double sum = 0;
  for (size_t i = begin; i < v.size(); ++i) sum += double(v[i]) * v[i];
  return sum;
}
void space_and_tail() {
  Fixture dry, space, wet;
  dry.s.early_reflection_db = -60;
  dry.s.ambience_mix = 1;
  wet.s.ambience_mix = 1;
  dry.configure();
  space.configure();
  wet.configure();
  auto a = run(dry, 96000), b = run(space, 96000), c = run(wet, 96000);
  check(energy(a, 600) < 1e-12,
        "Space off removes reflections and late excitation");
  check(a[512] == b[512] && b[512] == c[512],
        "Space and Ambience retain direct sample");
  check(energy(b, 600) > 1e-4, "Space has actual reflected energy");
  check(energy(c, 6000) > 1e-9,
        "Ambience makes a late tail beyond the early kernel");
}
void lifetime() {
  Fixture f;
  f.configure();
  run(f, 128, false);
  // Deterministic full queue fixture: real owned sets, no timing probability.
  for (auto& slot : f.r->retired) slot.store(room_build_kernels(f.r));
  f.r->handoff.store(room_build_kernels(f.r));
  int before = releases.load();
  run(f, 8192, false);
  check(releases.load() == before,
        "saturated retirement never destroys on callback");
  check(f.r->handoff.load() != nullptr,
        "full retirement queue backpressures adoption");
  check(allocations.load() == 0, "processing allocates no heap storage");
}
}  // namespace
namespace {
void rates_and_alignment() {
  for (double rate : {44100.0, 48000.0, 96000.0, 192000.0}) {
    Fixture regular(rate), fast(rate, true), off(rate, true);
    regular.s.ambience_mix = fast.s.ambience_mix = 1;
    regular.configure();
    fast.configure();
    off.configure();
    auto a = run(regular, size_t(rate)), b = run(fast, size_t(rate)),
         dry = run(off, size_t(rate));
    double worst = 0, tail = 0;
    for (size_t i = 0; i + 512 < a.size(); ++i) {
      worst = std::max(worst, std::fabs(double(a[i + 512]) - b[i]));
      if (i > size_t(rate * .1)) tail += double(b[i]) * b[i];
    }
    std::printf("rate %.0f mode-alignment error %.9g late-energy %.9g\n", rate,
                worst, tail);
    check(worst < 2e-7,
          "regular and low latency align direct, reflections and late field "
          "after512 frames");
    check(tail > 1e-10, "late field audible at every supported rate");
    Fixture far(rate, true);
    far.s.early_reflection_db = -60;
    far.s.speaker_distance_m[0] = 6;
    far.s.speaker_distance_m[1] = .5;
    far.configure();
    auto distant = run(far, size_t(rate * .05));
    const size_t expected = size_t(std::lround(5.5 / 343 * rate));
    check(std::fabs(distant[expected] - float(.5 / 6)) < 1e-6,
          "full5.5m distance spread survives high-rate preparation");
    std::printf("rate %.0f FDN-delay-samples %zu send-ring-samples %zu\n", rate,
                far.r->late.samples(), far.r->reflection_history.size());
  }
}
void standalone_decay_and_extremes() {
  for (double rate : {44100.0, 48000.0, 96000.0, 192000.0}) {
    for (double decay : {.1, 1.8}) {
      RoomAmbience fdn;
      fdn.prepare(rate);
      auto p = room_ambience_parameters(rate, 1, decay, 12000, 0);
      double early = 0, late = 0, peak = 0;
      bool finite = true;
      const size_t end = size_t(rate * 4);
      for (size_t i = 0; i < end; ++i) {
        float l = 0, r = 0;
        fdn.tick(i == 0 ? 1 : 0, p, l, r);
        finite &= std::isfinite(l) && std::isfinite(r);
        const double e = double(l) * l + double(r) * r;
        if (i > size_t(rate * .04) && i < size_t(rate * .1)) early += e;
        if (i > size_t(rate * 2.5)) late += e;
        peak = std::max(peak,
                        std::max(std::fabs(double(l)), std::fabs(double(r))));
      }
      std::printf(
          "decay rate %.0f setting %.1f early %.9g late-after2.5s %.9g peak "
          "%.9g\n",
          rate, decay, early, late, peak);
      check(finite && early > 0 && late < early * 1e-7,
            "impulse is finite and decays beyond60dB by bounded tail time");
      // Hot sustained DC, sine and deterministic noise, with coefficient
      // extremes.
      uint32_t rng = 7;
      peak = 0;
      for (size_t i = 0; i < size_t(rate * 6); ++i) {
        rng = 1664525u * rng + 1013904223u;
        double in = i < size_t(rate * 2)
                        ? 4
                        : (i < size_t(rate * 4)
                               ? 4 * std::sin(2 * feq_test::kPi * 997 *
                                              double(i) / rate)
                               : 4 * (double(rng) / 4294967295.0 * 2 - 1));
        if (i == size_t(rate * 3))
          p = room_ambience_parameters(rate, 1, .1, 1000, 1);
        float l = 0, r = 0;
        fdn.tick(in, p, l, r);
        finite &= std::isfinite(l) && std::isfinite(r);
        peak = std::max(peak,
                        std::max(std::fabs(double(l)), std::fabs(double(r))));
      }
      std::printf("hot drive rate %.0f decay %.1f peak %.9g\n", rate, decay,
                  peak);
      check(finite && peak < 4,
            "hot correlated drive and coefficient transition stay bounded "
            "without limiter");
      auto zero = p;
      zero.mix = 0;
      float l = .25f, r = -.25f;
      fdn.tick(4, zero, l, r);
      check(l == .25f && r == -.25f, "zero ambience is exact hard dry");
      double reenabled = 0;
      for (size_t i = 0; i < size_t(rate * .2); ++i) {
        l = r = 0;
        fdn.tick(0, p, l, r);
        reenabled += double(l) * l + double(r) * r;
      }
      check(reenabled == 0,
            "disable and re-enable cannot reveal stale late history");
    }
  }
  RoomAmbience high, low;
  high.prepare(48000);
  low.prepare(48000);
  auto hp = room_ambience_parameters(48000, 1, 1.8, 12000, 0),
       lp = room_ambience_parameters(48000, 1, 1.8, 1000, 0);
  double eh = 0, el = 0;
  for (size_t i = 0; i < 96000; ++i) {
    float hl = 0, hr = 0, ll = 0, lr = 0;
    double in = std::sin(2 * feq_test::kPi * 8000 * double(i) / 48000);
    high.tick(in, hp, hl, hr);
    low.tick(in, lp, ll, lr);
    if (i > 48000) {
      eh += double(hl) * hl + double(hr) * hr;
      el += double(ll) * ll + double(lr) * lr;
    }
  }
  std::printf("8kHz damping ratio %.9g\n", el / eh);
  check(el < eh * .1, "damping suppresses actual high-frequency late energy");
}
void mute_reset_transfer() {
  Fixture wet, reference;
  wet.s.ambience_mix = reference.s.ambience_mix = 1;
  wet.configure();
  reference.configure();
  run(wet, 8192);
  run(reference, 8192);
  Fixture prepared;
  prepared.s = wet.s;
  prepared.configure();
  const int before = releases.load();
  audio = true;
  feq_room_transfer(prepared.r, wet.r);
  audio = false;
  check(releases.load() == before,
        "compatible transfer never destroys heap state");
  auto a = run(prepared, 16384, false), b = run(reference, 16384, false);
  double difference = 0;
  for (size_t i = 0; i < a.size(); ++i)
    difference = std::max(difference, std::fabs(double(a[i]) - b[i]));
  std::printf("compatible tail transfer error %.9g\n", difference);
  check(difference < 1e-7 && energy(a) > 0,
        "compatible transfer preserves a live late tail");
  audio = true;
  feq_room_reset(prepared.r);
  audio = false;
  auto reset = run(prepared, 16384, false);
  check(energy(reset) < 1e-15, "reset clears late and send histories");
  Fixture mute;
  mute.s.ambience_mix = 1;
  mute.s.music_upmix = 1;
  for (int& m : mute.s.mute) m = 1;
  mute.configure();
  auto quiet = run(mute, 48000);
  check(energy(quiet) == 0, "all-muted music upmix cannot excite late field");
  Fixture saturated;
  saturated.configure();
  run(saturated, 128, false);
  for (auto& slot : saturated.r->retired)
    slot.store(room_build_kernels(saturated.r));
  const int destroys = releases.load();
  audio = true;
  feq_room_transfer(saturated.r, reference.r);
  audio = false;
  check(saturated.r->handover_gain == 1 && releases.load() == destroys,
        "saturated transfer preserves gain without destroying");
  auto fallback = run(saturated, 8192);
  check(energy(fallback) > 0,
        "saturated transfer remains usable without retry");
}
void concurrent_lifetime() {
  Fixture f;
  f.configure();
  run(f, 128, false);
  const int freed = releases.load(), allocated = allocations.load();
  std::atomic<bool> done{false};
  std::thread control([&] {
    for (int i = 0; i < 80; ++i) {
      f.s.early_reflection_db = -(i % 30);
      f.s.ambience_mix = (i % 3) * .3;
      f.configure();
    }
    done.store(true);
  });
  float l[block] = {}, r[block] = {};
  float* buffers[2] = {l, r};
  size_t blocks = 0;
  while (!done.load() || blocks < 300) {
    std::fill(l, l + block, .1f);
    std::fill(r, r + block, .1f);
    audio = true;
    feq_room_process(f.r, buffers, block);
    audio = false;
    ++blocks;
  }
  control.join();
  check(releases.load() == freed && allocations.load() == allocated,
        "concurrent configure/adopt/fade has zero callback heap events");
  std::set<const void*> owners;
  auto unique = [&](FeqRoomKernels* k) {
    return k == nullptr || owners.insert(k).second;
  };
  bool distinct = unique(f.r->live) && unique(f.r->next) &&
                  unique(f.r->pending) && unique(f.r->handoff.load());
  for (auto& slot : f.r->retired) distinct &= unique(slot.load());
  check(distinct && owners.size() <= 8,
        "each bounded live/pending/queued kernel has exactly one owner");
  std::printf("concurrent publication processed %zu blocks, owned sets %zu\n",
              blocks, owners.size());
}
}  // namespace
namespace {
void source_controls() {
  Fixture dry, full, half;
  dry.s.early_reflection_db = -60;
  full.s.ambience_mix = half.s.ambience_mix = 1;
  half.s.early_reflection_db = -6;
  dry.configure();
  full.configure();
  half.configure();
  auto d = run(dry, 48000), a = run(full, 48000), b = run(half, 48000);
  double error = 0;
  for (size_t i = 0; i < a.size(); ++i)
    error = std::max(
        error, std::fabs(double(b[i] - d[i]) -
                         double(a[i] - d[i]) * std::pow(10.0, -6.0 / 20)));
  check(
      error < 1e-7,
      "Space scales actual early and late energy independently of direct path");
  // Same long near-window image must survive every callback block size.
  Fixture chunked, single;
  for (auto* f : {&chunked, &single}) {
    f->s.size_m = 12;
    f->s.speaker_distance_m[0] = 3;
    f->s.speaker_distance_m[1] = .5;
    f->s.angle_deg[0] = 0;
    f->s.ambience_mix = 1;
    f->configure();
  }
  auto c = run(chunked, 24000);
  std::vector<float> one(c.size()), right(c.size());
  one[0] = 1;
  for (size_t i = 0; i < one.size(); ++i) {
    float* buffers[2] = {one.data() + i, right.data() + i};
    audio = true;
    feq_room_process(single.r, buffers, 1);
    audio = false;
  }
  error = 0;
  for (size_t i = 0; i < c.size(); ++i)
    error = std::max(error, std::fabs(double(c[i]) - one[i]));
  check(error < 1e-7,
        "near-window image send is invariant between1-frame and128-frame "
        "callbacks");
  for (uint32_t width : {6u, 8u}) {
    FeqRoom* rooms[2] = {feq_room_create(48000, width, block),
                         feq_room_create(48000, width, block)};
    int speakers[8] = {0, 1, 2, -1, 3, 4, 5, 6};
    float head[24];
    std::fill(head, head + 24, 1.0f);
    for (int i = 0; i < 2; ++i) {
      FeqRoomSettings settings{};
      feq_room_settings_defaults(&settings);
      settings.enabled = 1;
      settings.renderer_version = 2;
      settings.ambience_mix = double(i);
      settings.bass_management = 0;
      feq_room_set_head(rooms[i], head, head, 24, 1, 0);
      feq_room_set_layout(rooms[i], speakers, 3);
      feq_room_configure(rooms[i], &settings);
    }
    float outputs[2][8][block] = {};
    error = 0;
    for (size_t step = 0; step < 500; ++step) {
      for (int mode = 0; mode < 2; ++mode) {
        float* buffers[8];
        for (uint32_t ch = 0; ch < width; ++ch) {
          buffers[ch] = outputs[mode][ch];
          for (uint32_t j = 0; j < block; ++j)
            buffers[ch][j] =
                ch == 3 ? float(.2 * std::sin(2 * feq_test::kPi * 60 *
                                              double(step * block + j) / 48000))
                        : 0;
        }
        audio = true;
        feq_room_process(rooms[mode], buffers, block);
        audio = false;
      }
      for (uint32_t j = 0; j < block; ++j)
        error = std::max(
            error, std::fabs(double(outputs[0][0][j]) - outputs[1][0][j]));
    }
    check(error == 0, "surround LFE alone never excites ambience");
    for (auto* r : rooms) feq_room_destroy(r);
  }
}
void transfer_publication_race() {
  Fixture a, b;
  a.s.ambience_mix = b.s.ambience_mix = 1;
  a.configure();
  b.configure();
  run(a, 4096);
  run(b, 4096);
  int freed = releases.load(), allocated = allocations.load();
  std::atomic<bool> done{false};
  std::thread control([&] {
    for (int i = 0; i < 80; ++i) {
      b.s.early_reflection_db = -(i % 20);
      b.configure();
    }
    done.store(true);
  });
  float l[block] = {}, r[block] = {};
  float* buffers[2] = {l, r};
  while (!done.load()) {
    audio = true;
    feq_room_transfer(b.r, a.r);
    feq_room_process(b.r, buffers, block);
    feq_room_transfer(a.r, b.r);
    feq_room_process(a.r, buffers, block);
    audio = false;
  }
  control.join();
  check(releases.load() == freed && allocations.load() == allocated,
        "burst transfer concurrent with publication has no callback allocation "
        "or destruction");
  check(distinct_room_owners(a.r, b.r),
        "repeated concurrent transfers retain distinct bounded owners");
  Fixture incompatible(96000);
  incompatible.configure();
  audio = true;
  feq_room_transfer(incompatible.r, a.r);
  audio = false;
  auto cold = run(incompatible, 8192, false);
  check(energy(cold) == 0,
        "rate-incompatible transfer never replays an old-rate tail");
}
void head_and_mode_tail() {
  Fixture changed, reference;
  changed.s.ambience_mix = reference.s.ambience_mix = 1;
  changed.s.ambience_decay_s = reference.s.ambience_decay_s = 1.8;
  changed.configure();
  reference.configure();
  run(changed, 8192);
  run(reference, 8192);
  float head[24];
  std::fill(head, head + 24, .5f);
  feq_room_set_head(changed.r, head, head, 24, 1, 0);
  auto a = run(changed, 8192, false), b = run(reference, 8192, false);
  double error = 0;
  for (size_t j = 0; j < a.size(); ++j)
    error = std::max(error, std::fabs(double(a[j]) - b[j]));
  check(error < 1e-7,
        "head change preserves compatible late history while new HRIR warms");
  feq_room_set_low_latency(changed.r, 1);
  changed.configure();
  a = run(changed, 8192, false);
  b = run(reference, 8192, false);
  error = 0;
  for (size_t j = 0; j < a.size(); ++j)
    error = std::max(error, std::fabs(double(a[j]) - b[j]));
  check(error < 1e-7 && energy(a) > 0,
        "buffering-mode change preserves the existing decaying field");
  double energies[2] = {};
  for (int bass = 0; bass < 2; ++bass) {
    Fixture wet, dry;
    wet.s.bass_management = dry.s.bass_management = bass;
    wet.s.ambience_mix = 1;
    wet.configure();
    dry.configure();
    float left[2][block], right[2][block];
    for (size_t step = 0; step < 750; ++step) {
      for (int mode = 0; mode < 2; ++mode) {
        for (uint32_t j = 0; j < block; ++j) {
          left[mode][j] = float(std::sin(2 * feq_test::kPi * 20 *
                                         double(step * block + j) / 48000));
          right[mode][j] = 0;
        }
        float* buffers[2] = {left[mode], right[mode]};
        feq_room_process(mode == 0 ? wet.r : dry.r, buffers, block);
      }
      if (step > 375)
        for (uint32_t j = 0; j < block; ++j) {
          double v = double(left[0][j]) - left[1][j];
          energies[bass] += v * v;
        }
    }
  }
  std::printf("20Hz bass-managed late-send energy ratio %.9g\n",
              energies[1] / energies[0]);
  check(energies[0] > 0 && energies[1] < energies[0] * .001,
        "late excitation follows source bass high-pass instead of managed sub "
        "bus");
}
void wall_spectrum_and_last_handover() {
  Fixture direct, soft, hard;
  direct.s.early_reflection_db = -60;
  soft.s.walls = .9;
  hard.s.walls = .1;
  direct.configure();
  soft.configure();
  hard.configure();
  auto d = run(direct, 8192), a = run(soft, 8192), b = run(hard, 8192);
  auto relative_high = [&](const std::vector<float>& signal) {
    double real = 0, imaginary = 0, dc = 0;
    for (size_t i = 0; i < signal.size(); ++i) {
      const double v = double(signal[i]) - d[i];
      const double phase = 2 * feq_test::kPi * 8000 * double(i) / 48000;
      real += v * std::cos(phase);
      imaginary += v * std::sin(phase);
      dc += v;
    }
    return (real * real + imaginary * imaginary) / (dc * dc);
  };
  std::printf("wall reflected8k/DC soft %.9g hard %.9g\n", relative_high(a),
              relative_high(b));
  check(relative_high(a) < relative_high(b) * .1,
        "Walls damps actual reflected spectrum independently of absorption");
  Fixture previous, prepared;
  previous.configure();
  prepared.configure();
  run(previous, 128, false);
  run(prepared, 128, false);
  previous.r->next = room_build_kernels(previous.r);
  prepared.r->next = room_build_kernels(prepared.r);
  prepared.r->pending = room_build_kernels(prepared.r);
  prepared.s.enabled = 0;
  prepared.configure();
  const int before = releases.load();
  audio = true;
  feq_room_transfer(prepared.r, previous.r);
  audio = false;
  run(prepared, 8192, false);
  check(prepared.r->pending == nullptr && prepared.r->live != nullptr &&
            !prepared.r->live->active,
        "last incompatible handover target progresses without another control "
        "update");
  check(releases.load() == before,
        "fully populated handover leaves destruction on control thread");
}
void disabled_room_does_not_replay_send() {
  const int versions[][2] = {{2, 2}, {2, 1}, {1, 1}};
  for (const auto& version : versions)
    for (bool low : {false, true}) {
      Fixture f(48000, low);
      f.s.ambience_mix = 1;
      f.s.renderer_version = version[0];
      f.configure();
      run(f, 128);  // source sample is still in flight to the walls/FIR
      f.s.enabled = 0;
      f.s.renderer_version = version[1];
      f.configure();
      run(f, 48000, false);
      f.s.enabled = 1;
      f.s.renderer_version = 2;
      f.configure();
      auto silence = run(f, 48000, false);
      std::printf(
          "disable/re-enable from v%d via v%d to v2 low %d replay energy "
          "%.9g\n",
          version[0], version[1], low ? 1 : 0, energy(silence));
      check(energy(silence) < 1e-20,
            "Room v2 transition clears in-flight sends before silence and "
            "re-enable");
    }
}
void saturated_transfer_preserves_audible_state() {
  for (bool fading : {false, true}) {
    Fixture previous, reference, prepared;
    previous.s.ambience_mix = reference.s.ambience_mix =
        prepared.s.ambience_mix = 1;
    previous.s.ambience_decay_s = reference.s.ambience_decay_s =
        prepared.s.ambience_decay_s = 1.8;
    previous.configure();
    reference.configure();
    prepared.configure();
    run(previous, 8192);
    run(reference, 8192);
    run(prepared, 128, false);
    if (fading) {
      previous.s.early_reflection_db = reference.s.early_reflection_db = -12;
      previous.configure();
      reference.configure();
      for (int step = 0; step < 64; ++step) {
        run(previous, 128, false);
        run(reference, 128, false);
        if (previous.r->next && previous.r->blend > 0 && previous.r->blend < 1)
          break;
      }
      check(previous.r->next != nullptr,
            "saturated transfer fixture has a real fade in progress");
    }
    // Every prepared owner is occupied: live, fading, pending and a newer
    // publication. The exchange must put displaced state into previous.
    prepared.r->next = room_build_kernels(prepared.r);
    prepared.r->pending = room_build_kernels(prepared.r);
    prepared.s.early_reflection_db = -6;
    prepared.configure();
    for (auto* room : {prepared.r, previous.r})
      for (auto& slot : room->retired)
        if (slot.load() == nullptr) slot.store(room_build_kernels(room));
    const int freed = releases.load(), allocated = allocations.load();
    audio = true;
    feq_room_transfer(prepared.r, previous.r);
    audio = false;
    check(releases.load() == freed && allocations.load() == allocated,
          "saturated audible transfer has zero callback heap events");
    check(distinct_room_owners(prepared.r, previous.r),
          "full-slot transfer keeps all displaced, pending and published "
          "owners distinct");
    check(previous.r->live != nullptr && previous.r->next != nullptr,
          "previous owns both displaced prepared sets for control destruction");
    // Production callers reclaim the old graph immediately after handover.
    feq_room_destroy(previous.r);
    previous.r = nullptr;
    auto actual = run(prepared, 8192, false),
         expected = run(reference, 8192, false);
    double error = 0;
    for (size_t i = 0; i < actual.size(); ++i)
      error = std::max(error, std::fabs(double(actual[i]) - expected[i]));
    std::printf(
        "saturated tail fading %d error %.9g first error %.9g energy %.9g\n",
        fading ? 1 : 0, error, std::fabs(double(actual[0]) - expected[0]),
        energy(expected));
    check(energy(expected) > 1e-12 && error < 1e-7,
          "saturated handover preserves outgoing tail after immediate previous "
          "destruction");
    // Reclaim on control and publish a distinct final target. It must still
    // become audible after the saturated exchange and any interrupted fade.
    prepared.s.early_reflection_db = -60;
    prepared.configure();
    run(prepared, 96000, false);  // let the intentionally preserved tail drain
    auto direct = run(prepared, 8192);
    std::printf(
        "post-saturation direct %.9g pending %p next %p reflected gain %.9g\n",
        direct[512], static_cast<void*>(prepared.r->pending),
        static_cast<void*>(prepared.r->next),
        prepared.r->live->reflections[0][0].gain);
    check(std::fabs(direct[512] - 1.0f) < 1e-7 && energy(direct, 600) < 1e-12,
          "latest control publication remains owned and adopted after "
          "saturation");
  }
}
void legacy_off_on_matches_frozen_renderer() {
  for (int scenario = 0; scenario < 4; ++scenario)
    for (bool low : {false, true}) {
      const auto actual = legacy_room_transition(scenario, low);
      const auto& expected = legacy_golden[scenario * 2 + (low ? 1 : 0)];
      double error = 0;
      for (size_t i = 0; i < legacy_probes.size(); ++i)
        error = std::max(error, std::fabs(double(actual[legacy_probes[i]]) -
                                          expected.samples[i]));
      const double total = energy(actual);
      const bool energy_matches =
          expected.energy == 0
              ? total == 0
              : std::fabs(total - expected.energy) < expected.energy * 1e-6;
      std::printf(
          "legacy off/on scenario %d low %d energy %.12g frozen %.12g probe "
          "error %.9g\n",
          scenario, low ? 1 : 0, total, expected.energy, error);
      check(energy_matches && error < 1e-7,
            "legacy bass/FIR/upmix/sub off-on samples match frozen renderer");
    }
}
void callback_cost() {
  for (double rate : {44100.0, 48000.0, 96000.0, 192000.0})
    for (bool low : {false, true}) {
      double costs[2] = {};
      for (int wet = 0; wet < 2; ++wet) {
        Fixture f(rate, low);
        f.s.ambience_mix = double(wet);
        f.configure();
        run(f, 8192, false);
        float l[block], r[block];
        float* buffers[2] = {l, r};
        std::vector<double> times;
        times.reserve(1200);
        for (size_t i = 0; i < 1200; ++i) {
          std::fill(l, l + block, .1f);
          std::fill(r, r + block, -.1f);
          const auto start = std::chrono::steady_clock::now();
          feq_room_process(f.r, buffers, block);
          const auto end = std::chrono::steady_clock::now();
          times.push_back(
              std::chrono::duration<double, std::micro>(end - start).count());
        }
        std::sort(times.begin(), times.end());
        costs[wet] = times[600];
        std::printf(
            "cpu stereo rate %.0f low %d wet %d p50_us %.3f p95_us %.3f p99_us "
            "%.3f max_us %.3f\n",
            rate, low ? 1 : 0, wet, times[600], times[1140], times[1188],
            times.back());
      }
      std::printf("cpu stereo rate %.0f low %d additional_median_us %.3f\n",
                  rate, low ? 1 : 0, costs[1] - costs[0]);
    }
}
}  // namespace
int main() {
  const int before = balance.load();
  space_and_tail();
  lifetime();
  rates_and_alignment();
  standalone_decay_and_extremes();
  mute_reset_transfer();
  source_controls();
  concurrent_lifetime();
  transfer_publication_race();
  head_and_mode_tail();
  wall_spectrum_and_last_handover();
  disabled_room_does_not_replay_send();
  saturated_transfer_preserves_audible_state();
  legacy_off_on_matches_frozen_renderer();
  callback_cost();
  check(balance.load() == before,
        "all published, retired and transferred heap owners reclaimed on "
        "control destruction");
  return feq_test::finish();
}
