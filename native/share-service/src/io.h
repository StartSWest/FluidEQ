/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The event loop, its promises, its pipes and child processes, from the
 * helpers' shared library (`native/io`), named in the service's own
 * namespace as everything here was written against them.
 */

#include "fluideq/io/emitter.h"
#include "fluideq/io/loop.h"
#include "fluideq/io/pipes.h"

namespace feq::share::service {
using namespace feq::io;
}  // namespace feq::share::service
