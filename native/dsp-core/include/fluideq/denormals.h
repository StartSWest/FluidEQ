/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Denormals off for the duration of one audio callback, and restored on the
 * way out.
 *
 * A denormal is not a wrong number, it is a slow one: on x86 the hardware
 * traps into microcode and a multiply that costs one cycle starts costing
 * over a hundred. Filter tails decay straight into that range, so the cost
 * arrives exactly when the music stops. Measured on the FluidEQ Engine's own
 * EQ path with a 21-band headphone chain: three minutes of the digital
 * silence a paused player keeps sending cost a median 613 us of every 10 ms
 * block, with blocks up to 4 ms, against 46 us and 277 us with this in place.
 *
 * Restored on exit because MXCSR is per thread and the thread is not ours:
 * the Library player's callback runs on the host's audio thread, and the
 * engine's runs on audiodg.exe's, which other effects share. Windows'
 * calling convention makes these bits nonvolatile, so an effect may change
 * them for the length of its call but must put them back.
 */
#ifndef FLUIDEQ_DENORMALS_H
#define FLUIDEQ_DENORMALS_H

#ifdef __cplusplus

#if defined(_M_X64) || defined(__x86_64__) || defined(__SSE2__)
#include <xmmintrin.h>
#define FEQ_HAS_SSE_DENORMAL_CONTROL 1
#endif

class FeqScopedDenormalsOff {
 public:
  FeqScopedDenormalsOff() noexcept {
#if FEQ_HAS_SSE_DENORMAL_CONTROL
    previous_ = _mm_getcsr();
    _mm_setcsr(previous_ | 0x8040u); /* FTZ | DAZ */
#endif
  }

  ~FeqScopedDenormalsOff() {
#if FEQ_HAS_SSE_DENORMAL_CONTROL
    _mm_setcsr(previous_);
#endif
  }

  FeqScopedDenormalsOff(const FeqScopedDenormalsOff&) = delete;
  FeqScopedDenormalsOff& operator=(const FeqScopedDenormalsOff&) = delete;

 private:
#if FEQ_HAS_SSE_DENORMAL_CONTROL
  unsigned int previous_ = 0;
#endif
};

#endif /* __cplusplus */

#endif /* FLUIDEQ_DENORMALS_H */
