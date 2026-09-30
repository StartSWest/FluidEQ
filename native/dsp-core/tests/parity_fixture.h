/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the parity run and its renderers share: the fixture format and the
 * fixture read from it, the difference between two renders, the table of
 * what has left parity on purpose, a rack parsed from a fixture, and the
 * coverage counters.
 */
#ifndef FLUIDEQ_PARITY_FIXTURE_H
#define FLUIDEQ_PARITY_FIXTURE_H

#include "fluideq/analog_diode.h"
#include "fluideq/bass_punch.h"
#include "fluideq/biquad.h"
#include "fluideq/dsp.h"
#include "fluideq/dynamics.h"
#include "fluideq/eq.h"
#include "fluideq/exciter.h"
#include "fluideq/exciter_guard.h"
#include "fluideq/organic.h"
#include "fluideq/organic_stage.h"
#include "fluideq/oversample.h"
#include "fluideq/phase_align.h"
#include "fluideq/primitives.h"
#include "fluideq/convolver.h"
#include "fluideq/linear_phase.h"
#include "fluideq/chain.h"
#include "fluideq/crossfade.h"
#include "fluideq/loudness.h"
#include "fluideq/post_filter_normalizer.h"
#include "fluideq/limiter.h"
#include "fluideq/saturate.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <map>
#include <fstream>
#include <span>
#include <string>
#include <vector>

