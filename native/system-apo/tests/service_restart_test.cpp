/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What an audio restart leaves running when one of its steps fails.
 *
 * The bug this exists for: the restart returned at the first failure, so a
 * second vendor service that refused to stop left the first one down, and an
 * endpoint builder that refused to stop left Windows Audio down — no sound
 * until a reboot, from the button meant to fix sound. Every case asserts the
 * whole sequence of calls, not just the verdict: a restart that reports the
 * right error and never starts Audiosrv again passes every check that only
 * looks at the error.
 */

#include "../setup/service_restart.h"

#include <cstdio>
#include <set>
#include <string>
#include <vector>

using fluideq_engine::setup::restart_services;
using fluideq_engine::setup::ServiceControl;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

const std::wstring kAudio = L"Audiosrv";
const std::wstring kBuilder = L"AudioEndpointBuilder";

/** Records every call, and fails the ones it was told to. */
class FakeControl final : public ServiceControl {
 public:
  std::vector<std::wstring> dependents;
  bool list_fails = false;
  std::set<std::wstring> refuse_stop;
  std::set<std::wstring> refuse_start;
  std::vector<std::wstring> calls;

  bool running_dependents(const std::wstring& service,
                          std::vector<std::wstring>& names,
                          std::wstring& error) override {
    calls.push_back(L"list " + service);
    if (list_fails) {
      error = L"access is denied";
      return false;
    }
    names = dependents;
    return true;
  }

  bool stop(const std::wstring& service, std::wstring& error) override {
    calls.push_back(L"stop " + service);
    if (refuse_stop.count(service) != 0) {
      error = L"could not stop " + service + L": refused";
      return false;
    }
    return true;
  }

  bool start(const std::wstring& service, std::wstring& error) override {
    calls.push_back(L"start " + service);
    if (refuse_start.count(service) != 0) {
      error = L"could not start " + service + L": refused";
      return false;
    }
    return true;
  }
};

bool contains(const std::wstring& text, const std::wstring& part) {
  return text.find(part) != std::wstring::npos;
}

void restarts_everything_in_dependency_order() {
  std::printf("restarts everything in dependency order\n");
  FakeControl control;
  control.dependents = {L"VendorA", L"VendorB"};
  std::wstring error;
  CHECK(restart_services(control, kAudio, kBuilder, error));
  CHECK(error.empty());
  const std::vector<std::wstring> expected = {
      L"list Audiosrv",        L"stop VendorA",
      L"stop VendorB",         L"stop Audiosrv",
      L"stop AudioEndpointBuilder", L"start AudioEndpointBuilder",
      L"start Audiosrv",       L"start VendorB",
      L"start VendorA"};
  CHECK(control.calls == expected);
}

void a_dependent_that_refuses_to_stop_leaves_the_others_running() {
  std::printf("a dependent that refuses to stop leaves the others running\n");
  FakeControl control;
  control.dependents = {L"VendorA", L"VendorB"};
  control.refuse_stop = {L"VendorB"};
  std::wstring error;
  CHECK(!restart_services(control, kAudio, kBuilder, error));
  CHECK(contains(error, L"could not stop VendorB"));
  // VendorA was stopped, so it is started again; Audiosrv and the builder
  // were never touched, so they are not.
  const std::vector<std::wstring> expected = {
      L"list Audiosrv", L"stop VendorA", L"stop VendorB", L"start VendorA"};
  CHECK(control.calls == expected);
}

void a_builder_that_refuses_to_stop_brings_audio_back() {
  std::printf("a builder that refuses to stop brings audio back\n");
  FakeControl control;
  control.dependents = {L"VendorA"};
  control.refuse_stop = {kBuilder};
  std::wstring error;
  CHECK(!restart_services(control, kAudio, kBuilder, error));
  CHECK(contains(error, L"could not stop AudioEndpointBuilder"));
  const std::vector<std::wstring> expected = {
      L"list Audiosrv",  L"stop VendorA",   L"stop Audiosrv",
      L"stop AudioEndpointBuilder", L"start Audiosrv", L"start VendorA"};
  CHECK(control.calls == expected);
}

void a_dependent_that_will_not_start_does_not_stop_the_rest() {
  std::printf("a dependent that will not start does not stop the rest\n");
  FakeControl control;
  control.dependents = {L"VendorA", L"VendorB"};
  control.refuse_start = {L"VendorB"};
  std::wstring error;
  CHECK(!restart_services(control, kAudio, kBuilder, error));
  CHECK(contains(error, L"could not start VendorB"));
  // VendorA still comes back after VendorB failed.
  CHECK(control.calls.back() == L"start VendorA");
}

void audio_that_will_not_start_is_reported_and_the_rest_still_try() {
  std::printf("audio that will not start is reported and the rest still try\n");
  FakeControl control;
  control.dependents = {L"VendorA"};
  control.refuse_start = {kAudio};
  std::wstring error;
  CHECK(!restart_services(control, kAudio, kBuilder, error));
  CHECK(contains(error, L"could not start Audiosrv"));
  CHECK(control.calls.back() == L"start VendorA");
}

void both_failures_are_reported_together() {
  std::printf("both failures are reported together\n");
  FakeControl control;
  control.dependents = {L"VendorA"};
  control.refuse_stop = {kAudio};
  control.refuse_start = {L"VendorA"};
  std::wstring error;
  CHECK(!restart_services(control, kAudio, kBuilder, error));
  CHECK(contains(error, L"could not stop Audiosrv"));
  CHECK(contains(error, L"could not start VendorA"));
}

void a_failed_listing_touches_nothing() {
  std::printf("a failed listing touches nothing\n");
  FakeControl control;
  control.list_fails = true;
  std::wstring error;
  CHECK(!restart_services(control, kAudio, kBuilder, error));
  CHECK(error == L"access is denied");
  CHECK(control.calls == std::vector<std::wstring>{L"list Audiosrv"});
}

void no_dependents_is_the_plain_restart() {
  std::printf("no dependents is the plain restart\n");
  FakeControl control;
  std::wstring error;
  CHECK(restart_services(control, kAudio, kBuilder, error));
  const std::vector<std::wstring> expected = {
      L"list Audiosrv", L"stop Audiosrv", L"stop AudioEndpointBuilder",
      L"start AudioEndpointBuilder", L"start Audiosrv"};
  CHECK(control.calls == expected);
}

}  // namespace

int main() {
  restarts_everything_in_dependency_order();
  a_dependent_that_refuses_to_stop_leaves_the_others_running();
  a_builder_that_refuses_to_stop_brings_audio_back();
  a_dependent_that_will_not_start_does_not_stop_the_rest();
  audio_that_will_not_start_is_reported_and_the_rest_still_try();
  both_failures_are_reported_together();
  a_failed_listing_touches_nothing();
  no_dependents_is_the_plain_restart();
  if (g_failures != 0) {
    std::printf("%d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("all checks passed\n");
  return 0;
}
