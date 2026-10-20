/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ tap, kept as the newest audio rather than as windows in a row.
 *
 * Every other tap publishes one window in every 2048 samples and smooths it
 * at `AnalyserNode`'s 0.8, which put the DSP EQ page's spectrum 23 pictures a
 * second behind the music, smeared over about 75 ms, and drew everything
 * under 300 Hz from bins 23 Hz wide — the bass a blob whatever was playing
 * (Ivan, 2026-10-17: "more realtime ... more realistic show for freq"). The
 * main graph had already solved both, with a fresh short window every frame
 * and a 16384-point window for the bottom octaves; this gives the EQ page the
 * same two readings from the engine, measured where the EQ is.
 *
 * So this tap keeps a ring of the newest audio and any read takes the window
 * ending NOW: the short one whenever audio has arrived since the last, the
 * long one when a fortieth of a second has. Both unsmoothed — the graph has
 * its own ballistics, and a blend here would put a 75 ms attack under them
 * that they cannot take out.
 *
 * Single writer, single reader, no lock: the writer stores the frame count
 * after each block's samples, and the reader re-reads it after copying. The
 * ring is twice the long window, so a copy is torn only if the writer wrote
 * more than a long window during it — and then the read is skipped, never
 * drawn spliced.
 */
#ifndef FLUIDEQ_METERS_EQ_LIVE_H
#define FLUIDEQ_METERS_EQ_LIVE_H

#include <atomic>
#include <cstdint>
#include <vector>

struct EqLiveWindow {
  EqLiveWindow();
  /** The newest frames of each channel, at `frame % ring` (audio thread). */
  std::vector<float> left;
  std::vector<float> right;
  /** Frames written in all, stored after each block's samples land. */
  std::atomic<uint64_t> written{0};
  /**
   * The first frame of this listening. The ring keeps whatever played before
   * the panel was last closed, and a long window opened onto it would draw a
   * third of a second of a song that ended minutes ago.
   */
  std::atomic<uint64_t> valid_from{0};
  /** Reader side only: where the last short and long windows ended. */
  uint64_t short_read = 0;
  uint64_t long_read = 0;
  std::vector<double> short_window;
  std::vector<double> long_window;
  std::vector<double> real;
  std::vector<double> imaginary;
  std::vector<double> magnitudes;
};

/** One block in. AUDIO thread: no allocation, no lock, no transform. */
void eq_live_capture(EqLiveWindow& live,
                     const float* left,
                     const float* right,
                     uint32_t frames);

/** The panel opened: what is in the ring from before reads as silence. */
void eq_live_restart(EqLiveWindow& live);

/**
 * The short window ending now, in dB, into `out_db` (`FEQ_METER_BINS`), once
 * audio has arrived since the last — at most 240 times a second. CONTROL
 * thread. Returns 0 when there is nothing new, or the copy was overtaken.
 */
int eq_live_read_short(EqLiveWindow& live, double sample_rate, float* out_db);

/**
 * The long window ending now, its lowest `FEQ_METER_DETAIL_BINS` bins in dB,
 * once a fortieth of a second has arrived since the last. CONTROL thread.
 */
int eq_live_read_long(EqLiveWindow& live, double sample_rate, float* out_db);

#endif /* FLUIDEQ_METERS_EQ_LIVE_H */
