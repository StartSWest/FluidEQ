/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps: brings up the quiet sounds of a game as they arrive.
 *
 * A game is mixed for its loud moments, so a player turns the volume to
 * where the gunfire is bearable and the steps around the corner go faint.
 * A tone curve cannot help: it lifts the step and the shot by the same
 * amount, and the step stays exactly as far under. This lifts a sound only
 * when four things are all true of it, each measured in its own band and
 * against the programme — how loud the mix has been over the last few
 * seconds — never against a fixed level, because a game, or a video of one,
 * sits wherever its mixer and its volume put it:
 *
 * - **It is quiet.** The lift is an upward ratio of 2.5 under the
 *   programme's level (never under -24 dB), never past it, judged on the
 *   fastest reading there is — so a shot landing while a step is lifted does
 *   not inherit the lift for the length of its release.
 * - **It is arriving.** The level against a follower 30 ms behind it and
 *   against the bed: a step's front stands out of both and its echo falls
 *   below them, so the step comes up and its reverb does not. The front is
 *   held for a step's length (200 ms) while the band still stands over its
 *   bed. Fast compression that lifts the reverb with the sound is what makes
 *   a direction go vague in a room (Hassager et al., JASA 2017: compression
 *   driven by the direct sound keeps the spatial image; compression that
 *   lifts reverberant energy blurs it).
 * - **It stands out of the bed.** Rain, wind and music are learnt as a floor
 *   that rises slowly and falls quickly, and only what stands 2 to 6 dB above
 *   it is lifted. A 2 ms raindrop reaches a third of its height through the
 *   5 ms attack and is not taken for a step. The band is heard through its
 *   filter twice for this, so a game's bass does not fill the steps band's
 *   bed; silence teaches the bed nothing.
 * - **Nothing around it is loud.** While the whole signal stands 3 to 9 dB
 *   over the programme and over -30 to -20 dBFS — a shot, a blast — nothing
 *   is lifted: an explosion's own quiet treble would come up with it, and a
 *   cue under it is masked anyway.
 *
 * Every channel but the LFE shares one decision and one gain per band, so a
 * sound keeps its place: compression that differs between the ears moves a
 * sound or splits it in two (Wiggins and Seeber, 2011; linked compression
 * restores it, Schwartz and Shinn-Cunningham, JASA 2013).
 *
 * The lift is three bells, each added back as `x + (g - 1) * bandpass(x)`,
 * which is the input EXACTLY while nothing is lifted: the weight of a step
 * (300 Hz, up to 4 dB), its scuff and the gear (2.4 kHz over almost two
 * octaves, up to 10 dB) and the detail that tells front from back (7 kHz,
 * up to 6 dB, wide enough to scale the ear's notches rather than fill them).
 *
 * Calm is a first-order low shelf at 250 Hz, the Regalia-Mitra form, that
 * comes down under a rumble that jumps out of the mix — up to 9 dB, two
 * thirds of whatever the band stands over the programme plus 3 dB — and lets
 * go with a 110 ms release, so the step after an explosion is heard at its
 * own level, and a game that is bass all along keeps its bass.
 *
 * There is no look-ahead and no delay: the stage fits game mode as it is.
 */
#ifndef FLUIDEQ_FOOTSTEPS_H
#define FLUIDEQ_FOOTSTEPS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Weight, steps, detail, in that order. */
#define FEQ_FOOTSTEPS_BANDS 3
/** As many channels as a chain carries. */
#define FEQ_FOOTSTEPS_MAX_CHANNELS 8

typedef struct FeqFootstepsSettings {
  int enabled;
  /** Play only what the stage adds, everything else silent. */
  int isolate;
  /** 0 to 1: how much of each band's largest lift may be taken. */
  double lift;
  /** 0 to 1: how much of the rumble's largest cut may be taken. */
  double calm;
} FeqFootstepsSettings;

/** Off, at the Competitive profile's Lift and Calm. */
void feq_footsteps_settings_defaults(FeqFootstepsSettings* settings);

/**
 * What the stage did since the report was last taken, for the page to draw.
 *
 * Levels are the stage's own readings in dB: a full-scale sine reads 0. A
 * lift is positive, a calm never is.
 */
typedef struct FeqFootstepsReport {
  /** The loudest the whole signal was, every channel but the LFE. */
  float level_db;
  /** The loudest the steps band was. */
  float cue_db;
  /** The steps band's learnt floor, as last measured. */
  float bed_db;
  /** Each band's largest lift: weight, steps, detail. */
  float lift_db[FEQ_FOOTSTEPS_BANDS];
  /** The rumble's deepest cut, never positive. */
  float calm_db;
} FeqFootstepsReport;

typedef struct FeqFootsteps FeqFootsteps;

/** Allocates everything the audio thread will touch. Null on failure. */
FeqFootsteps* feq_footsteps_create(double sample_rate, uint32_t channels);
void feq_footsteps_destroy(FeqFootsteps* footsteps);

/**
 * Adopt the dials. CONTROL thread; may be called while the audio thread
 * processes, which reads each dial once at the top of a block. A change is
 * never a step: every gain glides to what the new dials ask.
 */
void feq_footsteps_configure(FeqFootsteps* footsteps,
                             const FeqFootstepsSettings* settings);

/**
 * Which channel is the subwoofer feed, or -1 for none, as the host reads it
 * from the stream's mask. CONTROL thread, before the chain is published. The
 * LFE is neither listened to nor lifted.
 */
void feq_footsteps_set_lfe(FeqFootsteps* footsteps, int lfe_channel);

/**
 * One block, in place. AUDIO thread; allocates nothing, takes no lock.
 * Switched off, it lets every gain go back to unity and then does nothing at
 * all until it is switched on again, when it learns the bed afresh.
 */
void feq_footsteps_process(FeqFootsteps* footsteps, float* const* channels,
                           uint32_t frames);

/**
 * A handover: what `previous` was hearing and lifting comes to `prepared`,
 * which keeps its own dials and LFE. Same rate and channels only — the chain
 * checks both before it calls this.
 */
void feq_footsteps_transfer(FeqFootsteps* prepared, FeqFootsteps* previous);

/** A seek or a new programme: nothing of the last passage is kept. */
void feq_footsteps_reset(FeqFootsteps* footsteps);

/** What the last block did. AUDIO thread, after `process`. */
void feq_footsteps_block_report(const FeqFootsteps* footsteps,
                                FeqFootstepsReport* out);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_FOOTSTEPS_H */
