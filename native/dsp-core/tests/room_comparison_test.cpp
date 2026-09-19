/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
#include <vector>

#include "../../dsp-host/src/wire.h"
#include "../../dsp-host/src/chain_route.h"
#include "../../dsp-host/src/analysis_publication.h"
#include "../src/chain_internal.h"
#include "../src/room_internal.h"
#include "dsp_test_support.h"
#include "fluideq/convolver.h"
#include "fluideq/meters.h"
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

void process_tracked(FeqRoom* room, float* const* channels, uint32_t frames) {
  audio = true;
  feq_room_process(room, channels, frames);
  audio = false;
}
void transfer_tracked(FeqRoom* prepared, FeqRoom* previous) {
  audio = true;
  feq_room_transfer(prepared, previous);
  audio = false;
}
#define feq_room_process process_tracked
#define feq_room_transfer transfer_tracked
using feq_test::check;
struct Fixture {
  FeqRoom* room;
  FeqRoomSettings s{};
  float l[128]{}, r[128]{};
  float* p[2] = {l, r};
  Fixture(double rate, int low) {
    room = feq_room_create(rate, 2, 128);
    int map[2] = {0, 1};
    std::vector<float> h(24 * 8, 0.0f);
    for (int i = 0; i < 24; i++) h[i * 8] = .25f;
    feq_room_set_head(room, h.data(), h.data(), 24, 8, 0);
    feq_room_set_layout(room, map, -1);
    feq_room_settings_defaults(&s);
    s.enabled = 1;
    s.renderer_version = 2;
    s.walls = 1;
    feq_room_set_low_latency(room, low);
    feq_room_configure(room, &s);
  }
  ~Fixture() { feq_room_destroy(room); }
  void silence(int blocks) {
    for (int b = 0; b < blocks; b++) {
      std::fill(l, l + 128, 0.0f);
      std::fill(r, r + 128, 0.0f);
      feq_room_process(room, p, 128);
    }
  }
};
void extended_checks() {
  for (double rate : {44100., 48000., 96000., 192000.})
    for (int low : {0, 1}) {
      Fixture f(rate, low);
      f.s.preserve_position = 1;
      feq_room_configure(f.room, &f.s);
      f.silence(80);
      FeqRoomReport report{};
      feq_room_report(f.room, &report);
      check((report.flags & FEQ_ROOM_REPORT_MATCH) == 0,
            "fresh silence never claims a match");
      check(feq_room_position_protected(f.room) != 0,
            "processed active Room protects position");
      auto signal = [&](int blocks) {
        for (int b = 0; b < blocks; b++) {
          for (int i = 0; i < 128; i++)
            f.l[i] = f.r[i] =
                static_cast<float>(.2 * std::sin((b * 128 + i) * .07));
          feq_room_process(f.room, f.p, 128);
        }
      };
      signal(static_cast<int>(rate / 128));
      feq_room_report(f.room, &report);
      check((report.flags & FEQ_ROOM_REPORT_MATCH) == 0,
            "one second cannot claim a match");
      signal(static_cast<int>(rate / 128));
      feq_room_report(f.room, &report);
      std::printf("capture rate %.0f low %d flags %x gain %.9f\n", rate, low,
                  report.flags, report.reference_gain_db);
      check((report.flags & FEQ_ROOM_REPORT_MATCH) != 0 &&
                std::abs(report.reference_gain_db) <= 6 &&
                std::abs(10 * std::log10(f.room->comparison.wet_energy /
                                         f.room->comparison.reference_energy) -
                         report.reference_gain_db) < .05,
            "usable capture learns bounded gain agreeing with measured "
            "same-segment energy");
      f.s.compare_original = 1;
      feq_room_configure(f.room, &f.s);
      signal(120);
      feq_room_report(f.room, &report);
      check((report.flags & (FEQ_ROOM_REPORT_MATCH | FEQ_ROOM_REPORT_ORIGINAL |
                             FEQ_ROOM_REPORT_PROTECTED)) ==
                (FEQ_ROOM_REPORT_MATCH | FEQ_ROOM_REPORT_ORIGINAL |
                 FEQ_ROOM_REPORT_PROTECTED),
            "comparison preserves capture and position protection");
      f.s.compare_original = 0;
      feq_room_configure(f.room, &f.s);
      signal(120);
      feq_room_report(f.room, &report);
      check((report.flags & FEQ_ROOM_REPORT_ORIGINAL) == 0 &&
                (report.flags & FEQ_ROOM_REPORT_MATCH) != 0,
            "return to wet preserves trustworthy capture");
      f.s.size_m += 1;
      feq_room_configure(f.room, &f.s);
      signal(1);
      feq_room_report(f.room, &report);
      check((report.flags & FEQ_ROOM_REPORT_MATCH) == 0,
            "physical change invalidates match immediately on adoption");
      signal(static_cast<int>(2 * rate / 128));
      f.l[0] = std::numeric_limits<float>::quiet_NaN();
      feq_room_process(f.room, f.p, 128);
      f.silence(8);
      feq_room_report(f.room, &report);
      check((report.flags & FEQ_ROOM_REPORT_MATCH) == 0,
            "nonfinite audio invalidates capture");
      feq_room_reset(f.room);
      f.silence(80);
      feq_room_report(f.room, &report);
      check((report.flags & FEQ_ROOM_REPORT_MATCH) == 0,
            "reset clears learned gain");
    }
  // A reordered actual channel map, including independent rear and side feeds.
  for (int count : {6, 8})
    for (int low : {0, 1}) {
      FeqRoom* room = feq_room_create(48000, count, 128);
      int map[8] = {2, 1, -1, 0, 4, 3, 6, 5};
      float head[24]{};
      for (float& v : head) v = .25f;
      feq_room_set_head(room, head, head, 24, 1, 0);
      feq_room_set_layout(room, map, 2);
      feq_room_set_low_latency(room, low);
      FeqRoomSettings s{};
      feq_room_settings_defaults(&s);
      s.enabled = 1;
      s.compare_original = 1;
      s.renderer_version = 2;
      s.walls = 1;
      feq_room_configure(room, &s);
      float data[8][128]{};
      float* p[8]{};
      for (int c = 0; c < count; c++) p[c] = data[c];
      for (int b = 0; b < 100; b++) feq_room_process(room, p, 128);
      double error = 0;
      int delay = low ? 0 : static_cast<int>(feq_convolver_latency());
      for (int b = 0; b < 12; b++) {
        for (int c = 0; c < count; c++) {
          std::fill(data[c], data[c] + 128, 0.f);
          if (b == 0) data[c][c * 9] = c % 2 ? .1f : -.1f;
        }
        feq_room_process(room, p, 128);
        for (int i = 0; i < 128; i++)
          for (int ear = 0; ear < 2; ear++) {
            double expected = 0;
            for (int c = 0; c < count; c++)
              if (b * 128 + i == delay + c * 9) {
                double x = c % 2 ? .1f : -.1f;
                int sp = map[c];
                if (sp == ear)
                  expected = x;
                else if (sp == 2 || (ear == 0 && (sp == 3 || sp == 5)) ||
                         (ear == 1 && (sp == 4 || sp == 6)))
                  expected = x * .7071067811865476;
              }
            error += std::abs(data[ear][i] - expected);
          }
      }
      check(error < 1e-6,
            "surround Original uses actual channel map, conventional gains and "
            "omits LFE");
      FeqRoomReport report{};
      feq_room_report(room, &report);
      check((report.flags & FEQ_ROOM_REPORT_FOLD_DOWN) != 0,
            "surround reference reports conventional fold-down");
      feq_room_destroy(room);
    }
  for (int channels : {1, 2, 6}) {
    FeqRoom* room = feq_room_create(48000, channels, 128);
    int unknown[8] = {-1, -1, -1, -1, -1, -1, -1, -1};
    float h[24]{};
    for (float& v : h) v = 1;
    feq_room_set_head(room, h, h, 24, 1, 0);
    feq_room_set_layout(room, unknown, -1);
    FeqRoomSettings s{};
    feq_room_settings_defaults(&s);
    s.enabled = 1;
    s.renderer_version = 2;
    s.compare_original = 1;
    s.preserve_position = 1;
    feq_room_configure(room, &s);
    float data[8][128]{};
    float* p[8]{};
    for (int c = 0; c < channels; c++) {
      p[c] = data[c];
      data[c][c] = .1f;
    }
    feq_room_process(room, p, 128);
    FeqRoomReport report{};
    feq_room_report(room, &report);
    check(data[0][0] == .1f && feq_room_active(room) == 0 &&
              feq_room_latency_frames(room) == 0 && (report.flags & 31) == 0,
          "unsupported and mono layouts pass through without active or "
          "comparison claims");
    feq_room_destroy(room);
  }
  // Pending control publication is not processed state under retirement
  // backpressure.
  Fixture f(48000, 1);
  f.s.preserve_position = 1;
  feq_room_configure(f.room, &f.s);
  f.silence(1);
  for (auto& slot : f.room->retired) slot.store(new FeqRoomKernels());
  f.room->handoff.store(new FeqRoomKernels());
  f.room->active.store(0);
  f.silence(1);
  check(feq_room_position_protected(f.room) != 0,
        "queued inactive setting cannot release processed protection");
}
void continuity_checks() {
  for (double rate : {44100., 48000., 96000., 192000.})
    for (int low : {0, 1}) {
      Fixture f(rate, low);
      f.s.bass_management = 0;
      feq_room_configure(f.room, &f.s);
      f.silence(80);
      for (int b = 0; b < 50; b++) {
        std::fill(f.l, f.l + 128, .2f);
        std::fill(f.r, f.r + 128, .2f);
        feq_room_process(f.room, f.p, 128);
      }
      double previous = f.l[127], jump = 0;
      for (int toggle = 0; toggle < 12; toggle++) {
        f.s.compare_original = toggle % 2 == 0;
        feq_room_configure(f.room, &f.s);
        for (int b = 0; b < 20; b++) {
          std::fill(f.l, f.l + 128, .2f);
          std::fill(f.r, f.r + 128, .2f);
          feq_room_process(f.room, f.p, 128);
          for (float x : f.l) {
            jump = std::max(jump, std::abs(x - previous));
            previous = x;
          }
        }
      }
      std::printf("toggle rate %.0f low %d jump %.9g\n", rate, low, jump);
      check(jump < .11 / (rate * .02) + 1e-6,
            "repeated comparison toggles crossfade without an amplitude step");
      f.s.compare_original = 1;
      feq_room_configure(f.room, &f.s);
      f.silence(80);
      f.l[127] = .37f;
      feq_room_process(f.room, f.p, 128);
      feq_room_reset(f.room);
      double reset_energy = 0;
      for (int i = 0; i < 12; i++) {
        f.silence(1);
        for (float x : f.l) reset_energy += x * x;
      }
      check(reset_energy == 0,
            "Original reset cannot expose old wet or reference history");
      Fixture uninterrupted(rate, low), outgoing(rate, low),
          prepared(rate, low);
      for (auto* x : {&uninterrupted, &outgoing, &prepared}) {
        x->s.compare_original = 1;
        feq_room_configure(x->room, &x->s);
        x->silence(80);
      }
      uninterrupted.l[127] = outgoing.l[127] = .37f;
      uninterrupted.r[96] = outgoing.r[96] = -.27f;
      feq_room_process(uninterrupted.room, uninterrupted.p, 128);
      feq_room_process(outgoing.room, outgoing.p, 128);
      feq_room_transfer(prepared.room, outgoing.room);
      double error = 0;
      for (int b = 0; b < 12; b++) {
        uninterrupted.silence(1);
        prepared.silence(1);
        for (int i = 0; i < 128; i++)
          error += std::abs(uninterrupted.l[i] - prepared.l[i]) +
                   std::abs(uninterrupted.r[i] - prepared.r[i]);
      }
      check(error == 0,
            "compatible handover preserves Original delay contents and fade "
            "state exactly");
    }
  Fixture a(48000, 1), b(48000, 1);
  for (auto* f : {&a, &b}) {
    f->s.walls = .2;
    f->s.ambience_mix = .8;
    f->s.ambience_decay_s = 1.8;
    feq_room_configure(f->room, &f->s);
    f->silence(100);
    f->l[0] = .5f;
    feq_room_process(f->room, f->p, 128);
  }
  a.s.compare_original = 1;
  feq_room_configure(a.room, &a.s);
  feq_room_configure(b.room, &b.s);
  for (int i = 0; i < 20; i++) {
    a.silence(1);
    b.silence(1);
  }
  a.s.compare_original = 0;
  feq_room_configure(a.room, &a.s);
  feq_room_configure(b.room, &b.s);
  double error = 0, energy = 0;
  for (int i = 0; i < 60; i++) {
    a.silence(1);
    b.silence(1);
    if (i > 12)
      for (int j = 0; j < 128; j++) {
        error += std::abs(a.l[j] - b.l[j]);
        energy += b.l[j] * b.l[j];
      }
  }
  check(energy > 1e-12 && error < 1e-8,
        "wet ambience keeps running during Original and returns with its live "
        "tail");
  check(
      allocations.load() == 0 && releases.load() == 0,
      "comparison process and transfer never allocate or destroy heap owners");
}
void dimension_checks() {
  FeqChain* a = feq_chain_create(48000, 2, 128);
  FeqChain* b = feq_chain_create(48000, 2, 128);
  float head[24]{}, right[24]{};
  for (int i = 0; i < 24; i++) {
    head[i] = i >= 12 ? .7f : .1f;
    right[i] = i >= 12 ? .1f : .7f;
  }
  int map[8] = {0, 1, -1, -1, -1, -1, -1, -1};
  for (auto* c : {a, b}) {
    feq_chain_set_room_head(c, head, right, 24, 1, 0);
    feq_chain_set_room_layout(c, map);
  }
  FeqChainSettings s{};
  feq_chain_settings_defaults(&s);
  s.enabled = 1;
  s.room.enabled = 1;
  s.room.renderer_version = 2;
  s.room.walls = 1;
  s.room.preserve_position = 1;
  s.dimension.enabled = 1;
  s.dimension.mid_width = 2;
  s.dimension.high_width = 2;
  s.dimension.decorrelation = 1;
  s.master.enabled = 1;
  s.master.output_trim_db = -3;
  feq_chain_configure(a, &s);
  check((feq_chain_active_stages(a) & (1u << 7)) == 0,
        "control planning excludes Dimension under prepared Room protection");
  s.dimension.enabled = 0;
  feq_chain_configure(b, &s);
  float al[128]{}, ar[128]{}, bl[128]{}, br[128]{};
  float* ap[2] = {al, ar};
  float* bp[2] = {bl, br};
  double error = 0;
  for (int block = 0; block < 200; block++) {
    for (int i = 0; i < 128; i++) {
      al[i] = bl[i] =
          static_cast<float>(.1 * std::sin((block * 128 + i) * .07));
      ar[i] = br[i] =
          static_cast<float>(.08 * std::sin((block * 128 + i) * .11));
    }
    feq_chain_process(a, ap, 128);
    feq_chain_process(b, bp, 128);
    if (block > 100)
      for (int i = 0; i < 128; i++)
        error += std::abs(al[i] - bl[i]) + std::abs(ar[i] - br[i]);
  }
  check(feq_chain_room_active(a) != 0,
        "protection fixture really runs a mapped Room");
  check(error == 0,
        "protected Room bypasses Dimension wet audio with other rack stages "
        "unchanged");
  check(a->settings.dimension.enabled == 1,
        "protection never changes stored Dimension setting");
  check((feq_chain_processed_stages(a) & ((1u << 6) | (1u << 7))) == (1u << 6),
        "actual stage report agrees with Room position protection");
  s.dimension.enabled = 1;
  s.room.enabled = 0;
  feq_chain_configure(a, &s);
  check((feq_chain_active_stages(a) & (1u << 7)) != 0 &&
            (feq_chain_processed_stages(a) & (1u << 7)) == 0,
        "control plan can change without reading or overwriting adopted protection");
  for (int block = 0; block < 100; block++) {
    for (int i = 0; i < 128; i++) {
      al[i] = .1f;
      ar[i] = -.1f;
    }
    feq_chain_process(a, ap, 128);
  }
  check(feq_dimension_fade(&a->dimension) > .99,
        "Room off restores stored Dimension with its existing fade");
  check((feq_chain_processed_stages(a) & ((1u << 6) | (1u << 7))) == (1u << 7),
        "inactive Room restores actual Dimension stage report");
  s.room.enabled = 1;
  feq_chain_set_room_head(a, nullptr, nullptr, 0, 0, 0);
  feq_chain_configure(a, &s);
  feq_chain_process(a, ap, 128);
  check(!feq_room_position_protected(a->room) &&
            feq_dimension_fade(&a->dimension) > .99,
        "missing head restores ordinary Dimension behavior");
  feq_chain_set_room_head(a, head, right, 24, 1, 0);
  int unknown[8] = {-1, -1, -1, -1, -1, -1, -1, -1};
  feq_chain_set_room_layout(a, unknown);
  feq_chain_configure(a, &s);
  feq_chain_process(a, ap, 128);
  check(!feq_room_position_protected(a->room) &&
            feq_dimension_fade(&a->dimension) > .99,
        "unsupported source restores ordinary Dimension behavior");
  feq_chain_destroy(a);
  feq_chain_destroy(b);
}
void raw_route_checks() {
  for (int low : {0, 1}) for (int original : {0, 1}) {
    FeqChain* chain = feq_chain_create(48000, 2, 128);
    FeqMeters* meters = feq_meters_create(2);
    feq_chain_set_meters(chain, meters);
    float head[24];
    std::fill(head, head + 24, .25f);
    int map[8] = {0, 1, -1, -1, -1, -1, -1, -1};
    feq_chain_set_room_head(chain, head, head, 24, 1, 0);
    feq_chain_set_room_layout(chain, map);
    FeqChainSettings s{};
    feq_chain_settings_defaults(&s);
    s.enabled = 1;
    s.low_latency = low;
    s.room.enabled = 1;
    s.room.renderer_version = 2;
    s.room.preserve_position = 1;
    s.room.compare_original = original;
    s.room.ambience_mix = .5;
    s.room.bass_management = 0;
    s.dimension.enabled = 1;
    s.eq.enabled = 0;
    s.output_safety_enabled = 1;
    feq_chain_configure(chain, &s);
    ChainRoute route;
    ProcessingLatency latency;
    float l[128]{}, r[128]{};
    float* planar[2] = {l, r};
    // Adopt the initial non-Room EQ handoff before tracking route changes.
    // That existing handoff deletes its envelope; the route owns no handoff.
    route.process(chain, meters, false, planar, 128, latency);
    auto run = [&](bool raw, int blocks, bool signal) {
      for (int block = 0; block < blocks; ++block) {
        for (int i = 0; i < 128; ++i)
          l[i] = r[i] = signal ? static_cast<float>(.2 * std::sin((block * 128 + i) * .07)) : 0.f;
        audio = true;
        route.process(chain, meters, raw, planar, 128, latency);
        audio = false;
      }
    };
    run(false, 900, true);
    FeqRoomReport report{};
    feq_meters_read_room(meters, &report);
    AnalysisPublication publication;
    check(publication.take(0, false, 0, report) &&
              !publication.take(0, false, 0, report),
          "host emits a changed Room report without windows and deduplicates it");
    check((report.flags & (FEQ_ROOM_REPORT_ACTIVE | FEQ_ROOM_REPORT_MATCH)) ==
              (FEQ_ROOM_REPORT_ACTIVE | FEQ_ROOM_REPORT_MATCH),
          "raw route starts from a genuinely active matched Room");
    check(((report.flags & FEQ_ROOM_REPORT_ORIGINAL) != 0) == (original != 0),
          "raw route covers both wet and Original");
    run(true, 1, true);
    feq_meters_read_room(meters, &report);
    check(report.flags == FEQ_ROOM_REPORT_TAG && report.reference_gain_db == 0,
          "first raw frame publishes truthful inactive unmatched Room");
    check(publication.take(0, false, 0, report) &&
              !publication.take(0, false, 0, report),
          "host emission gate sends raw inactive once with zero spectra/scope/bands");
    publication.clear();
    check(publication.take(0, false, 0, report),
          "analysis reconnect republishes current raw inactive status");
    check(l[64] == static_cast<float>(.2 * std::sin(64 * .07)),
          "raw route preserves source samples without DSP processing");
    std::array<uint32_t, 10> words{};
    check(latency.read(words) && words == std::array<uint32_t, 10>{},
          "raw sender reports zero processing parts and active stages");
    run(true, 4, false);
    double tail = 0;
    for (int block = 0; block < 100; ++block) {
      run(false, 1, false);
      for (int i = 0; i < 128; ++i) tail += l[i] * l[i] + r[i] * r[i];
    }
    check(tail == 0, "return from raw cannot replay old Room/reference/tail samples");
    feq_meters_read_room(meters, &report);
    check((report.flags & FEQ_ROOM_REPORT_MATCH) == 0,
          "return from raw must relearn instead of reusing the old capture");
    check(latency.read(words) && (words[9] & ((1u << 6) | (1u << 7))) == (1u << 6),
          "resumed latency stage snapshot agrees with actual Room protection");
    run(false, 900, true);
    feq_meters_read_room(meters, &report);
    check((report.flags & FEQ_ROOM_REPORT_MATCH) != 0,
          "new route can learn a fresh match from sufficient audio");
    feq_chain_destroy(chain);
    feq_meters_destroy(meters);
  }
  check(allocations.load() == 0 && releases.load() == 0,
        "raw route transitions/process never allocate or free");
}

