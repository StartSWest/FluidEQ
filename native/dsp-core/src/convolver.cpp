/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/convolver.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <new>
#include <utility>
#include <vector>

namespace {

constexpr uint32_t kPartition = 512;
constexpr uint32_t kFftSize = kPartition * 2;

/**
 * How much of a change's energy its dropped partitions may hold between them.
 *
 * -140 dB: below what a float sample can carry, so what is dropped cannot
 * be heard or measured in the output, and a narrow band's change comes down
 * from the kernel's 32 partitions to the handful around its centre.
 */
constexpr double kChangeTailEnergy = 1e-14;

/** A change's kept partitions, and where they sit in the main kernel. */
struct FeqConvolverChange {
  /** The main kernel's partition index of the first kept one. */
  uint32_t first = 0;
  std::vector<std::vector<double>> real;
  std::vector<std::vector<double>> imaginary;
};

/** One change's output, laid out exactly as the main output is. */
struct FeqConvolverChangeState {
  std::vector<double> overlap;
  std::vector<double> ready;
};

}  // namespace

struct FeqConvolverKernel {
  /** One spectrum per partition, each `kFftSize` long. */
  std::vector<std::vector<double>> real;
  std::vector<std::vector<double>> imaginary;
  /** `feq_convolver_kernel_add_change`, in the order they were added. */
  std::vector<FeqConvolverChange> changes;
};

struct FeqConvolver {
  const FeqConvolverKernel* kernel = nullptr;
  FeqConvolverKernel transition_kernel;
  std::vector<double> transition_overlap;
  std::vector<double> transition_output;
  uint32_t transition_remaining = 0;
  uint32_t transition_total = 1;
  /** The last `partitions` input spectra, newest at `cursor`. */
  std::vector<std::vector<double>> history_real;
  std::vector<std::vector<double>> history_imaginary;
  int64_t cursor = 0;
  /** Input accumulator: a transform happens when this fills. */
  std::vector<double> pending;
  uint32_t filled = 0;
  /** The tail of the last transform, added into the next block's head. */
  std::vector<double> overlap;
  /** Output waiting to be drained, as a ring. */
  std::vector<double> ready;
  uint32_t read = 0;
  uint32_t write = 0;
  /** Transform scratch, so no block allocates. */
  std::vector<double> work_real;
  std::vector<double> work_imaginary;
  std::vector<double> accumulator_real;
  std::vector<double> accumulator_imaginary;
  /** One per change on the kernel, written at the same ring positions. */
  std::vector<FeqConvolverChangeState> changes;
};

