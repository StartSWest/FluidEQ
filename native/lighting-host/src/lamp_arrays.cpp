/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lamp_arrays.h"

#include <unknwn.h>
#include <winrt/Windows.Devices.Enumeration.h>
#include <winrt/Windows.Devices.Lights.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.Metadata.h>
#include <winrt/Windows.Foundation.Numerics.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.UI.h>

#include <chrono>
#include <map>
#include <mutex>
#include <set>
#include <string>
#include <vector>

#include "json_text.h"

namespace fluideq_lighting {

namespace {

using winrt::Windows::Devices::Enumeration::DeviceInformation;
using winrt::Windows::Devices::Enumeration::DeviceInformationUpdate;
using winrt::Windows::Devices::Enumeration::DeviceWatcher;
using winrt::Windows::Devices::Lights::LampArray;

constexpr wchar_t kContainerIdProperty[] = L"System.Devices.ContainerId";

std::string container_of(const DeviceInformation& info) {
  const auto value = info.Properties().TryLookup(kContainerIdProperty);
  if (!value) {
    return {};
  }
  const auto guid = value.try_as<winrt::Windows::Foundation::IReference<winrt::guid>>();
  if (!guid) {
    return {};
  }
  return winrt::to_string(winrt::to_hstring(guid.Value()));
}

bool availability_is_reported() {
  // `IsAvailable` arrived with Windows 11's Dynamic Lighting settings page.
  // Before it, there is nothing to read and every lamp was the app's to set.
  return winrt::Windows::Foundation::Metadata::ApiInformation::
      IsPropertyPresent(L"Windows.Devices.Lights.LampArray", L"IsAvailable");
}

}  // namespace

struct LampArrays::State : std::enable_shared_from_this<LampArrays::State> {
  struct Device {
    std::uint32_t index = 0;
    LampArray lamps{nullptr};
    std::vector<std::int32_t> lamp_indices;
    std::vector<winrt::Windows::UI::Color> colours;
    std::chrono::steady_clock::duration min_interval{};
    std::chrono::steady_clock::time_point last_sent{};
    // -1 until the first reading, so the first one is always reported.
    int available = -1;
    winrt::event_token availability_token{};
  };

  explicit State(EventSink& events) : sink(events) {}

  EventSink& sink;
  std::recursive_mutex mutex;
  bool stopped = false;
  bool reports_availability = false;
  std::uint32_t next_index = 1;
  std::map<std::wstring, Device> by_id;
  // Found by the watcher, not yet opened.
  std::set<std::wstring> opening;
  DeviceWatcher watcher{nullptr};

  void report_availability(Device& device) {
    if (!reports_availability) {
      return;
    }
    const int now = device.lamps.IsAvailable() ? 1 : 0;
    if (now == device.available) {
      return;
    }
    device.available = now;
    sink.write(JsonLine("available")
                   .integer("index", device.index)
                   .boolean("available", now == 1)
                   .finish());
  }

  // Opened from the operation's own completion, never by blocking in the
  // watcher's callback. `FromIdAsync` does not always return: measured on a
  // machine whose session had moved to Remote Desktop, it never completed —
  // from the callback, from the main thread, with the watcher running or
  // stopped — while the same call answered in milliseconds at the console.
  // Blocked in `Added`, one such device stalled the watcher itself, and no
  // other device and no "enumerated" was ever reported. Asynchronously, that
  // device simply never appears.
  void added(const DeviceInformation& info) {
    const std::wstring id(info.Id());
    const std::string name = winrt::to_string(info.Name());
    const std::string container = container_of(info);
    {
      const std::scoped_lock lock(mutex);
      if (stopped) {
        return;
      }
      opening.insert(id);
    }
    // The completion holds the state alive: it can arrive after the helper
    // has begun to shut down, and `stopped` is what it then finds.
    LampArray::FromIdAsync(info.Id())
        .Completed([self = shared_from_this(), id, name, container](
                       const auto& operation, const auto status) {
          LampArray lamps{nullptr};
          if (status == winrt::Windows::Foundation::AsyncStatus::Completed) {
            lamps = operation.GetResults();
          } else {
            self->failed(id, operation.ErrorCode().value);
          }
          self->opened(id, name, container, lamps);
        });
  }

