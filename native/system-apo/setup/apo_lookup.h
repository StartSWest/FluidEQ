/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The registry and file reads behind `apo_names.h`: every place Windows
 * keeps something about an effect's class id, read and never written, for
 * the status the app asks for unelevated.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_APO_LOOKUP_H
#define FLUIDEQ_ENGINE_SETUP_APO_LOOKUP_H

#include <string>

#include "apo_names.h"

namespace fluideq_engine::setup {

/** `1.0.0.0` from a DLL's fixed version resource, or empty. */
std::wstring dll_version(const std::wstring& path);

/**
 * Everything on record for `clsid`: `HKLM\SOFTWARE\Classes`'
 * `AudioEngine\AudioProcessingObjects` and `CLSID` keys first, then the same
 * two inside whichever audio effects component's driver key registers it,
 * then the DLL's version resource. Gaps stay empty.
 */
ApoSources read_apo_sources(const std::wstring& clsid);

/**
 * `resolve_apo(read_apo_sources(clsid))`, read once per class id for the
 * life of the process: one status names the same effect on every mic.
 */
ApoInfo apo_info(const std::wstring& clsid);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_APO_LOOKUP_H