extern "C" {

uint32_t feq_convolver_latency(void) { return kPartition; }
uint32_t feq_convolver_warmup(void) { return kPartition; }

uint32_t feq_convolver_head_taps(void) { return kPartition; }

void feq_convolver_head_prepare(const float* kernel, uint32_t length,
                                float* head) {
  if (head == nullptr) {
    return;
  }
  // Reversed, so the run below is one forward dot product per sample over
  // two contiguous arrays; a kernel shorter than a partition is padded.
  for (uint32_t at = 0; at < kPartition; ++at) {
    const uint32_t tap = kPartition - 1u - at;
    head[at] = kernel != nullptr && tap < length ? kernel[tap] : 0.0f;
  }
}

void feq_convolver_head_run(const float* head, const float* input, float* out,
                            uint32_t frames) {
  if (head == nullptr || input == nullptr || out == nullptr) {
    return;
  }
  static_assert(kPartition % 8u == 0u, "the head runs eight lanes at a time");
  for (uint32_t at = 0; at < frames; ++at) {
    const float* x = input + at;
    // Eight independent sums rather than one: under /fp:precise the compiler
    // may not reorder a single running sum, and one chain of 512 dependent
    // adds is the slowest way to spend a multiply per tap.
    float lane[8] = {};
    for (uint32_t tap = 0; tap < kPartition; tap += 8u) {
      for (uint32_t one = 0; one < 8u; ++one) {
        lane[one] += head[tap + one] * x[tap + one];
      }
    }
    out[at] = ((lane[0] + lane[1]) + (lane[2] + lane[3])) +
              ((lane[4] + lane[5]) + (lane[6] + lane[7]));
  }
}

uint64_t feq_convolver_kernel_warmup(const FeqConvolverKernel* kernel) {
  return kernel == nullptr ? 0 :
      (static_cast<uint64_t>(kernel->real.size()) + 1) * kPartition;
}

FeqConvolverKernel* feq_convolver_kernel_create(const float* kernel,
                                                uint32_t length) {
  if (kernel == nullptr || length == 0) {
    return nullptr;
  }
  auto* out = new (std::nothrow) FeqConvolverKernel();
  if (out == nullptr) {
    return nullptr;
  }
  const uint32_t partitions = (length + kPartition - 1) / kPartition;
  out->real.resize(partitions);
  out->imaginary.resize(partitions);
  for (uint32_t index = 0; index < partitions; ++index) {
    out->real[index].assign(kFftSize, 0.0);
    out->imaginary[index].assign(kFftSize, 0.0);
    const uint32_t from = index * kPartition;
    const uint32_t count =
        kPartition < length - from ? kPartition : length - from;
    for (uint32_t at = 0; at < count; ++at) {
      out->real[index][at] = static_cast<double>(kernel[from + at]);
    }
    feq_fft_in_place(out->real[index].data(), out->imaginary[index].data(),
                     kFftSize, 0);
  }
  return out;
}

int feq_convolver_kernel_add_change(FeqConvolverKernel* kernel,
                                    const float* taps,
                                    uint32_t length) {
  if (kernel == nullptr || taps == nullptr) {
    return -1;
  }
  const auto partitions = static_cast<uint32_t>(kernel->real.size());
  // Laid out like the main kernel and never past it: a kept partition is
  // matched to the main kernel's input spectra by index, and the history
  // holds only as many of those as the main kernel has partitions.
  if (length == 0 || length > partitions * kPartition) {
    return -1;
  }
  const uint32_t used = (length + kPartition - 1) / kPartition;
  std::vector<double> energy(used, 0.0);
  double total = 0.0;
  for (uint32_t at = 0; at < length; ++at) {
    const double tap = static_cast<double>(taps[at]);
    energy[at / kPartition] += tap * tap;
    total += tap * tap;
  }
  // Half the allowance from each end, so a change symmetric about the centre
  // keeps a range symmetric about it too.
  const double allowance = total * kChangeTailEnergy * 0.5;
  uint32_t first = 0;
  double dropped = 0.0;
  while (first < used && dropped + energy[first] <= allowance) {
    dropped += energy[first];
    ++first;
  }
  uint32_t last = used;
  dropped = 0.0;
  while (last > first && dropped + energy[last - 1] <= allowance) {
    dropped += energy[last - 1];
    --last;
  }

  FeqConvolverChange change;
  change.first = first;
  // A change with nothing in it keeps no partitions and renders silence, but
  // it still exists: the caller holds its index and will read it back.
  change.real.resize(last - first);
  change.imaginary.resize(last - first);
  for (uint32_t index = first; index < last; ++index) {
    std::vector<double>& real = change.real[index - first];
    std::vector<double>& imaginary = change.imaginary[index - first];
    real.assign(kFftSize, 0.0);
    imaginary.assign(kFftSize, 0.0);
    const uint32_t from = index * kPartition;
    const uint32_t count =
        kPartition < length - from ? kPartition : length - from;
    for (uint32_t at = 0; at < count; ++at) {
      real[at] = static_cast<double>(taps[from + at]);
    }
    feq_fft_in_place(real.data(), imaginary.data(), kFftSize, 0);
  }
  kernel->changes.push_back(std::move(change));
  return static_cast<int>(kernel->changes.size() - 1);
}

void feq_convolver_kernel_destroy(FeqConvolverKernel* kernel) {
  delete kernel;
}

FeqConvolver* feq_convolver_create(const FeqConvolverKernel* kernel) {
  if (kernel == nullptr || kernel->real.empty()) {
    return nullptr;
  }
  auto* state = new (std::nothrow) FeqConvolver();
  if (state == nullptr) {
    return nullptr;
  }
  const size_t partitions = kernel->real.size();
  state->kernel = kernel;
  state->history_real.assign(partitions, std::vector<double>(kFftSize, 0.0));
  state->history_imaginary.assign(partitions,
                                  std::vector<double>(kFftSize, 0.0));
  state->transition_kernel.real = state->history_real;
  state->transition_kernel.imaginary = state->history_imaginary;
  state->transition_overlap.assign(kPartition, 0.0);
  state->transition_output.assign(kFftSize, 0.0);
  state->pending.assign(kPartition, 0.0);
  state->overlap.assign(kPartition, 0.0);
  // Two partitions plus a block, so a drain can never outrun a fill even when
  // the host hands over an unusual quantum.
  state->ready.assign(kPartition * 3, 0.0);
  state->work_real.assign(kFftSize, 0.0);
  state->work_imaginary.assign(kFftSize, 0.0);
  state->accumulator_real.assign(kFftSize, 0.0);
  state->accumulator_imaginary.assign(kFftSize, 0.0);
  state->changes.resize(kernel->changes.size());
  for (FeqConvolverChangeState& change : state->changes) {
    change.overlap.assign(kPartition, 0.0);
    change.ready.assign(state->ready.size(), 0.0);
  }
  state->read = 0;
  // Primed with a partition of silence. That priming IS the buffering delay:
  // without it the first blocks would read samples that have not been computed
  // yet, and there is nothing sensible to hand back at that point.
  state->write = kPartition;
  return state;
}

void feq_convolver_destroy(FeqConvolver* state) { delete state; }

void feq_convolver_reset(FeqConvolver* state) {
  if (state == nullptr) return;
  for (auto& block : state->history_real) std::fill(block.begin(), block.end(), 0.0);
  for (auto& block : state->history_imaginary) std::fill(block.begin(), block.end(), 0.0);
  for (auto* buffer : {&state->pending, &state->overlap, &state->ready,
                       &state->transition_overlap, &state->transition_output}) {
    std::fill(buffer->begin(), buffer->end(), 0.0);
  }
  for (FeqConvolverChangeState& change : state->changes) {
    std::fill(change.overlap.begin(), change.overlap.end(), 0.0);
    std::fill(change.ready.begin(), change.ready.end(), 0.0);
  }
  state->cursor = 0;
  state->filled = 0;
  state->read = 0;
  state->write = kPartition;
}

}  // extern "C"