  void failed(const std::wstring& id, std::int32_t code) {
    const std::scoped_lock lock(mutex);
    if (stopped || opening.count(id) == 0) {
      return;
    }
    sink.write(JsonLine("error")
                   .text("message", "a lighting device could not be opened")
                   .integer("code", code)
                   .finish());
  }

  void enumerated() {
    const std::scoped_lock lock(mutex);
    if (!stopped) {
      sink.write(JsonLine("enumerated").text("source", "lamparray").finish());
    }
  }

  void opened(const std::wstring& id, const std::string& name,
              const std::string& container, const LampArray& lamps) {
    {
      const std::scoped_lock lock(mutex);
      // Removed while it was opening: nothing to report, nothing to keep.
      if (opening.erase(id) == 0 || stopped || !lamps) {
        return;
      }
    }

    const std::int32_t count = lamps.LampCount();
    std::vector<float> positions;
    positions.reserve(static_cast<std::size_t>(count) * 3);
    std::vector<std::int32_t> indices;
    indices.reserve(static_cast<std::size_t>(count));
    for (std::int32_t lamp = 0; lamp < count; ++lamp) {
      const auto where = lamps.GetLampInfo(lamp).Position();
      positions.push_back(where.x);
      positions.push_back(where.y);
      positions.push_back(where.z);
      indices.push_back(lamp);
    }
    const auto box = lamps.BoundingBox();

    const std::scoped_lock lock(mutex);
    if (stopped) {
      return;
    }
    Device device;
    device.index = next_index++;
    device.lamps = lamps;
    device.lamp_indices = std::move(indices);
    device.colours.assign(device.lamp_indices.size(),
                          winrt::Windows::UI::Color{255, 0, 0, 0});
    device.min_interval = lamps.MinUpdateInterval();

    sink.write(
        JsonLine("lamparray")
            .integer("index", device.index)
            .text("id", winrt::to_string(id))
            .text("name", name)
            .text("container", container)
            .integer("kind", static_cast<std::int64_t>(lamps.LampArrayKind()))
            .integer("vendorId", lamps.HardwareVendorId())
            .integer("productId", lamps.HardwareProductId())
            .integer("lampCount", count)
            .number("width", box.x)
            .number("height", box.y)
            .numbers("positions", positions.data(), positions.size())
            .integer("minUpdateMs",
                     std::chrono::duration_cast<std::chrono::milliseconds>(
                         device.min_interval)
                         .count())
            .finish());

    if (reports_availability) {
      // Only an app with package identity may listen; without one Windows
      // refuses the subscription, and availability is read after each frame
      // instead.
      try {
        device.availability_token = lamps.AvailabilityChanged(
            [weak = weak_from_this(), id](const LampArray& sender, const auto&) {
              const auto self = weak.lock();
              if (!self) {
                return;
              }
              const std::scoped_lock inner(self->mutex);
              const auto found = self->by_id.find(id);
              if (!self->stopped && found != self->by_id.end() &&
                  found->second.lamps == sender) {
                self->report_availability(found->second);
              }
            });
      } catch (const winrt::hresult_error&) {
        device.availability_token = {};
      }
    }
    auto& stored = by_id.emplace(id, std::move(device)).first->second;
    report_availability(stored);
  }

