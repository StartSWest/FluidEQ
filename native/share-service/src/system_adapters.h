/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * This computer's adapters and name as Node reports them —
 * `os.networkInterfaces()` and `os.hostname()` — so the addresses a code
 * names and the broadcasts discovery uses are chosen from the same list
 * the TypeScript chose them from.
 */

#include <string>
#include <vector>

#include "fluideq/share/addresses.h"

namespace feq::share::service {

/**
 * Every IPv4 address of every adapter that is up, as libuv lists them
 * (`uv_interface_addresses`): the adapter's friendly name, the netmask
 * from its prefix length, loopback marked internal; grouped by adapter in
 * the order Windows gives them, as Node's object keeps its keys.
 */
std::vector<share::addresses::AdapterAddress> system_adapters();

/** `os.hostname()`. */
std::string host_name();

}  // namespace feq::share::service