namespace {

void render_history(FeqConvolver* state, const FeqConvolverKernel* kernel) {
  const size_t partitions = kernel->real.size();
  std::fill(state->accumulator_real.begin(), state->accumulator_real.end(), 0.0);
  std::fill(state->accumulator_imaginary.begin(), state->accumulator_imaginary.end(), 0.0);
  for (size_t index = 0; index < partitions; ++index) {
    const size_t at = static_cast<size_t>((state->cursor - static_cast<int64_t>(index) +
        static_cast<int64_t>(partitions) * 2) % static_cast<int64_t>(partitions));
    for (uint32_t bin = 0; bin < kFftSize; ++bin) {
      const double real = state->history_real[at][bin];
      const double imaginary = state->history_imaginary[at][bin];
      state->accumulator_real[bin] += real * kernel->real[index][bin] - imaginary * kernel->imaginary[index][bin];
      state->accumulator_imaginary[bin] += real * kernel->imaginary[index][bin] + imaginary * kernel->real[index][bin];
    }
  }
  feq_fft_in_place(state->accumulator_real.data(), state->accumulator_imaginary.data(), kFftSize, 1);
}

/** `render_history` over one change's kept partitions, at their real indices. */
void render_change(FeqConvolver* state, const FeqConvolverChange& change) {
  const auto partitions = static_cast<int64_t>(state->kernel->real.size());
  std::fill(state->accumulator_real.begin(), state->accumulator_real.end(), 0.0);
  std::fill(state->accumulator_imaginary.begin(), state->accumulator_imaginary.end(), 0.0);
  for (size_t kept = 0; kept < change.real.size(); ++kept) {
    const int64_t index = static_cast<int64_t>(change.first + kept);
    const auto at = static_cast<size_t>((state->cursor - index + partitions * 2) % partitions);
    const double* kernel_real = change.real[kept].data();
    const double* kernel_imaginary = change.imaginary[kept].data();
    for (uint32_t bin = 0; bin < kFftSize; ++bin) {
      const double real = state->history_real[at][bin];
      const double imaginary = state->history_imaginary[at][bin];
      state->accumulator_real[bin] += real * kernel_real[bin] - imaginary * kernel_imaginary[bin];
      state->accumulator_imaginary[bin] += real * kernel_imaginary[bin] + imaginary * kernel_real[bin];
    }
  }
  feq_fft_in_place(state->accumulator_real.data(), state->accumulator_imaginary.data(), kFftSize, 1);
}

void flush(FeqConvolver* state) {
  const size_t partitions = state->kernel->real.size();
  double* work_real = state->work_real.data();
  double* work_imaginary = state->work_imaginary.data();

  std::memcpy(work_real, state->pending.data(), kPartition * sizeof(double));
  std::memset(work_real + kPartition, 0, kPartition * sizeof(double));
  std::memset(work_imaginary, 0, kFftSize * sizeof(double));
  feq_fft_in_place(work_real, work_imaginary, kFftSize, 0);

  state->cursor = (state->cursor + 1) % static_cast<int64_t>(partitions);
  std::memcpy(state->history_real[static_cast<size_t>(state->cursor)].data(),
              work_real, kFftSize * sizeof(double));
  std::memcpy(
      state->history_imaginary[static_cast<size_t>(state->cursor)].data(),
      work_imaginary, kFftSize * sizeof(double));

  const bool transitioning = state->transition_remaining > 0;
  if (transitioning) {
    render_history(state, &state->transition_kernel);
    std::copy(state->accumulator_real.begin(), state->accumulator_real.end(), state->transition_output.begin());
  }
  render_history(state, state->kernel);
  double* accumulator_real = state->accumulator_real.data();

  const auto ready_size = static_cast<uint32_t>(state->ready.size());
  // Where this partition of output lands, which is where every change's lands.
  const uint32_t start = state->write;
  for (uint32_t at = 0; at < kPartition; ++at) {
    double output = accumulator_real[at] / kFftSize + state->overlap[at];
    if (transitioning) {
      const double previous = state->transition_output[at] / kFftSize + state->transition_overlap[at];
      const double blend = 1.0 - static_cast<double>(state->transition_remaining) / state->transition_total;
      output = previous + (output - previous) * blend;
      if (state->transition_remaining > 0) --state->transition_remaining;
      state->transition_overlap[at] = state->transition_output[kPartition + at] / kFftSize;
    }
    state->ready[state->write] = output;
    state->write = (state->write + 1) % ready_size;
    state->overlap[at] = accumulator_real[kPartition + at] / kFftSize;
  }
  // After the main output, whose accumulator the loop above has finished with.
  // No transition here: a convolver carrying changes is never handed one
  // (`feq_convolver_transfer` refuses it), and a change follows its kernel.
  for (size_t index = 0; index < state->changes.size(); ++index) {
    FeqConvolverChangeState& change = state->changes[index];
    render_change(state, state->kernel->changes[index]);
    uint32_t write = start;
    for (uint32_t at = 0; at < kPartition; ++at) {
      change.ready[write] = accumulator_real[at] / kFftSize + change.overlap[at];
      write = (write + 1) % ready_size;
      change.overlap[at] = accumulator_real[kPartition + at] / kFftSize;
    }
  }
  state->filled = 0;
}

}  // namespace

