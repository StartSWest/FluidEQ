/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Locking, unlocking, and the audio thread.
 *
 * Split from `apo.cpp` because the rules on this side are different in kind,
 * not in degree. `LockForProcess` is where every allocation this effect will
 * ever make happens — the deinterleave scratch, the graph, the watcher
 * thread — precisely so that `APOProcess` can be arithmetic over memory that
 * already exists.
 *
 * `APOProcess` runs on a thread audiodg.exe has raised above almost
 * everything else on the machine and given a few milliseconds to answer. It
 * does not allocate, free, lock, log, call into the operating system or
 * throw. Every one of those would be heard: not as a message, as a gap in the
 * user's music.
 */

#include "apo.h"

#include <cstring>
#include <memory>
#include <new>
#include <string>

#include "log.h"
#include "paths.h"

namespace fluideq_engine {

STDMETHODIMP Apo::LockForProcess(UINT32 input_count,
                                 APO_CONNECTION_DESCRIPTOR** inputs,
                                 UINT32 output_count,
                                 APO_CONNECTION_DESCRIPTOR** outputs) {
  if (locked_) {
    return APOERR_APO_LOCKED;
  }
  // Every refusal below is logged: a refused lock is an output Windows
  // quietly plays unprocessed, and the format it offered is the only clue.
  if (input_count != 1 || output_count != 1) {
    trace_built(endpoint_.guid, [&] {
      return "lock refused: " + std::to_string(input_count) + " inputs and " +
             std::to_string(output_count) +
             " outputs; this effect takes one of each";
    });
    return APOERR_NUM_CONNECTIONS_INVALID;
  }
  if (inputs == nullptr || outputs == nullptr || inputs[0] == nullptr ||
      outputs[0] == nullptr) {
    trace(endpoint_.guid, "lock refused: a connection was missing");
    return E_POINTER;
  }
  const APO_CONNECTION_DESCRIPTOR& in = *inputs[0];
  const APO_CONNECTION_DESCRIPTOR& out = *outputs[0];
  if (in.pFormat == nullptr || out.pFormat == nullptr) {
    trace(endpoint_.guid, "lock refused: a connection carried no format");
    return APOERR_INVALID_CONNECTION_FORMAT;
  }

  const ConnectionFormat input_format =
      describe_format(in.pFormat->GetAudioFormat());
  const ConnectionFormat output_format =
      describe_format(out.pFormat->GetAudioFormat());
  const auto describe = [](const ConnectionFormat& format) {
    return std::to_string(format.channels) + " ch " +
           std::to_string(format.rate) + " Hz" +
           (format.acceptable ? "" : " (not float32, or too many channels)");
  };
  if (!input_format.acceptable || !output_format.acceptable) {
    trace_built(endpoint_.guid, [&] {
      return "lock refused: format in " + describe(input_format) + ", out " +
             describe(output_format);
    });
    return APOERR_FORMAT_NOT_SUPPORTED;
  }
  // The registration flags told the audio engine these must agree; checking
  // rather than trusting, because the cost of being wrong is reading one
  // channel count and writing another.
  if (input_format.channels != output_format.channels ||
      input_format.rate != output_format.rate) {
    trace_built(endpoint_.guid, [&] {
      return "lock refused: in " + describe(input_format) +
             " does not match out " + describe(output_format);
    });
    return APOERR_FORMAT_NOT_SUPPORTED;
  }
  if (in.u32MaxFrameCount == 0) {
    trace(endpoint_.guid, "lock refused: zero-frame input connection");
    return APOERR_INVALID_CONNECTION_FORMAT;
  }
  if (out.u32MaxFrameCount < in.u32MaxFrameCount) {
    trace_built(endpoint_.guid, [&] {
      return "lock refused: output holds " +
             std::to_string(out.u32MaxFrameCount) + " frames, input up to " +
             std::to_string(in.u32MaxFrameCount);
    });
    return APOERR_INVALID_OUTPUT_MAXFRAMECOUNT;
  }
  if (in.pBuffer == 0 || out.pBuffer == 0) {
    trace(endpoint_.guid, "lock refused: a connection had no buffer");
    return E_POINTER;
  }

  try {
    channels_ = input_format.channels;
    sample_rate_.store(input_format.rate, std::memory_order_relaxed);
    max_frames_ = in.u32MaxFrameCount;

    // One planar buffer per channel, carved out of a single allocation: the
    // graph works on separated channels and the connection carries them
    // interleaved, and this is the only place the conversion can be paid for.
    scratch_.assign(static_cast<size_t>(channels_) * max_frames_, 0.0f);
    planes_.resize(channels_);
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      planes_[channel] = scratch_.data() + static_cast<size_t>(channel) *
                                               max_frames_;
    }

    log_ = std::make_unique<Log>(endpoint_.guid);
    watcher_ = std::make_unique<Watcher>(
        slot_, *log_, endpoint_, config_dir(),
        sample_rate_.load(std::memory_order_relaxed), channels_, max_frames_);
  } catch (const std::bad_alloc&) {
    release_locked_state();
    return E_OUTOFMEMORY;
  } catch (...) {
    release_locked_state();
    return E_FAIL;
  }