namespace feq_parity {

constexpr uint32_t kMagic = 0x46514546; /* FEQF */
constexpr uint32_t kVersion = 1;
constexpr size_t kHeaderBytes = 112;
constexpr size_t kNameBytes = 64;
/** Fields per band in a rack's parameter block. */
constexpr size_t kBandParams = 6;

enum ProcessorId : uint32_t {
  kIdentity = 0,
  kBiquad = 1,
  kEqBands = 2,
  kEqLinked = 3,
  kEqOversampled = 4,
  kEqOversampledLinked = 5,
  kDelayLine = 6,
  kCrossover = 7,
  kTruePeak = 8,
  kSaturate = 9,
  kLimiter = 10,
  kLinkedLimiter = 11,
  kCompressor = 12,
  kCompressorLinked = 13,
  kOutputSafety = 14,
  kAutoHeadroom = 15,
  kExciterTransient = 16,
  /* 17 was kAnalogDiode, whose shaper nothing calls any more. */
  kPhaseAlign = 18,
  kExciterGuard = 19,
  kOrganic = 20,
  kOrganicPath = 21,
  kExciter = 22,
  kConvolver = 23,
  kLinearPhase = 24,
  kLoudness = 25,
  kCrossfade = 26,
  kChain = 27
};

struct Fixture {
  std::string name;
  uint32_t processor = 0;
  uint32_t sample_rate = 0;
  uint32_t channels = 0;
  uint32_t frames = 0;
  double max_abs_tolerance = 0.0;
  double rms_tolerance = 0.0;
  std::vector<double> params;
  /** Planar: channel 0's frames, then channel 1's. */
  std::vector<float> input;
  std::vector<float> expected;
};

struct Difference {
  double max_abs = 0.0;
  double rms = 0.0;
  bool non_finite = false;
};

/**
 * Coverage, not correctness — and the two are different failures.
 *
 * A dynamic band whose threshold the corpus never crosses produces exactly the
 * same output as a static one, matches the reference perfectly, and tests only
 * the branch that returns zero. These count how often a detector actually
 * opened, so a rack that quietly stopped engaging shows up as a coverage
 * collapse rather than as a still-green suite.
 */
inline size_t g_dynamic_fixtures = 0;
inline size_t g_dynamic_engaged = 0;

/**
 * Set by `render_chain` when a whole-chain fixture cannot be read in the layout
 * the corpus was frozen with.
 */
inline bool g_chain_layout_stale = false;

/**
 * What this engine no longer agrees with the TypeScript rack about, on
 * purpose, with the reason and where the behaviour that replaced it is held.
 *
 * A frozen corpus is a record of what the port produced, not a specification:
 * when what it recorded has since been changed on purpose — a defect fixed, a
 * behaviour redesigned — matching it is the failure. But a fixture dropped from
 * comparison without a word is how a suite ends up green over an engine that
 * does nothing, so nothing leaves parity except through this table, its
 * fixtures are still rendered, and every run prints what is no longer being
 * compared and why.
 *
 * An entry names a processor, and covers every fixture of it or only the ones
 * it lists. A whole-chain fixture carries every stage at once and most of them
 * have not changed, so it leaves by name — one rack on one signal, for the one
 * change it reaches.
 *
 * An entry that stops matching the fixtures it covers fails the run: it has
 * outlived the corpus it was written against and its reason belongs in history
 * rather than in a table that reads as coverage. So does a named fixture that
 * agrees with its frozen output again: an excuse kept past its need is coverage
 * given away without a word.
 */
struct Superseded {
  uint32_t processor;
  /** The fixtures it covers, by name; empty for every fixture of it. */
  std::span<const char* const> fixtures;
  const char* reason;
};

/**
 * The linear-phase kernels are built from the same coefficients as the
 * equaliser page's Focused character, which narrows by the page's own law
 * since 2026-09-20 (`shapeEqFilters` is the one): the four fixtures here are
 * the proportional ones.
 */
inline constexpr const char* kFocusedKernels[] = {
    "linear-phase/narrow-low-proportional/serial/44100",
    "linear-phase/narrow-low-proportional/serial/48000",
    "linear-phase/narrow-low-proportional/parallel/44100",
    "linear-phase/narrow-low-proportional/parallel/48000",
};

/**
 * The linked limiter's fixtures that reach the end of a release, which since
 * 2026-09-26 crosses its last 2% in a straight line (`release_toward`).
 */
inline constexpr const char* kReleaseFinish[] = {
    "linklim/ramped/8/white-noise",       "linklim/ramped/8/pink-noise",
    "linklim/ramped/8/anti-phase",        "linklim/ramped/8/intersample-peak",
    "linklim/ramped/480/white-noise",     "linklim/ramped/480/intersample-peak",
    "linklim/slewed/8/white-noise",       "linklim/slewed/8/anti-phase",
    "linklim/slewed/480/white-noise",     "linklim/slewed/480/anti-phase",
    "linklim/slewed/480/intersample-peak",
};
/** The same finish in the headroom stage, which is that limiter. */
inline constexpr const char* kHeadroomReleaseFinish[] = {
    "headroom/on/0/intersample-peak",
    "headroom/on/4/intersample-peak",
};

inline constexpr Superseded kSuperseded[] = {
    {kLinkedLimiter, kReleaseFinish,
     "a release crosses the last 2% of its gap in a straight line, at the "
     "pace it had there, since 2026-09-26; it used to jump it in one sample, "
     "0.17 dB in the Maximizer and a tick after every hit it limited (-69 "
     "dBFS above 5 kHz, 150 ms into Punch). Only the fixtures that reach a "
     "release's end differ; limiter_release_test.cpp holds the finish"},
    {kAutoHeadroom, kHeadroomReleaseFinish,
     "the same finish, in the linked limiter this stage is"},
    {kCrossover, {},
     "the three-band split stopped deriving its upper bands by subtraction on "
     "2026-09-19: subtracted bands sit half a cycle apart at the corner, so "
     "unequal band gains cancelled there (-10 to -14 dB at 120-250 Hz under "
     "the Gaming compressor). Held now by crossover_test.cpp, on the response "
     "of the bands put back together"},
    {kPhaseAlign, {},
     "the exciter's Timing delayed those same bands, so it inherited the "
     "hole: six exciter profiles measured a 2-4 dB scoop through 250-1000 Hz "
     "that nothing in their settings asked for. Same split, same date. Since "
     "2026-09-22 it is two all-pass sections and splits nothing, which is the "
     "only way bands delayed against each other stop cancelling where they "
     "meet; exciter_test.cpp holds it flat"},
    {kLinearPhase, kFocusedKernels,
     "the Focused character narrows by the equaliser page's own law since "
     "2026-09-20, and the linear-phase kernels are built from the same "
     "coefficients: the four fixtures here are the proportional ones"},
    {kCompressor, {},
     "the multiband compressor was removed on 2026-09-22 at Ivan's call: a "
     "stage every preset set and no page showed, compressing a rack whose "
     "every visible card was off. Its fixtures are rendered as the "
     "pass-through that stands in its place"},
    {kCompressorLinked, {},
     "the same stage's linked form, gone with it"},
    {kOutputSafety, {},
     "the final guard — a -0.1 dBTP limiter and a 3 Hz high-pass, always on "
     "— was removed on 2026-09-22 at Ivan's call: it held every record "
     "mastered above its ceiling, so a rack with every card off still "
     "changed the sound. Its fixtures are rendered as the pass-through that "
     "stands in its place. Held by chain_transparency_test.cpp: an idle rack "
     "is a delay and nothing else"},
    {kChain, {},
     "every whole-chain fixture was frozen with that guard's high-pass on its "
     "last stage, which is gone, so none of them is the TypeScript rack's "
     "output any more. Before this they had already left one by one: the "
     "three-band split stopped deriving bands by subtraction (2026-09-19; "
     "crossover_test.cpp), the Focused character took the equaliser page's "
     "law (2026-09-20), Bass Punch kept its FIR alignment under bypass "
     "(2026-09-06; bass_mix_test.cpp, engine_test.cpp), and the guard held "
     "the -0.1 dBTP ceiling on racks with nothing ahead of it (2026-09-04). "
     "Every stage is still held to its own fixtures above"},
};

/**
 * One rack, parsed from `[engine, bandCount, (band) * count]` at `offset`.
 *
 * `coefficient_rate` is the rate the FILTERS run at, which is the block rate
 * multiplied by the oversampling factor. Handing an oversampled pass the
 * ordinary set would place every band an octave low — a bug rather than a
 * mode, and one that produces perfectly plausible audio.
 */
struct Rack {
  FeqEqEngine engine = FEQ_EQ_SERIAL;
  uint32_t band_count = 0;
  bool has_dynamic = false;
  std::vector<FeqBiquadCoefficients> coefficients;
  std::vector<double> gain_db;
  std::vector<int> dynamic;
  std::vector<double> threshold_db;
};

bool load(const std::filesystem::path& file, Fixture& out);
Difference compare(const std::vector<float>& actual,
                   const std::vector<float>& expected);
const Superseded* superseded_entry(const Fixture& fixture);
bool parse_rack(const Fixture& fixture,
                size_t offset,
                double coefficient_rate,
                Rack& out);
std::vector<FeqBandDynamics> build_dynamics(const Rack& rack, double rate);
std::vector<FeqBiquadState> fresh_states(uint32_t count);
bool engaged_in(const std::vector<FeqBandDynamics>& dynamics);
void note_coverage(bool has_dynamic, bool engaged);
float* channel_at(std::vector<float>& block, uint32_t channel,
                  uint32_t frames);
bool within_tolerance(const Fixture& fixture, const Difference& difference);
/** Run one fixture through the native engine, or say it cannot be run yet. */
bool render(const Fixture& fixture, std::vector<float>& actual);
/** The whole chain's renderer (parity_render_chain.cpp). */
bool render_chain(const Fixture& fixture, std::vector<float>& actual);

}  // namespace feq_parity

#endif  // FLUIDEQ_PARITY_FIXTURE_H