extern "C" {

int feq_convolver_transfer(FeqConvolver* state, const FeqConvolver* previous,
                           uint32_t transition_frames) {
  if (state == nullptr || previous == nullptr || state == previous ||
      state->kernel->real.size() != previous->kernel->real.size() ||
      !state->changes.empty() || !previous->changes.empty()) return 0;
  const double blend = 1.0 - static_cast<double>(previous->transition_remaining) / previous->transition_total;
  for (size_t index = 0; index < state->kernel->real.size(); ++index) {
    std::copy(previous->history_real[index].begin(), previous->history_real[index].end(), state->history_real[index].begin());
    std::copy(previous->history_imaginary[index].begin(), previous->history_imaginary[index].end(), state->history_imaginary[index].begin());
    for (uint32_t bin = 0; bin < kFftSize; ++bin) {
      const double real = previous->kernel->real[index][bin];
      const double imaginary = previous->kernel->imaginary[index][bin];
      state->transition_kernel.real[index][bin] = previous->transition_remaining == 0 ? real :
          previous->transition_kernel.real[index][bin] + blend * (real - previous->transition_kernel.real[index][bin]);
      state->transition_kernel.imaginary[index][bin] = previous->transition_remaining == 0 ? imaginary :
          previous->transition_kernel.imaginary[index][bin] + blend * (imaginary - previous->transition_kernel.imaginary[index][bin]);
    }
  }
  state->cursor = previous->cursor;
  state->filled = previous->filled;
  state->read = previous->read;
  state->write = previous->write;
  std::copy(previous->pending.begin(), previous->pending.end(), state->pending.begin());
  std::copy(previous->ready.begin(), previous->ready.end(), state->ready.begin());
  render_history(state, state->kernel);
  for (uint32_t at = 0; at < kPartition; ++at)
    state->overlap[at] = state->accumulator_real[kPartition + at] / kFftSize;
  render_history(state, &state->transition_kernel);
  for (uint32_t at = 0; at < kPartition; ++at)
    state->transition_overlap[at] = state->accumulator_real[kPartition + at] / kFftSize;
  state->transition_total = std::max(1u, transition_frames);
  state->transition_remaining = state->transition_total;
  return 1;
}

void feq_convolve(FeqConvolver* state, float* buffer, uint32_t frames) {
  if (state == nullptr || buffer == nullptr) {
    return;
  }
  const auto ready_size = static_cast<uint32_t>(state->ready.size());
  for (uint32_t at = 0; at < frames; ++at) {
    state->pending[state->filled] = static_cast<double>(buffer[at]);
    state->filled += 1;
    if (state->filled == kPartition) {
      flush(state);
    }
    buffer[at] = static_cast<float>(state->ready[state->read]);
    state->read = (state->read + 1) % ready_size;
  }
}

double feq_convolve_blend(FeqConvolver* active,
                          FeqConvolver* next,
                          float* buffer,
                          float* scratch,
                          uint32_t frames,
                          double blend,
                          double step,
                          float* difference) {
  if (active == nullptr || next == nullptr || buffer == nullptr ||
      scratch == nullptr) {
    return blend;
  }
  for (uint32_t at = 0; at < frames; ++at) {
    scratch[at] = buffer[at];
  }
  feq_convolve(active, buffer, frames);
  feq_convolve(next, scratch, frames);

  double mix = blend;
  for (uint32_t at = 0; at < frames; ++at) {
    mix = mix + step < 1.0 ? mix + step : 1.0;
    const double apart =
        static_cast<double>(scratch[at]) - static_cast<double>(buffer[at]);
    if (difference != nullptr) {
      difference[at] = static_cast<float>(apart);
    }
    buffer[at] =
        static_cast<float>(static_cast<double>(buffer[at]) + apart * mix);
  }
  return mix;
}

void feq_convolver_read_change(const FeqConvolver* state,
                               uint32_t change,
                               float* out,
                               uint32_t frames) {
  if (out == nullptr) {
    return;
  }
  if (state == nullptr || change >= state->changes.size() ||
      frames > kPartition) {
    std::fill(out, out + frames, 0.0f);
    return;
  }
  // The read head sits one past the last sample handed back, and the write
  // head is never more than a partition ahead of it, so the partition behind
  // the read head is always intact — whatever block sizes led here.
  const std::vector<double>& ready = state->changes[change].ready;
  const auto ready_size = static_cast<uint32_t>(ready.size());
  uint32_t at = (state->read + ready_size - frames) % ready_size;
  for (uint32_t index = 0; index < frames; ++index) {
    out[index] = static_cast<float>(ready[at]);
    at = (at + 1) % ready_size;
  }
}

}  // extern "C"