int main(int argc, char** argv) {
  raw_route_checks();
  extended_checks();
  continuity_checks();
  dimension_checks();
  FeqMeters* meters = feq_meters_create(2);
  FeqRoomReport report{FEQ_ROOM_REPORT_TAG | 31u, -3};
  feq_meters_publish_room(meters, &report);
  FeqRoomReport read{};
  feq_meters_read_room(meters, &read);
  FeqWireAnalysisFrame wire{};
  wire.magic = FEQ_MAGIC_ANALYSIS;
  wire.bins = FEQ_METER_BINS;
  feq_wire_room_report(wire, read);
  check(wire.reserved_tail == report.flags && wire.bass_reserved_tail == -3 &&
            sizeof(wire) == 560,
        "actual meter and shared host/APO encoder preserve tagged fields and "
        "framing");
  if (argc > 1) {
    FILE* file = nullptr;
#ifdef _WIN32
    fopen_s(&file, argv[1], "wb");
#else
    file = std::fopen(argv[1], "wb");
#endif
    if (file) {
      std::fwrite(&wire, 1, sizeof(wire), file);
      std::fclose(file);
    }
  }
  feq_meters_destroy(meters);
  for (double rate : {44100., 48000., 96000., 192000.})
    for (int low : {0, 1}) {
      Fixture f(rate, low);
      f.s.compare_original = 1;
      feq_room_configure(f.room, &f.s);
      f.silence(80);
      double err = 0;
      int delay = low ? 0 : feq_convolver_latency();
      for (int b = 0; b < 12; b++) {
        std::fill(f.l, f.l + 128, 0.0f);
        std::fill(f.r, f.r + 128, 0.0f);
        if (b == 0) {
          f.l[3] = .3f;
          f.r[17] = -.2f;
        }
        feq_room_process(f.room, f.p, 128);
        for (int i = 0; i < 128; i++) {
          int n = b * 128 + i;
          err += std::abs(f.l[i] - (n == delay + 3 ? .3f : 0)) +
                 std::abs(f.r[i] - (n == delay + 17 ? -.2f : 0));
        }
      }
      check(err < 1e-6,
            "Original is the independent input pair at processing delay");
      f.s.source_already_spatial = 1;
      feq_room_configure(f.room, &f.s);
      f.silence(80);
      f.l[0] = .32f;
      f.r[0] = -.12f;
      feq_room_process(f.room, f.p, 128);
      check(f.l[0] == .32f && f.r[0] == -.12f,
            "manual source preference bypasses Room");
      check(
          feq_room_active(f.room) == 0 && feq_room_latency_frames(f.room) == 0,
          "manual bypass planning active/latency truthful");
    }
  return feq_test::finish();
}
