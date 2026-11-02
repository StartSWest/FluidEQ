/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/share/addresses.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdint>
#include <iterator>

#include "fluideq/share/lan_protocol.h"

namespace feq::share::addresses {
namespace {

std::string lower(std::string_view text) {
  std::string out(text);
  std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) {
    return static_cast<char>(c >= 'A' && c <= 'Z' ? c - 'A' + 'a' : c);
  });
  return out;
}

std::uint64_t to_number(std::string_view address) {
  std::uint64_t total = 0;
  std::uint64_t octet = 0;
  for (const char c : address) {
    if (c == '.') {
      total = total * 256 + octet;
      octet = 0;
    } else {
      octet = octet * 10 + static_cast<std::uint64_t>(c - '0');
    }
  }
  return total * 256 + octet;
}

std::string to_address(std::uint64_t value) {
  std::string out;
  for (const int shift : {24, 16, 8, 0}) {
    if (!out.empty()) {
      out.push_back('.');
    }
    out += std::to_string((value >> shift) % 256);
  }
  return out;
}

/** Home networks first: 192.168, then 10, then 172.16/12, then link-local. */
int rank(std::string_view address) {
  if (address.starts_with("192.168.")) {
    return 0;
  }
  if (address.starts_with("10.")) {
    return 1;
  }
  if (address.starts_with("172.")) {
    return 2;
  }
  return 3;
}

}  // namespace

bool is_virtual_adapter(std::string_view name) {
  const std::string text = lower(name);
  static constexpr std::array<std::string_view, 19> kLeading{
      "docker", "br-",   "veth",  "virbr",  "vnet",    "vmnet",  "vboxnet",
      "lxc",    "lxd",   "cni",   "flannel", "cali",   "podman", "tun",
      "tap",    "wg",    "zt",    "tailscale", "utun"};
  for (const std::string_view prefix : kLeading) {
    if (text.starts_with(prefix)) {
      return true;
    }
  }
  if (text.starts_with("bridge") && text.size() > 6 &&
      std::isdigit(static_cast<unsigned char>(text[6])) != 0) {
    return true;
  }
  static constexpr std::array<std::string_view, 7> kAnywhere{
      "vethernet", "virtualbox", "vmware", "hyper-v",
      "wsl",       "loopback",   "bluetooth"};
  if (std::any_of(kAnywhere.begin(), kAnywhere.end(),
                  [&](std::string_view part) {
                    return text.find(part) != std::string::npos;
                  })) {
    return true;
  }
  return text.find("npcap") != std::string::npos;
}

std::string broadcast_of(std::string_view address, std::string_view netmask) {
  const std::uint64_t host = to_number(address);
  const std::uint64_t mask = to_number(netmask);
  const std::uint64_t span = (std::uint64_t{1} << 32) - mask;
  return to_address(host - (host % span) + (span - 1));
}

std::vector<LanInterface> lan_interfaces(const std::vector<AdapterAddress>& adapters) {
  struct Entry {
    std::string name;
    LanInterface lan;
  };
  std::vector<Entry> all;
  for (const AdapterAddress& adapter : adapters) {
    if (!adapter.internal && lan::is_private_ipv4(adapter.address)) {
      all.push_back({adapter.name,
                     {adapter.address, broadcast_of(adapter.address, adapter.netmask)}});
    }
  }
  std::vector<Entry> real;
  std::copy_if(all.begin(), all.end(), std::back_inserter(real),
               [](const Entry& entry) { return !is_virtual_adapter(entry.name); });
  const std::vector<Entry>& chosen = real.empty() ? all : real;
  std::vector<LanInterface> out;
  for (const Entry& entry : chosen) {
    if (std::none_of(out.begin(), out.end(), [&](const LanInterface& kept) {
          return kept.address == entry.lan.address;
        })) {
      out.push_back(entry.lan);
    }
  }
  std::stable_sort(out.begin(), out.end(),
                   [](const LanInterface& left, const LanInterface& right) {
                     const int by_rank = rank(left.address) - rank(right.address);
                     return by_rank != 0 ? by_rank < 0 : left.address < right.address;
                   });
  return out;
}

std::vector<std::string> lan_addresses(const std::vector<AdapterAddress>& adapters) {
  std::vector<std::string> out;
  for (const LanInterface& entry : lan_interfaces(adapters)) {
    out.push_back(entry.address);
  }
  return out;
}

std::vector<std::string> discovery_targets(const std::vector<AdapterAddress>& adapters) {
  std::vector<std::string> out{"255.255.255.255"};
  for (const LanInterface& entry : lan_interfaces(adapters)) {
    if (std::find(out.begin(), out.end(), entry.broadcast) == out.end()) {
      out.push_back(entry.broadcast);
    }
  }
  return out;
}

}  // namespace feq::share::addresses
