/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/convolver.h"

#include <cmath>
#include <cstring>
#include <new>
#include <vector>

namespace {

constexpr uint32_t kPartition = 512;
constexpr uint32_t kFftSize = kPartition * 2;

}  // namespace

struct FeqConvolverKernel {
  /** One spectrum per partition, each `kFftSize` long. */
  std::vector<std::vector<double>> real;
  std::vector<std::vector<double>> imaginary;
};

struct FeqConvolver {
  const FeqConvolverKernel* kernel = nullptr;
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
};

extern "C" {

void feq_fft_in_place(double* real,
                      double* imaginary,
                      uint32_t size,
                      int inverse) {
  if (real == nullptr || imaginary == nullptr || size == 0) {
    return;
  }
  // Bit-reversal permutation, so the butterflies below can run in place.
  for (uint32_t i = 1, j = 0; i < size; ++i) {
    uint32_t bit = size >> 1;
    for (; (j & bit) != 0; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const double tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const double ti = imaginary[i];
      imaginary[i] = imaginary[j];
      imaginary[j] = ti;
    }
  }
  for (uint32_t length = 2; length <= size; length <<= 1) {
    const double angle =
        ((inverse != 0 ? 2.0 : -2.0) * 3.14159265358979323846) /
        static_cast<double>(length);
    const double step_real = std::cos(angle);
    const double step_imaginary = std::sin(angle);
    const uint32_t half = length / 2;
    for (uint32_t start = 0; start < size; start += length) {
      double twiddle_real = 1.0;
      double twiddle_imaginary = 0.0;
      for (uint32_t k = 0; k < half; ++k) {
        const double top_real = real[start + k];
        const double top_imaginary = imaginary[start + k];
        const double bottom_real = real[start + k + half] * twiddle_real -
                                   imaginary[start + k + half] *
                                       twiddle_imaginary;
        const double bottom_imaginary =
            real[start + k + half] * twiddle_imaginary +
            imaginary[start + k + half] * twiddle_real;
        real[start + k] = top_real + bottom_real;
        imaginary[start + k] = top_imaginary + bottom_imaginary;
        real[start + k + half] = top_real - bottom_real;
        imaginary[start + k + half] = top_imaginary - bottom_imaginary;
        // The twiddle is advanced by repeated multiplication rather than
        // recomputed with a transcendental per bin. The reference does the
        // same, so the accumulated drift is part of what is being matched.
        const double next_real =
            twiddle_real * step_real - twiddle_imaginary * step_imaginary;
        twiddle_imaginary =
            twiddle_real * step_imaginary + twiddle_imaginary * step_real;
        twiddle_real = next_real;
      }
    }
  }
}

uint32_t feq_convolver_latency(void) { return kPartition; }
uint32_t feq_convolver_warmup(void) { return kPartition; }

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
  state->pending.assign(kPartition, 0.0);
  state->overlap.assign(kPartition, 0.0);
  // Two partitions plus a block, so a drain can never outrun a fill even when
  // the host hands over an unusual quantum.
  state->ready.assign(kPartition * 3, 0.0);
  state->work_real.assign(kFftSize, 0.0);
  state->work_imaginary.assign(kFftSize, 0.0);
  state->accumulator_real.assign(kFftSize, 0.0);
  state->accumulator_imaginary.assign(kFftSize, 0.0);
  state->read = 0;
  // Primed with a partition of silence. That priming IS the buffering delay:
  // without it the first blocks would read samples that have not been computed
  // yet, and there is nothing sensible to hand back at that point.
  state->write = kPartition;
  return state;
}

void feq_convolver_destroy(FeqConvolver* state) { delete state; }

}  // extern "C"

namespace {

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

  double* accumulator_real = state->accumulator_real.data();
  double* accumulator_imaginary = state->accumulator_imaginary.data();
  std::memset(accumulator_real, 0, kFftSize * sizeof(double));
  std::memset(accumulator_imaginary, 0, kFftSize * sizeof(double));

  for (size_t index = 0; index < partitions; ++index) {
    // Oldest kernel partition against the oldest input spectrum: walking the
    // ring backwards from the newest is what lines the two up in time.
    const size_t at = static_cast<size_t>(
        (state->cursor - static_cast<int64_t>(index) +
         static_cast<int64_t>(partitions) * 2) %
        static_cast<int64_t>(partitions));
    const double* xr = state->history_real[at].data();
    const double* xi = state->history_imaginary[at].data();
    const double* hr = state->kernel->real[index].data();
    const double* hi = state->kernel->imaginary[index].data();
    for (uint32_t bin = 0; bin < kFftSize; ++bin) {
      accumulator_real[bin] += xr[bin] * hr[bin] - xi[bin] * hi[bin];
      accumulator_imaginary[bin] += xr[bin] * hi[bin] + xi[bin] * hr[bin];
    }
  }

  feq_fft_in_place(accumulator_real, accumulator_imaginary, kFftSize, 1);

  const auto ready_size = static_cast<uint32_t>(state->ready.size());
  for (uint32_t at = 0; at < kPartition; ++at) {
    state->ready[state->write] =
        accumulator_real[at] / kFftSize + state->overlap[at];
    state->write = (state->write + 1) % ready_size;
    state->overlap[at] = accumulator_real[kPartition + at] / kFftSize;
  }
  state->filled = 0;
}

}  // namespace

extern "C" {

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
                          double step) {
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
    const double difference =
        static_cast<double>(scratch[at]) - static_cast<double>(buffer[at]);
    buffer[at] =
        static_cast<float>(static_cast<double>(buffer[at]) + difference * mix);
  }
  return mix;
}

}  // extern "C"
