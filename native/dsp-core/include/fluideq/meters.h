/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the panel draws, measured where the audio actually is.
 *
 * The displays in the DSP panel — the spectrum behind the EQ curve, the
 * exciter's own band, the master graph, the goniometer and the phase needle —
 * were fed by `AnalyserNode`s hanging off the Web Audio graph. That worked for
 * exactly as long as the Web Audio graph was the thing making the sound. Once
 * the native engine became audible the elements are muted, no signal reaches
 * those nodes, and every one of those displays reads silence while the music
 * plays. Reported from a listening session as "I hear it but the graph is not
 * moving", which is precisely what it is.
 *
 * The fix is not to keep the TypeScript chain running so the meters have
 * something to look at — that is the double CPU cost `standDown` exists to
 * avoid, and it would draw a picture of a chain nobody is listening to. The
 * engine doing the work has to report what it did.
 *
 * ## What runs where, and why it matters
 *
 * `feq_meters_capture` is called from the audio callback and does the least
 * possible: a windowed copy and a few running sums. It allocates nothing, takes
 * no lock and computes no transform. A 2048-point FFT costs tens of
 * microseconds and there are three of them; on a device with a 10 ms period
 * that is affordable right up until it is not, and a meter that can cause a
 * dropout is a worse bug than a meter that does not move.
 *
 * So the transform happens in `feq_meters_read_spectrum`, which the host calls
 * from its control thread. The two are joined by a seqlock per stage: the audio
 * thread publishes a completed window without ever waiting, and a reader that
 * catches a window mid-write notices and retries rather than drawing a frame
 * spliced out of two different moments.
 *
 * ## Matching what it replaces
 *
 * The numbers are chosen to agree with the `AnalyserNode` this stands in for,
 * because the graphs were drawn and tuned against it: a 2048-point transform,
 * 1024 bins, a Blackman window, magnitudes divided by the transform size, and
 * the same 0.8 smoothing applied between frames. A spectrum that is correct but
 * differently scaled would land as every graph in the app changing shape on the
 * day the engine changed, which is indistinguishable from a bug.
 */
#ifndef FLUIDEQ_METERS_H
#define FLUIDEQ_METERS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** The transform size, matching `analyser.fftSize` in `graph.ts`. */
#define FEQ_METER_WINDOW 2048
/** Half of it, matching `analyser.frequencyBinCount`. */
#define FEQ_METER_BINS 1024
/**
 * Sample pairs kept for the goniometer.
 *
 * The worklet sends every fourth pair of a ~2048-sample report for a display
 * three centimetres across; this keeps a comparable number for the same reason.
 * Two thousand dots on that box is a filled square, not a shape.
 */
#define FEQ_METER_SCOPE_PAIRS 256

/**
 * The taps, in the order the audible chain passes them.
 *
 * Three rather than the six `DSP_OUTPUT_INDEX` names, because three are all the
 * renderer ever reads: `DspEqGraph` and `DspPhaseMeter` want `eq`,
 * `DspExciterGraph` wants `exciter`, `DspMasterGraph` wants `master`. Capturing
 * the other three would be work done every block for a picture nobody draws.
 */
typedef enum FeqMeterStage {
  FEQ_METER_STAGE_EXCITER = 0,
  FEQ_METER_STAGE_EQ = 1,
  FEQ_METER_STAGE_MASTER = 2,
  FEQ_METER_STAGE_COUNT = 3
} FeqMeterStage;

/**
 * The most EQ bands whose activity is reported. Matches the rack's ceiling.
 */
#define FEQ_METER_MAX_BANDS 64

/** The exciter has three bands, and the display shows three lights. */
#define FEQ_METER_EXCITER_BANDS 3

typedef struct FeqMeters FeqMeters;

FeqMeters* feq_meters_create(uint32_t channels);
void feq_meters_destroy(FeqMeters* meters);

/**
 * Off by default, and genuinely free while off.
 *
 * The panel is one tab of several and is usually closed. `capture` returns on
 * its first branch when this is clear, so a user who never opens the DSP tab
 * pays nothing for the machinery that draws it.
 */
