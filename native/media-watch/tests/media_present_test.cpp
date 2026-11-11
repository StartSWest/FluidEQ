/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * The media helper's guard on Windows' answers (winrt_present.h).
 *
 * An answer of success with no object, read through, is an access violation
 * no `catch` sees — the 2.4.0 helper's death. Through the guard it is the
 * ordinary failure every caller already handles.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <winrt/Windows.Foundation.h>

#include <cstdio>

#include "winrt_present.h"

namespace {

int failures = 0;

void check(bool condition, const char* description) {
  std::printf("  %s %s\n", condition ? "ok  " : "FAIL", description);
  if (!condition) {
    ++failures;
  }
}

namespace wf = winrt::Windows::Foundation;
using fluideq_media::present;

void an_empty_answer_is_the_failure_callers_handle() {
  std::printf("an empty answer is the failure callers handle\n");
  bool caught = false;
  winrt::hresult code{};
  try {
    present(wf::IStringable{nullptr});
  } catch (const winrt::hresult_error& error) {
    caught = true;
    code = error.code();
  }
  check(caught, "an object answer with no object throws hresult_error");
  check(code == E_POINTER, "as E_POINTER");
}

void an_answer_that_is_there_passes_untouched() {
  std::printf("an answer that is there passes untouched\n");
  // The control: the guard is not simply throwing for everything.
  const wf::Uri uri(L"https://fluideq.app/media");
  bool caught = false;
  wf::Uri passed{nullptr};
  try {
    passed = present(uri);
  } catch (const winrt::hresult_error&) {
    caught = true;
  }
  check(!caught, "a real object does not throw");
  check(passed == uri, "and comes back as the same object");
}

}  // namespace

int main() {
  winrt::init_apartment(winrt::apartment_type::multi_threaded);
  an_empty_answer_is_the_failure_callers_handle();
  an_answer_that_is_there_passes_untouched();
  if (failures != 0) {
    std::printf("%d media present check(s) failed\n", failures);
    return 1;
  }
  std::printf("media present: all checks passed\n");
  return 0;
}
