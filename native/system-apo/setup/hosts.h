/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which processes have an audio effect DLL loaded right now.
 *
 * The one question the engine log cannot answer: audiodg.exe and the audio
 * service run as LOCAL SERVICE, so an unelevated look at their modules is
 * refused, and "the effect is attached" and "the effect is loaded" look the
 * same from outside. The first machine had the effect attached to six
 * outputs and loaded into nothing that played audio, and this is how that
 * was told apart from a config that asked for nothing.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_HOSTS_H
#define FLUIDEQ_ENGINE_SETUP_HOSTS_H

#include <string>
#include <vector>

namespace fluideq_engine::setup {

/**
 * One line per loaded module whose file name contains "apo", "fluideq" or
 * "equalizer" (case-insensitive): `process (pid): full module path`.
 * Processes that cannot be opened are skipped, not reported — that is most
 * of them on a machine with protected processes, and none of them host
 * audio effects.
 */
bool list_effect_hosts(std::vector<std::wstring>& lines, std::wstring& error);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_HOSTS_H
