/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

/*
 * The cryptography Share Audio's wire is made of, as Node's `crypto` does
 * it: SHA-256, HMAC-SHA-256, HKDF-SHA-256, AES-256-GCM and the system's
 * random bytes. Each platform supplies the primitives (`crypto_windows.cpp`
 * on CNG); HKDF and the comparison are written once here, on HMAC, so every
 * platform derives a session key the same way. Base64 is Node's: written
 * without padding in its URL alphabet, read in either alphabet, skipping
 * what is in neither.
 */

namespace feq::share::crypto {

using Bytes = std::vector<std::uint8_t>;
using Digest = std::array<std::uint8_t, 32>;

inline std::span<const std::uint8_t> bytes_of(std::string_view text) {
  return {reinterpret_cast<const std::uint8_t*>(text.data()), text.size()};
}

Digest sha256(std::span<const std::uint8_t> data);
Digest hmac_sha256(std::span<const std::uint8_t> key,
                   std::span<const std::uint8_t> data);
/** `crypto.hkdfSync('sha256', ikm, salt, info, length)`, RFC 5869. */
Bytes hkdf_sha256(std::span<const std::uint8_t> ikm,
                  std::span<const std::uint8_t> salt,
                  std::span<const std::uint8_t> info, std::size_t length);

/** AES-256-GCM with a 12-byte IV and a 16-byte tag. */
bool aes256_gcm_seal(std::span<const std::uint8_t> key,
                     std::span<const std::uint8_t> iv,
                     std::span<const std::uint8_t> aad,
                     std::span<const std::uint8_t> plain, Bytes& cipher,
                     std::array<std::uint8_t, 16>& tag);
/** False when the tag does not match: nothing of `plain` is to be used. */
bool aes256_gcm_open(std::span<const std::uint8_t> key,
                     std::span<const std::uint8_t> iv,
                     std::span<const std::uint8_t> aad,
                     std::span<const std::uint8_t> cipher,
                     std::span<const std::uint8_t> tag, Bytes& plain);

void random_bytes(std::span<std::uint8_t> out);

/** `crypto.timingSafeEqual`, false for two lengths. */
bool timing_safe_equal(std::span<const std::uint8_t> left,
                       std::span<const std::uint8_t> right);

/** `buffer.toString('base64url')`. */
std::string base64url(std::span<const std::uint8_t> data);
/** `Buffer.from(text, 'base64url')` (and 'base64': Node reads both alike). */
Bytes from_base64(std::string_view text);

}  // namespace feq::share::crypto
