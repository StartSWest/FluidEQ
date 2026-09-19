/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Room: every channel a speaker around the listener's head, on headphones.
 *
 * Each input channel that has a speaker position is rendered through a
 * measured head — the pair of ear responses for its direction — plus four
 * first-order reflections off the walls of a shoebox room, and the two ear
 * signals leave on the front pair; every other channel leaves silent. A
 * stereo stream is two speakers in front, 5.1 and 7.1 the ring, decided by
 * the layout the host hands over, not by a setting.
 *
 * Kernels are built on the control thread (`feq_room_configure`) and handed
 * to the audio thread through one atomic exchange, then faded in over the
 * convolver's blend, so a dial moving mid-stream is heard as the room
 * changing and not as a click. Nothing here allocates on the audio thread.
 */
#ifndef FLUIDEQ_ROOM_H
#define FLUIDEQ_ROOM_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** FL, FR, C, SL, SR, RL, RR — the order of every per-speaker array. */
#define FEQ_ROOM_SPEAKERS 7
#define FEQ_ROOM_MAX_CHANNELS 8
/**
 * A kernel's length: the head's response plus reflections arriving within
 * this many frames of it. At 48 kHz that is 37 ms past the direct path; a
 * reflection that would land later is dropped rather than wrapped.
 */
#define FEQ_ROOM_KERNEL_TAPS 2048

typedef struct FeqRoomSettings {
  int enabled;
  /** The shoebox's side, 2 to 12 m; the listener sits in the middle. */
  double size_m;
  /** 0 hard walls (full reflections) to 1 dead walls (none). */
  double walls;
  /** Listener to every speaker, 0.5 m to half the room. */
  double distance_m;
  /** Gain on the centre speaker's channel, dB. */
  double centre_db;
  /** Gain on the LFE's feed to both ears, dB. */
  double sub_db;
  /**
   * Bass management, as a receiver does it: everything below `crossover_hz`
   * leaves every speaker channel (a Linkwitz-Riley 4th-order high-pass) and
   * goes, summed and low-passed the same way, to the sub's path — both ears
   * alike, at unity, beside the LFE. Bass then never goes through the walls'
   * reflections, where its comb filtering is heard as boom, and a stereo
   * mix's bass stays in the middle.
   */
  int bass_management;
  /** 40 to 200 Hz; 80 is what receivers ship with. */
  double crossover_hz;
  /**
   * Music upmix: a stereo stream fills the whole ring instead of standing
   * on the front pair. The front pair is left as it is; the centre gets
   * what both sides share; what they do not share — the side signal,
   * high-passed so bass stays put — goes to the sides a moment later and
   * to the rears later still, softened, each pair in opposite polarity, the
   * way a passive surround decoder derives its ambience. `upmix_amount`
   * (0 to 1) scales the three derived feeds; the fronts never change. Only a
   * two-channel stream on the front pair is upmixed.
   */
  int music_upmix;
  double upmix_amount;
  /**
   * Scales the head's interaural delay: 1 is the measured head, 1.06 a
   * wider one. The contralateral ear is delayed by the difference, never
   * advanced, so a scale below 1 delays the near ear instead.
   */
  double head_scale;
  /** Each speaker's azimuth, degrees clockwise from straight ahead. */
  double angle_deg[FEQ_ROOM_SPEAKERS];
  double level_db[FEQ_ROOM_SPEAKERS];
  /**
   * Each speaker's own distance in metres, or 0 to stand on the ring at
   * `distance_m`: a room is not round, and a receiver takes each distance
   * so a nearer speaker arrives when it should.
   */
  double speaker_distance_m[FEQ_ROOM_SPEAKERS];
  /** Seven speakers then the sub: a muted one builds no kernel and is silent. */
  int mute[FEQ_ROOM_SPEAKERS + 1];
} FeqRoomSettings;

typedef struct FeqRoom FeqRoom;

void feq_room_settings_defaults(FeqRoomSettings* settings);

FeqRoom* feq_room_create(double sample_rate, uint32_t channels,
                         uint32_t max_frames);
void feq_room_destroy(FeqRoom* room);

/**
 * The head: `directions` ear pairs of `taps` frames each, direction-major,
 * for azimuths `k * 360 / directions` clockwise from ahead. Copied. With
 * `doubling` the responses are at half the room's rate and are interpolated
 * up. CONTROL thread; rebuilds the kernels if the room is configured.
 */
void feq_room_set_head(FeqRoom* room, const float* left, const float* right,
                       uint32_t directions, uint32_t taps, int doubling);

/**
 * Which speaker each channel feeds (0..6, or -1 for none) and which channel
 * is the LFE (or -1). CONTROL thread; rebuilds if configured.
 */
void feq_room_set_layout(FeqRoom* room, const int* speaker, int lfe_channel);

/** CONTROL thread. Copies the settings and publishes new kernels. */
void feq_room_configure(FeqRoom* room, const FeqRoomSettings* settings);

/**
 * AUDIO thread. In place: channels 0 and 1 leave carrying the two ears,
 * the rest leave silent. Untouched while the room is not active.
 */
void feq_room_process(FeqRoom* room, float* const* channels, uint32_t frames);

/**
 * Whether the stage folds right now: enabled, a head loaded, two or more
 * channels, and at least one of them with a speaker.
 */
int feq_room_active(const FeqRoom* room);

/** One convolver partition while active, otherwise 0 — and 0 in game mode. */
uint32_t feq_room_latency_frames(const FeqRoom* room);

/**
 * CONTROL thread. Game mode: each kernel's first partition runs as a direct
 * FIR so the room adds no delay of its own (`feq_convolver_head_run`). Read
 * by the next set built, which `feq_room_configure` publishes; the chain
 * calls this just before it, on every configure.
 */
void feq_room_set_low_latency(FeqRoom* room, int on);

/**
 * AUDIO thread, at a chain handover: `prepared` takes over what `previous`
 * is playing — its live set, the convolvers' tails, a fade in progress and
 * the sub's filter — and its own published set becomes the replacement,
 * warmed and faded in like any dial change. Without this a rebuilt chain's
 * room started from empty convolvers: one partition of silence, heard as
 * the sound cutting for an instant on every change to a room dial.
 * Allocates nothing; refused unless both rooms share rate, width and
 * block size. `previous` is left with no set to play.
 */
void feq_room_transfer(FeqRoom* prepared, FeqRoom* previous);

/**
 * The sub's filter state and the mixes. The convolvers keep their tails —
 * at most the blend's 21 ms — because emptying them would mean re-creating
 * them, and this may be called from the audio thread on a seek.
 */
void feq_room_reset(FeqRoom* room);

#ifdef __cplusplus
}
#endif

#endif  // FLUIDEQ_ROOM_H
