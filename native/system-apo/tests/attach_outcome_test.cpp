/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The verdict `install --attach-all` reaches over a machine's outputs.
 *
 * Its own binary rather than a few more cases in `fx_list_test.cpp`: that
 * file is at the size limit, and this rule is about a whole run rather than
 * one endpoint's list edit. The bug it exists for is an install that reported
 * failure — and skipped the audio restart — because one endpoint out of six
 * could not be read.
 */

#include "../setup/attach_outcome.h"

#include <cstdio>
#include <string>
#include <vector>

using fluideq_engine::setup::AttachOutcome;
using fluideq_engine::setup::EndpointResult;
using fluideq_engine::setup::summarise_attach_all;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

EndpointResult attached(const wchar_t* guid) {
  EndpointResult one;
  one.guid = guid;
  one.attached = true;
  return one;
}

EndpointResult failed(const wchar_t* guid, const wchar_t* why) {
  EndpointResult one;
  one.guid = guid;
  one.attached = false;
  one.error = why;
  return one;
}

void every_endpoint_attached_is_ok() {
  std::printf("every endpoint attached is ok\n");
  const AttachOutcome outcome =
      summarise_attach_all({attached(L"{A}"), attached(L"{B}")});
  CHECK(outcome.ok);
  CHECK(outcome.error.empty());
}

void one_awkward_endpoint_does_not_fail_the_install() {
  std::printf("one awkward endpoint does not fail the install\n");
  const AttachOutcome outcome = summarise_attach_all(
      {attached(L"{A}"), failed(L"{B}", L"composite list is REG_EXPAND_SZ"),
       attached(L"{C}")});
  // The whole point: the engine is installed and audible on two of three
  // outputs, so the command succeeded and the audio restart still runs. The
  // failure is not lost — it rides on the endpoint that had it.
  CHECK(outcome.ok);
  CHECK(outcome.error.empty());
}

void no_endpoint_attached_is_a_failure_that_says_why() {
  std::printf("no endpoint attached is a failure that says why\n");
  const AttachOutcome outcome =
      summarise_attach_all({failed(L"{A}", L"access denied"),
                            failed(L"{B}", L"composite list is REG_EXPAND_SZ")});
  CHECK(!outcome.ok);
  CHECK(outcome.error.find(L"access denied") != std::wstring::npos);
  CHECK(outcome.error.find(L"REG_EXPAND_SZ") != std::wstring::npos);
  // Both endpoints named, so the log says which output refused.
  CHECK(outcome.error.find(L"{A}") != std::wstring::npos);
  CHECK(outcome.error.find(L"{B}") != std::wstring::npos);
}

void a_single_failing_endpoint_is_a_failure() {
  std::printf("a single failing endpoint is a failure\n");
  const AttachOutcome outcome =
      summarise_attach_all({failed(L"{A}", L"access denied")});
  CHECK(!outcome.ok);
}

void no_endpoints_at_all_is_not_a_failure() {
  std::printf("no endpoints at all is not a failure\n");
  // A machine with no render endpoints has nothing to attach to. Reporting
  // that as a failed install would be reporting the absence of speakers as a
  // broken engine.
  const AttachOutcome outcome = summarise_attach_all({});
  CHECK(outcome.ok);
  CHECK(outcome.error.empty());
}

}  // namespace

int main() {
  std::printf("attach outcome\n\n");
  every_endpoint_attached_is_ok();
  one_awkward_endpoint_does_not_fail_the_install();
  no_endpoint_attached_is_a_failure_that_says_why();
  a_single_failing_endpoint_is_a_failure();
  no_endpoints_at_all_is_not_a_failure();

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
