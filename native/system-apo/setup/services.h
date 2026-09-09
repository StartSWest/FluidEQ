/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Restarting the audio stack, which is how an effect list edit takes effect.
 *
 * Windows reads an endpoint's effect registration when the endpoint is built,
 * not when a stream starts, so a newly attached effect appears only after the
 * endpoint builder has run again. Signing out or rebooting does it too; this
 * is the version that takes four seconds.
 *
 * Any stream that is open at the time is cut. That is normal and expected —
 * the same thing happens when a driver updates — and the helper does not try
 * to be clever about it.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_SERVICES_H
#define FLUIDEQ_ENGINE_SETUP_SERVICES_H

#include <string>

namespace fluideq_engine::setup {

/**
 * Stops `Audiosrv` then `AudioEndpointBuilder`, and starts them back the
 * other way round.
 *
 * The order is forced by the dependency: `Audiosrv` depends on the builder,
 * so stopping the builder first fails outright rather than doing anything.
 *
 * Every wait is an alertable sleep woken by the service control manager's own
 * notification. There is no polling and no deadline: how long a machine takes
 * to stop its audio service is not something this program can know, and a
 * timeout would only turn a slow machine into a reported failure.
 */
bool restart_audio(std::wstring& error);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_SERVICES_H