void feq_meters_set_enabled(FeqMeters* meters, int enabled);
int feq_meters_enabled(const FeqMeters* meters);

/**
 * Tell the meters how fast their windows will arrive, so decay matches.
 *
 * `AnalyserNode` applies its 0.8 smoothing on every call to
 * `getFloatFrequencyData` — which the graphs make once per animation frame, so
 * sixty times a second. These publish one window per `FEQ_METER_WINDOW`
 * samples, about twenty-three times a second at 48 kHz. The same coefficient
 * at less than half the rate is a decay that takes more than twice as long,
 * and it is visible: reported as the graphs having "slow release" on the
 * native engine compared to the TypeScript one.
 *
 * So the coefficient is derived from the rate rather than copied. Call it
 * whenever the device rate changes; until it is called, 48 kHz is assumed.
 */
void feq_meters_set_sample_rate(FeqMeters* meters, double sample_rate);

/**
 * Take one block at one stage. **Audio thread.**
 *
 * Real-time safe in the strict sense: no allocation, no lock, no OS call, no
 * transform. Down-mixes to mono for the spectrum the same way `AnalyserNode`
 * does, and at the master stage also keeps the sample pairs and running sums
 * the scope and the phase needle are drawn from.
 */
void feq_meters_capture(FeqMeters* meters,
                        uint32_t stage,
                        const float* const* channels,
                        uint32_t frames);

/**
 * Magnitudes in dB for one stage, into `out_db`. **Control thread.**
 *
 * Returns 0 when no new window has been published since the last read, so the
 * host can skip sending a frame that would repaint the same picture. `bins`
 * must be `FEQ_METER_BINS`.
 */
int feq_meters_read_spectrum(FeqMeters* meters,
                             uint32_t stage,
                             float* out_db,
                             uint32_t bins);

/**
 * The goniometer's pairs, the correlation and the peaks. **Control thread.**
 *
 * `out_pairs` receives `pairs * 2` floats, interleaved left, right. Returns 0
 * when nothing new has been published.
 *
 * Correlation is +1 for identical channels, 0 for unrelated, negative for
 * content that will partly cancel when summed to mono — the same convention
 * the worklet reports, so the needle does not change meaning with the engine.
 */
int feq_meters_read_scope(FeqMeters* meters,
                          float* out_pairs,
                          uint32_t pairs,
                          double* out_correlation,
                          float* out_peaks);

/**
 * What each EQ band is currently applying, and what it is hearing.
 * **Audio thread.**
 *
 * `amounts` is 0 to 1 per band — always 1 for a static band, which is what
 * makes it static — and `levels` is each band's own detected envelope as a
 * linear amplitude, which is the quantity its threshold is compared against.
 *
 * Reported at all because a dynamic band is the one control in the rack whose
 * effect cannot be drawn from its settings. The curve is drawn at full strength
 * and its at-rest twin at zero, and neither moves when the threshold does — so
 * without this the threshold dial looks broken while working perfectly. The
 * worklet used to send these; it no longer processes anything, so the engine
 * that does has to.
 */
void feq_meters_publish_bands(FeqMeters* meters,
                              const double* amounts,
                              const double* levels,
                              uint32_t count);

/**
 * The exciter three bands and its organic stage. **Audio thread.**
 *
 * Four numbers rather than a window, because that is all the display is: three
 * band contributions and one organic mix, each already a block mean.
 */
void feq_meters_publish_exciter(FeqMeters* meters,
                                const double* bands,
                                double organic);

/** The published exciter activity. **Control thread.** */
void feq_meters_read_exciter(FeqMeters* meters,
                             float* out_bands,
                             float* out_organic);

/** The published band activity. **Control thread.** Returns the band count. */
uint32_t feq_meters_read_bands(FeqMeters* meters,
                               float* out_amounts,
                               float* out_levels,
                               uint32_t capacity);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_METERS_H */