  void removed(const DeviceInformationUpdate& update) {
    const std::scoped_lock lock(mutex);
    if (stopped) {
      return;
    }
    opening.erase(std::wstring(update.Id()));
    const auto found = by_id.find(std::wstring(update.Id()));
    if (found == by_id.end()) {
      return;
    }
    if (found->second.availability_token) {
      found->second.lamps.AvailabilityChanged(found->second.availability_token);
    }
    sink.write(JsonLine("lamparray-removed")
                   .integer("index", found->second.index)
                   .finish());
    by_id.erase(found);
  }
};

LampArrays::LampArrays(EventSink& sink)
    : state_(std::make_shared<State>(sink)) {}

LampArrays::~LampArrays() { stop(); }

void LampArrays::start() {
  state_->reports_availability = availability_is_reported();
  auto properties = winrt::single_threaded_vector<winrt::hstring>(
      {winrt::hstring(kContainerIdProperty)});
  state_->watcher =
      DeviceInformation::CreateWatcher(LampArray::GetDeviceSelector(), properties);
  // Weak: the watcher's handlers can still fire while it is stopping, after
  // the helper has let the state go.
  std::weak_ptr<State> weak = state_;
  state_->watcher.Added(
      [weak](const DeviceWatcher&, const DeviceInformation& info) {
        if (const auto state = weak.lock()) {
          state->added(info);
        }
      });
  state_->watcher.Removed(
      [weak](const DeviceWatcher&, const DeviceInformationUpdate& update) {
        if (const auto state = weak.lock()) {
          state->removed(update);
        }
      });
  // Required even with nothing to do: a watcher without an Updated handler
  // stops reporting devices that arrive after the first enumeration.
  state_->watcher.Updated(
      [](const DeviceWatcher&, const DeviceInformationUpdate&) {});
  state_->watcher.EnumerationCompleted(
      [weak](const DeviceWatcher&, const winrt::Windows::Foundation::IInspectable&) {
        if (const auto state = weak.lock()) {
          state->enumerated();
        }
      });
  state_->watcher.Start();
}

void LampArrays::stop() {
  if (!state_) {
    return;
  }
  DeviceWatcher watcher{nullptr};
  {
    const std::scoped_lock lock(state_->mutex);
    if (state_->stopped) {
      return;
    }
    state_->stopped = true;
    watcher = state_->watcher;
    for (auto& [id, device] : state_->by_id) {
      if (device.availability_token) {
        device.lamps.AvailabilityChanged(device.availability_token);
      }
    }
    state_->by_id.clear();
  }
  if (watcher) {
    const auto status = watcher.Status();
    if (status == winrt::Windows::Devices::Enumeration::DeviceWatcherStatus::Started ||
        status == winrt::Windows::Devices::Enumeration::DeviceWatcherStatus::
                      EnumerationCompleted) {
      watcher.Stop();
    }
  }
}

void LampArrays::set_colours(const ColoursFrame& frame) {
  const std::scoped_lock lock(state_->mutex);
  if (state_->stopped) {
    return;
  }
  for (auto& [id, device] : state_->by_id) {
    if (device.index != frame.device) {
      continue;
    }
    // The device's own limit, from its descriptor. A frame inside it is
    // dropped rather than queued: the next one is newer.
    const auto now = std::chrono::steady_clock::now();
    if (now - device.last_sent < device.min_interval) {
      return;
    }
    const std::size_t count =
        std::min<std::size_t>(frame.lamp_count, device.colours.size());
    for (std::size_t lamp = 0; lamp < count; ++lamp) {
      device.colours[lamp] = winrt::Windows::UI::Color{
          255, frame.rgb[lamp * 3], frame.rgb[lamp * 3 + 1],
          frame.rgb[lamp * 3 + 2]};
    }
    try {
      device.lamps.SetColorsForIndices(
          winrt::array_view<const winrt::Windows::UI::Color>(
              device.colours.data(),
              device.colours.data() + count),
          winrt::array_view<const std::int32_t>(
              device.lamp_indices.data(),
              device.lamp_indices.data() + count));
      device.last_sent = now;
      state_->report_availability(device);
    } catch (const winrt::hresult_error& error) {
      state_->sink.write(JsonLine("error")
                             .text("message", "colours were refused")
                             .text("detail", winrt::to_string(error.message()))
                             .finish());
    }
    return;
  }
}

}  // namespace fluideq_lighting