  // From here on nothing may refuse the lock. Everything below is the effect
  // finding out what to apply, and an endpoint that gets no answer plays
  // unprocessed audio — which is the right outcome. Failing the lock instead
  // would leave Windows with an output it cannot open at all.
  try {
    log_->write("locked: " + std::to_string(channels_) + " ch, " +
                std::to_string(sample_rate_.load(std::memory_order_relaxed)) +
                " Hz, up to " +
                std::to_string(max_frames_) + " frames, device \"" +
                to_utf8(endpoint_.friendly_name) + "\"");
    if (!is_default_processing_mode()) {
      // Not a failure: Windows creates one instance per signal-processing
      // mode and this is one of the others. It still processes, but a user
      // who reports "the EQ stops working on calls" needs this line to know
      // the call is on a different instance of the same effect.
      log_->write("this instance is not the default signal-processing mode");
    }
    // Synchronously, before any audio flows: starting unprocessed and
    // switching to processed a moment later is heard as the volume changing
    // by itself every time an output is selected.
    watcher_->load_initial();
    // A watcher that could not start is not a reason to refuse the endpoint —
    // the audio still runs, with whatever the configuration said at this
    // moment, and the log carries the reason it will not follow changes.
    watcher_->start();
  } catch (...) {
    // Pass-through, with no graph published. Nothing here is recoverable and
    // nothing here is worth an endpoint for.
  }

  locked_ = true;
  return S_OK;
}

STDMETHODIMP Apo::UnlockForProcess() {
  if (!locked_) {
    return APOERR_ALREADY_UNLOCKED;
  }
  release_locked_state();
  return S_OK;
}

void Apo::release_locked_state() noexcept {
  // Order is the whole point: the watcher is stopped and joined first, so by
  // the time anything is freed there is no thread left that could publish a
  // graph into a slot that is about to go away.
  if (watcher_) {
    watcher_->stop();
    watcher_.reset();
  }
  slot_.clear();
  slot_.set_latency(0);
  log_.reset();
  // Swapped with an empty vector rather than cleared and shrunk: this
  // function is `noexcept` and runs inside audiodg.exe, where an exception
  // escaping is a terminate() that takes the machine's audio with it —
  // and `shrink_to_fit` is allowed to throw.
  std::vector<float*>().swap(planes_);
  std::vector<float>().swap(scratch_);
  channels_ = 0;
  sample_rate_.store(0, std::memory_order_relaxed);
  max_frames_ = 0;
  locked_ = false;
}

STDMETHODIMP_(void)
Apo::APOProcess(UINT32 input_count, APO_CONNECTION_PROPERTY** inputs,
                UINT32 output_count, APO_CONNECTION_PROPERTY** outputs) {
  if (input_count != 1 || output_count != 1 || inputs == nullptr ||
      outputs == nullptr || inputs[0] == nullptr || outputs[0] == nullptr) {
    return;
  }
  const APO_CONNECTION_PROPERTY& in = *inputs[0];
  APO_CONNECTION_PROPERTY& out = *outputs[0];

  // The swap, at the block boundary and nowhere else: a graph exchanged
  // mid-block would filter the first half of a buffer with one set of
  // coefficients and the second half with another, which is a click.
  Graph* const graph = slot_.adopt();

  const uint32_t frames = in.u32ValidFrameCount;
  // Silence flags bypass the graph. Report that boundary as well, otherwise
  // the DSP page freezes on the last music window when Windows sends silence.
  if (graph != nullptr) {
    graph->report_meter_activity(in.u32BufferFlags == BUFFER_VALID &&
        frames > 0 && frames <= max_frames_ && in.pBuffer != 0 &&
        out.pBuffer != 0 && !graph->is_passthrough());
  }
  if (frames > max_frames_ || in.pBuffer == 0 || out.pBuffer == 0) {
    // Refused rather than clamped. A short block is a gap the user hears
    // once; a block written past the end of somebody else's buffer is a
    // crash in the process that owns every speaker on the machine.
    out.u32ValidFrameCount = 0;
    out.u32BufferFlags = BUFFER_SILENT;
  } else if (in.u32BufferFlags != BUFFER_VALID) {
    if (graph != nullptr && in.u32BufferFlags == BUFFER_SILENT) {
      graph->report_input_silence(frames);
    }
    // Silence in, silence out, and no work: the flag means the buffer's
    // contents are not to be read at all, whatever bytes happen to be there.
    out.u32ValidFrameCount = frames;
    out.u32BufferFlags = in.u32BufferFlags;
  } else {
    const auto* input = reinterpret_cast<const float*>(in.pBuffer);
    auto* output = reinterpret_cast<float*>(out.pBuffer);
    const bool bypass = graph == nullptr || graph->is_passthrough();

    if (bypass) {
      // The pointers this block was actually handed, not what the connection
      // descriptor said at lock time: an in-place APO is normally given one
      // buffer, but a host that hands it two on some block and one on the
      // next would otherwise get the previous block's audio.
      if (input != output) {
        std::memcpy(output, input,
                    sizeof(float) * static_cast<size_t>(channels_) * frames);
      }
    } else {
      const uint32_t channels = channels_;
      float* const* planes = planes_.data();
      for (uint32_t channel = 0; channel < channels; ++channel) {
        float* plane = planes[channel];
        const float* from = input + channel;
        for (uint32_t frame = 0; frame < frames; ++frame) {
          plane[frame] = from[static_cast<size_t>(frame) * channels];
        }
      }
      graph->process(planes, frames);
      for (uint32_t channel = 0; channel < channels; ++channel) {
        const float* plane = planes[channel];
        float* to = output + channel;
        for (uint32_t frame = 0; frame < frames; ++frame) {
          to[static_cast<size_t>(frame) * channels] = plane[frame];
        }
      }
    }
    out.u32ValidFrameCount = frames;
    out.u32BufferFlags = BUFFER_VALID;
  }

  // Always, on every path that reached the swap: this counter is the only
  // evidence the watcher has that a block which might have been holding an
  // older graph has finished with it, and a path that skipped it would stall
  // reclamation for as long as that path kept being taken.
  slot_.finish_block();
}

}  // namespace fluideq_engine
