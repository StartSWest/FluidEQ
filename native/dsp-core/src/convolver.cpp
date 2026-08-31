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
  /*
   * A POWER OF TWO, and this guard is not a formality.
   *
   * Radix-2 decimation in time assumes it. Handed 960 — the window DPDFNet
   * needs at 48 kHz — the butterfly stage at length 512 starts a block at 512,
   * runs k up to 255 and reads `real[512 + 255 + 256]`: index 1023 of a
   * 960-element buffer. Sixty-four doubles past the end, on every call.
   *
   * It does not fail where it happens. It smashes the header of whatever the
   * allocator placed next, so the process dies later inside an unrelated
   * allocation or hangs in the heap manager. The voice module presented as
   * "the model does nothing" and cost a night spent looking at ONNX Runtime,
   * which it never reached.
   *
   * Refusing would be the wrong answer for a caller that genuinely needs an
   * arbitrary size — `FeqDft` below builds one out of this. It is the right
   * answer here, because the only other option this function has is silent
   * corruption.
   */
  if (real == nullptr || imaginary == nullptr || size == 0 ||
      (size & (size - 1)) != 0) {
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

/**
 * Bluestein's algorithm: a transform of any size, out of the one above.
 *
 * Writing nk as (n^2 + k^2 - (k-n)^2)/2 turns the DFT kernel into two chirps
 * around a convolution:
 *
 *   X[k] = w[k] * SUM_n (x[n] w[n]) * conj(w[k-n]),   w[n] = exp(-i*pi*n^2/N)
 *
 * and that sum is a circular convolution of length M, the first power of two
 * at or above 2N-1 — which the radix-2 transform can do. For the 960 points
 * DPDFNet needs, M is 2048 and a call costs two of them.
 */
struct FeqDft {
  uint32_t n = 0;
  uint32_t m = 0;
  std::vector<double> chirp_real;
  std::vector<double> chirp_imaginary;
  std::vector<double> kernel_real;
  std::vector<double> kernel_imaginary;
  std::vector<double> work_real;
  std::vector<double> work_imaginary;
};

FeqDft* feq_dft_create(uint32_t size) {
  if (size == 0) {
    return nullptr;
  }
  auto* plan = new (std::nothrow) FeqDft();
  if (plan == nullptr) {
    return nullptr;
  }
  plan->n = size;
  uint32_t m = 1;
  while (m < size * 2 - 1) {
    m *= 2;
  }
  plan->m = m;

  plan->chirp_real.assign(size, 0.0);
  plan->chirp_imaginary.assign(size, 0.0);
  for (uint32_t i = 0; i < size; i += 1) {
    /*
     * The square is reduced modulo 2N before the angle is formed.
     *
     * k^2 at k near a thousand is nearly a million, and only its fractional
     * part against 2N carries any information. Handing the raw value to cos
     * and sin throws away most of the mantissa to argument reduction and the
     * transform loses accuracy exactly at the top of its range.
     */
    const uint64_t squared =
        (static_cast<uint64_t>(i) * static_cast<uint64_t>(i)) %
        (2ull * static_cast<uint64_t>(size));
    const double angle = -3.14159265358979323846 *
                         static_cast<double>(squared) /
                         static_cast<double>(size);
    plan->chirp_real[i] = std::cos(angle);
    plan->chirp_imaginary[i] = std::sin(angle);
  }

  // The kernel is the conjugate chirp, made symmetric about M so that the
  // CIRCULAR convolution of length M reproduces the linear one this needs.
  plan->kernel_real.assign(m, 0.0);
  plan->kernel_imaginary.assign(m, 0.0);
  for (uint32_t i = 0; i < size; i += 1) {
    plan->kernel_real[i] = plan->chirp_real[i];
    plan->kernel_imaginary[i] = -plan->chirp_imaginary[i];
    if (i > 0) {
      plan->kernel_real[m - i] = plan->chirp_real[i];
      plan->kernel_imaginary[m - i] = -plan->chirp_imaginary[i];
    }
  }
  feq_fft_in_place(plan->kernel_real.data(), plan->kernel_imaginary.data(), m,
                   0);

  plan->work_real.assign(m, 0.0);
  plan->work_imaginary.assign(m, 0.0);
  return plan;
}

void feq_dft_destroy(FeqDft* plan) { delete plan; }

void feq_dft_in_place(FeqDft* plan,
                      double* real,
                      double* imaginary,
                      int inverse) {
  if (plan == nullptr || real == nullptr || imaginary == nullptr) {
    return;
  }
  const uint32_t n = plan->n;
  const uint32_t m = plan->m;
  /*
   * The inverse is the forward transform of the conjugate, conjugated, so one
   * code path serves both. Unnormalised either way, matching the radix-2
   * transform: the caller divides by N.
   */
  const double sign = inverse != 0 ? -1.0 : 1.0;

  std::fill(plan->work_real.begin(), plan->work_real.end(), 0.0);
  std::fill(plan->work_imaginary.begin(), plan->work_imaginary.end(), 0.0);
  for (uint32_t i = 0; i < n; i += 1) {
    const double xr = real[i];
    const double xi = sign * imaginary[i];
    plan->work_real[i] =
        xr * plan->chirp_real[i] - xi * plan->chirp_imaginary[i];
    plan->work_imaginary[i] =
        xr * plan->chirp_imaginary[i] + xi * plan->chirp_real[i];
  }

  feq_fft_in_place(plan->work_real.data(), plan->work_imaginary.data(), m, 0);
  for (uint32_t i = 0; i < m; i += 1) {
    const double ar = plan->work_real[i];
    const double ai = plan->work_imaginary[i];
    plan->work_real[i] =
        ar * plan->kernel_real[i] - ai * plan->kernel_imaginary[i];
    plan->work_imaginary[i] =
        ar * plan->kernel_imaginary[i] + ai * plan->kernel_real[i];
  }
  feq_fft_in_place(plan->work_real.data(), plan->work_imaginary.data(), m, 1);

  // That inverse is unnormalised too, so the 1/M belongs here — it is the
  // convolution's own scaling and nothing to do with the caller's 1/N.
  const double scale = 1.0 / static_cast<double>(m);
  for (uint32_t i = 0; i < n; i += 1) {
    const double cr = plan->work_real[i] * scale;
    const double ci = plan->work_imaginary[i] * scale;
    real[i] = cr * plan->chirp_real[i] - ci * plan->chirp_imaginary[i];
    imaginary[i] =
        sign * (cr * plan->chirp_imaginary[i] + ci * plan->chirp_real[i]);
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
