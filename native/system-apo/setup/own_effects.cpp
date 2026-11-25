/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "own_effects.h"

#include <algorithm>

namespace fluideq_engine::setup {

namespace {

bool holds(const std::optional<std::wstring>& value) {
  return value.has_value() && !value->empty();
}

/** Any of pids 5-7 or 13-15 present: the endpoint is read the 8.1 way. */
bool modern(const FxValues& values) {
  for (int at = 0; at < kSlotCount; ++at) {
    if (values.single[at].has_value() || values.composite[at].has_value()) {
      return true;
    }
  }
  return false;
}

}  // namespace

FxPlan plan_suspend_others(const FxValues& before, std::wstring_view keep) {
  FxPlan plan;
  plan.after = before;
  FxValues& after = plan.after;

  // Mirrored forward first, as Equalizer APO's switch-off does: a slot
  // Windows reads from its single value is only emptied once a list exists
  // there that does not name the vendor. The pre-8.1 pair likewise, on an
  // endpoint that has nothing newer.
  for (int at = 0; at < kSlotCount; ++at) {
    if (!after.composite[at].has_value() && holds(before.single[at])) {
      after.composite[at] = std::vector<std::wstring>{*before.single[at]};
    }
  }
  if (!modern(before)) {
    for (int at = 0; at < kLegacyCount; ++at) {
      if (holds(before.legacy[at])) {
        after.composite[at] = std::vector<std::wstring>{*before.legacy[at]};
      }
    }
  }

  bool removed = false;
  for (int at = 0; at < kSlotCount; ++at) {
    if (!after.composite[at].has_value()) {
      continue;
    }
    std::vector<std::wstring>& entries = *after.composite[at];
    const size_t was = entries.size();
    entries.erase(std::remove_if(entries.begin(), entries.end(),
                                 [keep](const std::wstring& entry) {
                                   return !entry.empty() &&
                                          !equal_ci(entry, keep);
                                 }),
                  entries.end());
    if (entries.size() != was) {
      removed = true;
      // A list this program edited goes back as the record has it, never
      // as the vendor's single string: the restore writes the record.
      after.composite_was_sz[at] = false;
    }
  }

  // Nothing but ours ran: the mirroring alone is a change nobody asked for.
  if (!removed) {
    plan.after = before;
    plan.changed = false;
    return plan;
  }
  plan.changed = after != before;
  return plan;
}

FxPlan plan_restore_own(const FxValues& current, const FxValues& saved,
                        std::wstring_view keep) {
  const FxValues left = plan_suspend_others(saved, keep).after;
  if (slot_of(current, keep) == slot_of(left, keep)) {
    FxPlan plan;
    plan.after = saved;
    plan.changed = saved != current;
    return plan;
  }
  return plan_restore_apo(current, saved, keep);
}

std::vector<RunningEffect> effects_running(const FxValues& values) {
  constexpr EffectKind kSlotKinds[kSlotCount] = {
      EffectKind::Stream, EffectKind::Mode, EffectKind::Endpoint};
  constexpr EffectKind kLegacyKinds[kLegacyCount] = {EffectKind::Stream,
                                                     EffectKind::Endpoint};
  std::vector<RunningEffect> run;
  for (int at = 0; at < kSlotCount; ++at) {
    if (values.composite[at].has_value()) {
      for (const std::wstring& entry : *values.composite[at]) {
        if (!entry.empty()) {
          run.push_back({entry, kSlotKinds[at]});
        }
      }
    } else if (holds(values.single[at])) {
      run.push_back({*values.single[at], kSlotKinds[at]});
    }
  }
  if (!modern(values)) {
    for (int at = 0; at < kLegacyCount; ++at) {
      if (holds(values.legacy[at])) {
        run.push_back({*values.legacy[at], kLegacyKinds[at]});
      }
    }
  }
  return run;
}

std::vector<std::wstring> effects_run(const FxValues& values) {
  std::vector<std::wstring> run;
  for (const RunningEffect& effect : effects_running(values)) {
    run.push_back(effect.clsid);
  }
  return run;
}

}  // namespace fluideq_engine::setup
