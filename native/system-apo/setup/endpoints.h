/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The outputs the machine currently has, as the audio stack sees them.
 *
 * The registry under `MMDevices\Audio\Render` remembers every endpoint the
 * machine has ever had, including the headset unplugged two years ago. Asking
 * the device enumerator instead is what makes `--attach-all` mean the four
 * outputs that exist rather than the forty that once did.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_ENDPOINTS_H
#define FLUIDEQ_ENGINE_SETUP_ENDPOINTS_H

#include <string>
#include <vector>

namespace fluideq_engine::setup {

struct Endpoint {
  /** `{XXXXXXXX-…}` upper case — the last brace group of the device id. */
  std::wstring guid;
  /** What the user sees in the sound settings, or empty. */
  std::wstring name;
};

/**
 * Every active render endpoint. The caller has already initialised COM.
 *
 * Active only: a disabled or unplugged output has no stream to process, and
 * attaching to one writes a key the user cannot see the effect of.
 */
bool list_render_endpoints(std::vector<Endpoint>& out, std::wstring& error);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_ENDPOINTS_H
