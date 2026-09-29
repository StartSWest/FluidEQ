/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What `install` checks every DLL against before it copies it into Program
 * Files and registers it for audiodg.exe.
 *
 * The digest compiled into the helper must be the engine it was built beside
 * — or every install refuses — and a DLL it did not ship with must have none,
 * or anything dropped beside it would be installed. Given the engine DLL's
 * path on the command line.
 */

#include "digest.h"

#include <cstdio>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

using fluideq_engine::setup::sha256_hex;
using fluideq_engine::setup::shipped_digest;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

std::vector<unsigned char> bytes_of(const char* path) {
  std::ifstream file(path, std::ios::binary);
  return std::vector<unsigned char>(std::istreambuf_iterator<char>(file),
                                    std::istreambuf_iterator<char>());
}

}  // namespace

int main(int argc, char** argv) {
  std::printf("fluideq engine setup digest\n");
  if (argc < 2) {
    std::printf("  usage: digest_test <FluidEQ-Engine.dll>\n");
    return 2;
  }

  // FIPS 180-2's own vector for "abc".
  const std::string abc = "abc";
  CHECK(sha256_hex(std::vector<unsigned char>(abc.begin(), abc.end())) ==
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

  const std::vector<unsigned char> engine = bytes_of(argv[1]);
  CHECK(!engine.empty());
  const char* expected = shipped_digest(L"FluidEQ-Engine.dll");
  CHECK(expected != nullptr);
  CHECK(expected != nullptr && sha256_hex(engine) == expected);
  // Windows names are compared as Windows compares them.
  CHECK(shipped_digest(L"fluideq-engine.DLL") == expected);

  // POSITIVE CONTROL for the refusal: one changed byte is another DLL.
  std::vector<unsigned char> tampered = engine;
  if (!tampered.empty()) {
    tampered[tampered.size() / 2] ^= 0x01;
  }
  CHECK(expected != nullptr && sha256_hex(tampered) != expected);

  CHECK(shipped_digest(L"payload.dll") == nullptr);
  CHECK(shipped_digest(L"FluidEQ-Engine.dll.replaced") == nullptr);

  if (g_failures == 0) {
    std::printf("digest: ok\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
