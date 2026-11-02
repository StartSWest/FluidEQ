/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "system_adapters.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <winsock2.h>
#include <iphlpapi.h>
#include <ws2tcpip.h>

#include <algorithm>
#include <array>

#include "tcp.h"

namespace feq::share::service {
namespace {

std::string utf8_of(const wchar_t* text) {
  if (text == nullptr || *text == L'\0') {
    return {};
  }
  const int size =
      WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
  if (size <= 1) {
    return {};
  }
  std::string out(static_cast<std::size_t>(size - 1), '\0');
  WideCharToMultiByte(CP_UTF8, 0, text, -1, out.data(), size, nullptr, nullptr);
  return out;
}

/** libuv's: the prefix's ones, then zeros; no ones for a prefix of 0. */
std::string netmask_of(ULONG prefix) {
  const ULONG bits = std::min<ULONG>(prefix, 32);
  in_addr mask{};
  mask.s_addr = bits == 0 ? 0 : htonl(0xFFFFFFFFu << (32 - bits));
  return ipv4_text(mask);
}

}  // namespace

std::vector<share::addresses::AdapterAddress> system_adapters() {
  constexpr ULONG kFlags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST |
                           GAA_FLAG_SKIP_DNS_SERVER;
  std::vector<std::uint8_t> buffer(16 * 1024);
  ULONG size = static_cast<ULONG>(buffer.size());
  ULONG result = ERROR_BUFFER_OVERFLOW;
  // The list can grow between asking its size and reading it.
  for (int attempt = 0; attempt < 4 && result == ERROR_BUFFER_OVERFLOW;
       attempt += 1) {
    buffer.resize(size);
    result = GetAdaptersAddresses(
        AF_UNSPEC, kFlags, nullptr,
        reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data()), &size);
  }
  std::vector<share::addresses::AdapterAddress> out;
  if (result != NO_ERROR) {
    return out;
  }
  // Node's object gathers each name's addresses under its first place.
  std::vector<std::pair<std::string, std::vector<share::addresses::AdapterAddress>>>
      by_name;
  for (auto* adapter = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data());
       adapter != nullptr; adapter = adapter->Next) {
    if (adapter->OperStatus != IfOperStatusUp ||
        adapter->FirstUnicastAddress == nullptr) {
      continue;
    }
    const std::string name = utf8_of(adapter->FriendlyName);
    const bool internal = adapter->IfType == IF_TYPE_SOFTWARE_LOOPBACK;
    auto group = std::find_if(by_name.begin(), by_name.end(),
                              [&name](const auto& item) { return item.first == name; });
    if (group == by_name.end()) {
      by_name.emplace_back(name, std::vector<share::addresses::AdapterAddress>{});
      group = std::prev(by_name.end());
    }
    for (auto* unicast = adapter->FirstUnicastAddress; unicast != nullptr;
         unicast = unicast->Next) {
      const sockaddr* address = unicast->Address.lpSockaddr;
      if (address == nullptr || address->sa_family != AF_INET) {
        continue;
      }
      share::addresses::AdapterAddress entry;
      entry.name = name;
      entry.address =
          ipv4_text(reinterpret_cast<const sockaddr_in*>(address)->sin_addr);
      entry.netmask = netmask_of(unicast->OnLinkPrefixLength);
      entry.internal = internal;
      group->second.push_back(std::move(entry));
    }
  }
  for (auto& [name, entries] : by_name) {
    for (auto& entry : entries) {
      out.push_back(std::move(entry));
    }
  }
  return out;
}

std::string host_name() {
  std::array<wchar_t, 256> name{};
  if (GetHostNameW(name.data(), static_cast<int>(name.size())) != 0) {
    return {};
  }
  return utf8_of(name.data());
}

}  // namespace feq::share::service
