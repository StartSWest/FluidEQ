/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Share Audio's primitives on Windows' own CNG (bcrypt.dll), which every
// Windows this app runs on has: the pseudo-handles for SHA-256 and its HMAC,
// AES in GCM with the authenticated-cipher info, and the system's RNG.

#include "fluideq/share/crypto.h"

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <bcrypt.h>

#include <cstdlib>

namespace feq::share::crypto {
namespace {

bool ok(NTSTATUS status) { return status >= 0; }

/** CNG takes non-const buffers it promises not to write. */
PUCHAR raw(std::span<const std::uint8_t> data) {
  return const_cast<PUCHAR>(data.data());
}

ULONG size_of(std::span<const std::uint8_t> data) {
  return static_cast<ULONG>(data.size());
}

/**
 * One AES-256 key in GCM on CNG's own pseudo-handle for it, so no provider
 * is opened per packet; released with this.
 */
class GcmKey final {
 public:
  explicit GcmKey(std::span<const std::uint8_t> key) {
    if (!ok(BCryptGenerateSymmetricKey(BCRYPT_AES_GCM_ALG_HANDLE, &key_,
                                       nullptr, 0, raw(key), size_of(key), 0))) {
      key_ = nullptr;
    }
  }
  ~GcmKey() {
    if (key_ != nullptr) {
      BCryptDestroyKey(key_);
    }
  }
  GcmKey(const GcmKey&) = delete;
  GcmKey& operator=(const GcmKey&) = delete;

  BCRYPT_KEY_HANDLE handle() const { return key_; }

 private:
  BCRYPT_KEY_HANDLE key_ = nullptr;
};

/**
 * A buffer CNG will read or write, never null. Given no output buffer,
 * BCryptEncrypt and BCryptDecrypt only report the size they would need and
 * do nothing else: an empty packet then got no tag when sealed and had none
 * checked when opened, so a forged empty packet opened as genuine. One byte
 * of room keeps every call a real one.
 */
PUCHAR never_null(std::uint8_t* data, std::uint8_t& spare) {
  return data != nullptr ? data : &spare;
}

BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO mode_info(
    std::span<const std::uint8_t> iv, std::span<const std::uint8_t> aad,
    PUCHAR tag) {
  BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO info;
  BCRYPT_INIT_AUTH_MODE_INFO(info);
  info.pbNonce = raw(iv);
  info.cbNonce = size_of(iv);
  info.pbAuthData = raw(aad);
  info.cbAuthData = size_of(aad);
  info.pbTag = tag;
  info.cbTag = 16;
  return info;
}

}  // namespace

Digest sha256(std::span<const std::uint8_t> data) {
  Digest out{};
  if (!ok(BCryptHash(BCRYPT_SHA256_ALG_HANDLE, nullptr, 0, raw(data),
                     size_of(data), out.data(), static_cast<ULONG>(out.size())))) {
    // A hash that cannot be made is a broken system, not a bad input.
    std::abort();
  }
  return out;
}

Digest hmac_sha256(std::span<const std::uint8_t> key,
                   std::span<const std::uint8_t> data) {
  Digest out{};
  if (!ok(BCryptHash(BCRYPT_HMAC_SHA256_ALG_HANDLE, raw(key), size_of(key),
                     raw(data), size_of(data), out.data(),
                     static_cast<ULONG>(out.size())))) {
    std::abort();
  }
  return out;
}

bool aes256_gcm_seal(std::span<const std::uint8_t> key,
                     std::span<const std::uint8_t> iv,
                     std::span<const std::uint8_t> aad,
                     std::span<const std::uint8_t> plain, Bytes& cipher,
                     std::array<std::uint8_t, 16>& tag) {
  if (key.size() != 32 || iv.size() != 12) {
    return false;
  }
  const GcmKey gcm(key);
  if (gcm.handle() == nullptr) {
    return false;
  }
  auto info = mode_info(iv, aad, tag.data());
  cipher.resize(plain.size());
  ULONG written = 0;
  std::uint8_t spare_in = 0;
  std::uint8_t spare_out = 0;
  return ok(BCryptEncrypt(
             gcm.handle(),
             never_null(const_cast<std::uint8_t*>(plain.data()), spare_in),
             size_of(plain), &info, nullptr, 0,
             never_null(cipher.data(), spare_out),
             static_cast<ULONG>(cipher.size()), &written, 0)) &&
         written == cipher.size();
}

bool aes256_gcm_open(std::span<const std::uint8_t> key,
                     std::span<const std::uint8_t> iv,
                     std::span<const std::uint8_t> aad,
                     std::span<const std::uint8_t> cipher,
                     std::span<const std::uint8_t> tag, Bytes& plain) {
  if (key.size() != 32 || iv.size() != 12 || tag.size() != 16) {
    return false;
  }
  const GcmKey gcm(key);
  if (gcm.handle() == nullptr) {
    return false;
  }
  auto info = mode_info(iv, aad, raw(tag));
  plain.resize(cipher.size());
  ULONG written = 0;
  std::uint8_t spare_in = 0;
  std::uint8_t spare_out = 0;
  if (!ok(BCryptDecrypt(
          gcm.handle(),
          never_null(const_cast<std::uint8_t*>(cipher.data()), spare_in),
          size_of(cipher), &info, nullptr, 0, never_null(plain.data(), spare_out),
          static_cast<ULONG>(plain.size()), &written, 0)) ||
      written != plain.size()) {
    plain.clear();
    return false;
  }
  return true;
}

void random_bytes(std::span<std::uint8_t> out) {
  if (!ok(BCryptGenRandom(nullptr, out.data(), static_cast<ULONG>(out.size()),
                          BCRYPT_USE_SYSTEM_PREFERRED_RNG))) {
    std::abort();
  }
}

}  // namespace feq::share::crypto
