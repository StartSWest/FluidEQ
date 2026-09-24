/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where Auto normalize should put the level for a new EQ, known before the EQ
 * is heard (Ivan, 2026-09-23: "precalculate the preamp when setting a curve or
 * EQ ... jump straight to it and then the auto normalize just finetune").
 *
 * An edit used to take the level down by the most the new curve could ever
 * need — the curve's worst case — and then climb back at about 1 dB/s while
 * the music showed how much of that it really needed: 4 dB down for Bass +6 on
 * every song, then 1.4 to 6.2 dB of climbing over the next ten seconds, and on
 * a quiet passage past where the song needs it, so down again at the next loud
 * one. Here the last seconds of music (`InputHistory`) are replayed through
 * the EQ that is playing and through the new one, and the level moves once, at
 * the handover, by how much louder or quieter the new EQ makes that music's
 * loudest peak. What Auto normalize does after that is untouched.
 *
 * Measured offline on Ivan's five songs through his BlackShark chain, five
 * edits each: how far the level still moved in the ten seconds after an edit,
 * 2.14 dB on average and 6.2 at most the old way, 0.51 this way (the normal
 * give-back); the limiter's deepest cut in the three seconds after, 1.62 dB
 * against 1.82. Ten seconds of music rather than three: three moved 0.68 dB
 * and cut 2.61; twenty did no better than ten.
 *
 * THE CHAIN PLAYING IS JUDGED BY WHAT IT DID, OR REPLAYED. Where it has played
 * through the whole window, the peaks the output guard measured on it are its
 * peaks (`InputHistory::record_peak`), and only the new EQ is replayed: the
 * first edit after a while of listening, which is picking a curve. A drag is
 * many edits inside one window, and there those measured peaks came through
 * the drag's own earlier chains: they would count every earlier step again at
 * each step. So within a drag both chains are replayed — the difference
 * between two replays of the same music is what adds up to the right total
 * however many edits share the window — and the new EQ's replay is kept as
 * the next edit's replay of the chain playing (the shadow), so each step still
 * replays only once. Measured on Ivan's chain, ten seconds: 60 to 90 ms a
 * replay on the watcher thread.
 *
 * REPLAYED IN MINIMUM PHASE, whatever phase the listener chose. A layer in
 * linear phase is a FIR of tens of thousands of taps, and replaying it cost
 * eight times the same bands as biquads; the peaks it is judged by differ by
 * up to 1.8 dB between the two designs, but the same way in both replays, and
 * only their difference is used. Which is also why the measured peaks stand
 * in for a replay only for a chain playing in minimum phase: next to a
 * minimum-phase replay, a linear one's peaks would be that 1.8 dB off.
 */
#ifndef FLUIDEQ_ENGINE_LEVEL_PREDICTION_H
#define FLUIDEQ_ENGINE_LEVEL_PREDICTION_H

#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "fluideq_engine/config.h"
#include "input_history.h"

namespace fluideq_engine {

/** How much music a level is judged on: see the measurements above. */
constexpr double kLevelHistorySeconds = 10.0;

class LevelPredictor {
 public:
  /** For a history of `window_frames` at `rate` (`InputHistory::window_frames`). */
  LevelPredictor(uint32_t rate, uint32_t channels, uint64_t window_frames);
  ~LevelPredictor();
  LevelPredictor(const LevelPredictor&) = delete;
  LevelPredictor& operator=(const LevelPredictor&) = delete;

  struct Prediction {
    /** How far the level moves: negative when the new EQ is louder. */
    double shift_db = 0.0;
    /** How much music it was judged on. */
    double seconds = 0.0;
  };

  /**
   * Watcher thread, with `next` resolved and its graph not yet published.
   *
   * Nothing when there is nothing to go on: Auto normalize off before or
   * after, the EQ unchanged (a rack change, a flush), fewer than a second of
   * music heard through both chains, or silence. The handover then does what
   * it always did. `stop_requested` is asked between the replays, which take
   * tens of milliseconds each, because the thread waiting for this one to
   * stop waits without a limit.
   */
  std::optional<Prediction> predict(const Chain& next,
                                    const InputHistory& history,
                                    const std::function<bool()>& stop_requested);

  /**
   * The chain just published, which the next prediction starts from, when
   * the history had `heard_frames`: from a little after that, the peaks the
   * history measured are this chain's.
   */
  void accept(const Chain& published, uint64_t heard_frames);

 private:
  struct Replay;

  std::unique_ptr<Replay> start(const Chain& probe, std::string signature,
                                uint64_t from) const;
  /** Puts the history up to `to` through `replay`; false on a gap. */
  bool advance(Replay& replay, const InputHistory& history, uint64_t to,
               const std::function<bool()>& stop_requested);
  /** The loudest peak `replay` put out in the whole chunks of `[from, to)`. */
  double peak_over(const Replay& replay, uint64_t from, uint64_t to) const;

  const uint32_t rate_;
  const uint32_t channels_;
  const uint32_t chunk_frames_;
  const size_t ring_chunks_;
  std::optional<Chain> current_;
  std::string current_signature_;
  // The history's frame count when the chain playing sounded as it does now.
  uint64_t current_since_ = 0;
  // The chain playing, replayed as far as the last prediction; and the new
  // chain's replay, which becomes it when that chain is published.
  std::unique_ptr<Replay> shadow_;
  std::unique_ptr<Replay> candidate_;
  // One block of every channel, copied out of the history to be replayed.
  std::vector<std::vector<float>> scratch_;
  std::vector<float*> planes_;
};

/** A chain as the replay runs it: see `LevelPredictor`. */
Chain replay_chain_of(const Chain& chain);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_LEVEL_PREDICTION_H
