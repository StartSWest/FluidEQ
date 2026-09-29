/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "digest.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <bcrypt.h>

#include <cwchar>
#include <string>
#include <vector>

// Generated at build time from the build's own DLLs (`shipped_dlls.cmake`).
#include "shipped_dlls.h"

namespace fluideq_engine::setup {

std::string sha256_hex(const std::vector<unsigned char>& bytes) {
  BCRYPT_ALG_HANDLE algorithm = nullptr;
  if (!BCRYPT_SUCCESS(BCryptOpenAlgorithmProvider(
          &algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0))) {
    return std::string();
  }
  unsigned char digest[32] = {};
  // BCryptHash takes a ULONG, and nothing `install` reads is past its cap of
  // 64 MB, far inside that.
  const NTSTATUS hashed =
      BCryptHash(algorithm, nullptr, 0,
                 const_cast<unsigned char*>(bytes.data()),
                 static_cast<ULONG>(bytes.size()), digest, sizeof(digest));
  BCryptCloseAlgorithmProvider(algorithm, 0);
  if (!BCRYPT_SUCCESS(hashed)) {
    return std::string();
  }
  static const char kHex[] = "0123456789abcdef";
  std::string text;
  text.reserve(sizeof(digest) * 2);
  for (const unsigned char byte : digest) {
    text.push_back(kHex[byte >> 4]);
    text.push_back(kHex[byte & 0x0F]);
  }
  return text;
}

const char* shipped_digest(const std::wstring& name) {
  for (const ShippedDll& dll : kShippedDlls) {
    if (_wcsicmp(dll.name, name.c_str()) == 0) {
      return dll.sha256;
    }
  }
  return nullptr;
}

}  // namespace fluideq_engine::setup
