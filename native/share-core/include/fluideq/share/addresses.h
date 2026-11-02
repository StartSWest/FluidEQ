/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <string>
#include <string_view>
#include <vector>

/*
 * Where this computer can be reached on the local network, and where its
 * "who is there?" goes: the C++ twin of `src/main/remoteAudioLanAddresses.ts`.
 * The rules are here and portable; each platform lists its adapters
 * (`list_adapters`, in the host) the way Node's `os.networkInterfaces` does.
 */

namespace feq::share::addresses {

/** One IPv4 address of one adapter, as `os.networkInterfaces` gives it. */
struct AdapterAddress {
  /** The adapter's name: on Windows its friendly name ("Wi-Fi", "vEthernet (WSL)"). */
  std::string name;
  std::string address;
  std::string netmask;
  /** Loopback (`internal`). */
  bool internal = false;
};

struct LanInterface {
  std::string address;
  /** The subnet's own broadcast address, for "who is there?". */
  std::string broadcast;
};

/** Container and VM bridges, VPN tunnels: nowhere another computer reaches. */
bool is_virtual_adapter(std::string_view name);
std::string broadcast_of(std::string_view address, std::string_view netmask);
/** `lanInterfaces`: private, external, real adapters first, best first. */
std::vector<LanInterface> lan_interfaces(const std::vector<AdapterAddress>& adapters);
std::vector<std::string> lan_addresses(const std::vector<AdapterAddress>& adapters);
/** `discoveryTargets`: the all-ones broadcast, then each LAN's own. */
std::vector<std::string> discovery_targets(const std::vector<AdapterAddress>& adapters);

}  // namespace feq::share::addresses
