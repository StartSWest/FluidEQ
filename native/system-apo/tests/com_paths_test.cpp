/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two registry paths the effect is found by.
 *
 * A wrong path here fails with no message anywhere: the install reports
 * success, the effect is attached to every output, and audiodg.exe skips it
 * because the record it reads before creating an effect is not where it
 * looks. That is exactly what the first build did, so the location is pinned
 * against the one Windows documents and every vendor effect on a real
 * machine uses — `HKCR\AudioEngine\AudioProcessingObjects`, which is the
 * machine-wide `SOFTWARE\Classes\AudioEngine\AudioProcessingObjects`.
 */

#include "../setup/com_paths.h"

#include <cstdio>
#include <string>

using fluideq_engine::setup::apo_registration_path;
using fluideq_engine::setup::clsid_registration_path;
using fluideq_engine::setup::kEngineClsid;
using fluideq_engine::setup::misplaced_apo_record_path;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

void the_effect_record_lives_where_audiodg_reads_it() {
  std::printf("the effect record lives where audiodg reads it\n");
  CHECK(apo_registration_path() ==
        L"SOFTWARE\\Classes\\AudioEngine\\AudioProcessingObjects\\"
        L"{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}");
}

void the_class_is_registered_machine_wide() {
  std::printf("the class is registered machine wide\n");
  CHECK(clsid_registration_path() ==
        L"SOFTWARE\\Classes\\CLSID\\{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}");
}

void the_misplaced_record_is_a_different_key() {
  std::printf("the misplaced record is a different key\n");
  // The clean-up must never delete the real record: the two must not
  // coincide, and both must name this effect and no other.
  const std::wstring misplaced = misplaced_apo_record_path();
  CHECK(misplaced != apo_registration_path());
  CHECK(misplaced.find(L"CurrentVersion\\Audio\\AudioProcessingObjects\\") !=
        std::wstring::npos);
  CHECK(misplaced.rfind(kEngineClsid) ==
        misplaced.size() - std::wstring(kEngineClsid).size());
}

}  // namespace

int main() {
  the_effect_record_lives_where_audiodg_reads_it();
  the_class_is_registered_machine_wide();
  the_misplaced_record_is_a_different_key();
  if (g_failures != 0) {
    std::printf("%d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("ok\n");
  return 0;
}
