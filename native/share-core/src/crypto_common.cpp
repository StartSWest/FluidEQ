/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/share/crypto.h"

#include <algorithm>

namespace feq::share::crypto {
namespace {

constexpr char kUrlAlphabet[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** A character's six bits in either alphabet, or 64 for neither. */
std::uint8_t sextet(char c) {
  if (c >= 'A' && c <= 'Z') {
    return static_cast<std::uint8_t>(c - 'A');
  }
  if (c >= 'a' && c <= 'z') {
    return static_cast<std::uint8_t>(c - 'a' + 26);
  }
  if (c >= '0' && c <= '9') {
    return static_cast<std::uint8_t>(c - '0' + 52);
  }
  if (c == '+' || c == '-') {
    return 62;
  }
  if (c == '/' || c == '_') {
    return 63;
  }
  return 64;
}

}  // namespace

Bytes hkdf_sha256(std::span<const std::uint8_t> ikm,
                  std::span<const std::uint8_t> salt,
                  std::span<const std::uint8_t> info, std::size_t length) {
  // Extract: an absent salt is a hash's length of zeros (RFC 5869, 2.2).
  const Digest zeros{};
  const Digest prk = hmac_sha256(
      salt.empty() ? std::span<const std::uint8_t>(zeros) : salt, ikm);
  // Expand: T(i) = HMAC(PRK, T(i-1) | info | i).
  Bytes okm;
  Bytes block;
  for (std::uint8_t counter = 1; okm.size() < length; ++counter) {
    Bytes input(block);
    input.insert(input.end(), info.begin(), info.end());
    input.push_back(counter);
    const Digest next = hmac_sha256(prk, input);
    block.assign(next.begin(), next.end());
    const std::size_t take = std::min(block.size(), length - okm.size());
    okm.insert(okm.end(), block.begin(),
               block.begin() + static_cast<std::ptrdiff_t>(take));
  }
  return okm;
}

bool timing_safe_equal(std::span<const std::uint8_t> left,
                       std::span<const std::uint8_t> right) {
  if (left.size() != right.size()) {
    return false;
  }
  std::uint8_t difference = 0;
  for (std::size_t at = 0; at < left.size(); ++at) {
    difference = static_cast<std::uint8_t>(difference | (left[at] ^ right[at]));
  }
  return difference == 0;
}

std::string base64url(std::span<const std::uint8_t> data) {
  std::string out;
  out.reserve((data.size() * 4 + 2) / 3);
  std::size_t at = 0;
  for (; at + 3 <= data.size(); at += 3) {
    const std::uint32_t group = (static_cast<std::uint32_t>(data[at]) << 16) |
                                (static_cast<std::uint32_t>(data[at + 1]) << 8) |
                                data[at + 2];
    out.push_back(kUrlAlphabet[(group >> 18) & 0x3F]);
    out.push_back(kUrlAlphabet[(group >> 12) & 0x3F]);
    out.push_back(kUrlAlphabet[(group >> 6) & 0x3F]);
    out.push_back(kUrlAlphabet[group & 0x3F]);
  }
  const std::size_t left = data.size() - at;
  if (left == 1) {
    const std::uint32_t group = static_cast<std::uint32_t>(data[at]) << 16;
    out.push_back(kUrlAlphabet[(group >> 18) & 0x3F]);
    out.push_back(kUrlAlphabet[(group >> 12) & 0x3F]);
  } else if (left == 2) {
    const std::uint32_t group = (static_cast<std::uint32_t>(data[at]) << 16) |
                                (static_cast<std::uint32_t>(data[at + 1]) << 8);
    out.push_back(kUrlAlphabet[(group >> 18) & 0x3F]);
    out.push_back(kUrlAlphabet[(group >> 12) & 0x3F]);
    out.push_back(kUrlAlphabet[(group >> 6) & 0x3F]);
  }
  return out;
}

std::string base64(std::span<const std::uint8_t> data) {
  std::string out = base64url(data);
  for (char& c : out) {
    if (c == '-') {
      c = '+';
    } else if (c == '_') {
      c = '/';
    }
  }
  while (out.size() % 4 != 0) {
    out.push_back('=');
  }
  return out;
}

Bytes from_base64(std::string_view text) {
  // Node's decoder: what is in neither alphabet is passed over, and the
  // bits left at the end make whole bytes only.
  Bytes out;
  out.reserve(text.size() * 3 / 4);
  std::uint32_t group = 0;
  int bits = 0;
  for (const char c : text) {
    const std::uint8_t value = sextet(c);
    if (value == 64) {
      continue;
    }
    group = (group << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push_back(static_cast<std::uint8_t>((group >> bits) & 0xFF));
    }
  }
  return out;
}

}  // namespace feq::share::crypto
