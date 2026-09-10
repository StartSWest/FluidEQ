/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether a resolved chain is the same one the effect is already running.
 *
 * Its own pair of files because it answers a different question from the
 * watcher that calls it: the watcher's job is to build a graph and hand it
 * over, and this decides whether a graph needs building at all. The
 * directory notification fires for every write anywhere under the
 * configuration directory, so without this the effect would design a FIR and
 * reallocate a convolver every time an editor touched a temporary file.
 */
#ifndef FLUIDEQ_ENGINE_CHAIN_SIGNATURE_H
#define FLUIDEQ_ENGINE_CHAIN_SIGNATURE_H

#include <string>

#include "fluideq_engine/config.h"

namespace fluideq_engine {

/**
 * Everything about a resolved chain that could change what the effect does,
 * as one string to compare against the last one.
 *
 * The impulse response's size and timestamp are part of it because the app
 * rewrites `fluideq-convolution-*.wav` in place: every line of the config
 * stays identical while the audio it asks for changes completely.
 */
std::string signature_of(const Chain& chain);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_CHAIN_SIGNATURE_H
