/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "razer_devices.h"

#include <unknwn.h>
#include <winrt/Windows.Devices.Enumeration.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.h>

#include <map>
#include <mutex>
#include <set>
#include <string>
#include <vector>

#include "json_text.h"

namespace fluideq_lighting {

namespace {

using winrt::Windows::Devices::Enumeration::DeviceInformation;
using winrt::Windows::Devices::Enumeration::DeviceInformationKind;
using winrt::Windows::Devices::Enumeration::DeviceInformationUpdate;
using winrt::Windows::Devices::Enumeration::DeviceWatcher;
using winrt::Windows::Devices::Enumeration::DeviceWatcherStatus;

constexpr wchar_t kContainerIdProperty[] = L"System.Devices.ContainerId";
constexpr wchar_t kInstanceIdProperty[] = L"System.Devices.DeviceInstanceId";
constexpr wchar_t kProductIdProperty[] = L"System.DeviceInterface.Hid.ProductId";

// Every enabled HID interface from Razer's USB vendor id, 0x1532.
constexpr wchar_t kRazerHidSelector[] =
    L"System.Devices.InterfaceClassGuid:=\"{4D1E55B2-F16F-11CF-88CB-001111000030}\""
    L" AND System.DeviceInterface.Hid.VendorId:=5426"
    L" AND System.Devices.InterfaceEnabled:=System.StructuredQueryType.Boolean#True";

std::wstring property_text(const DeviceInformation& info, const wchar_t* key) {
  const auto value = info.Properties().TryLookup(key);
  if (!value) {
    return {};
  }
  if (const auto text = value.try_as<winrt::Windows::Foundation::IReference<winrt::hstring>>()) {
    return std::wstring(text.Value());
  }
  if (const auto guid = value.try_as<winrt::Windows::Foundation::IReference<winrt::guid>>()) {
    return std::wstring(winrt::to_hstring(guid.Value()));
  }
  return {};
}

bool is_razer_name(const std::string& name) {
  return name.rfind("Razer ", 0) == 0;
}

}  // namespace

struct RazerDevices::State : std::enable_shared_from_this<RazerDevices::State> {
  struct Container {
    std::set<std::wstring> interfaces;
    std::int64_t product = 0;
    // Every product id among its interfaces. One product can carry several —
    // a Base Station V2 Chroma is 0F20 for its lights and 48F0 for its media
    // keys — and whichever Windows lists first says nothing about which is
    // the lit one.
    std::set<std::int64_t> products;
    std::size_t reported_products = 0;
    // What Windows calls the container, and the best product name any of its
    // device nodes carries. The two differ more than expected: a DeathStalker
    // V2 Pro's container is "DSV2Pro TKL", while Razer's driver names one of
    // its collections "Razer DeathStalker V2 Pro Tenkeyless".
    std::string container_name;
    std::string device_name;
    std::string reported;
  };

  explicit State(EventSink& events) : sink(events) {}

  EventSink& sink;
  std::mutex mutex;
  bool stopped = false;
  DeviceWatcher watcher{nullptr};
  std::map<std::wstring, std::wstring> container_of_interface;
  std::map<std::wstring, Container> containers;

  // Called with the lock held. Reports the container again whenever its best
  // name improves or another of its product ids arrives; the main process
  // treats every report as an upsert.
  void report(const std::wstring& id, Container& container) {
    std::string name = container.device_name;
    if (name.empty() || (!is_razer_name(name) && is_razer_name(container.container_name))) {
      name = container.container_name;
    }
    if (name.empty() || (name == container.reported &&
                         container.products.size() == container.reported_products)) {
      return;
    }
    container.reported = name;
    container.reported_products = container.products.size();
    sink.write(JsonLine("razer")
                   .text("container", winrt::to_string(id))
                   .text("name", name)
                   .integer("productId", container.product)
                   .integers("productIds",
                             std::vector<std::int64_t>(container.products.begin(),
                                                       container.products.end()))
                   .finish());
  }

  void named(const std::wstring& id, const std::string& name, bool is_container) {
    const std::scoped_lock lock(mutex);
    const auto found = containers.find(id);
    if (stopped || found == containers.end() || name.empty()) {
      return;
    }
    if (is_container) {
      found->second.container_name = name;
    } else if (is_razer_name(name) &&
               (!is_razer_name(found->second.device_name) ||
                name.size() > found->second.device_name.size())) {
      // The longest Razer-named node: "Razer DeathStalker V2 Pro Tenkeyless"
      // over a collection called just "Razer Control".
      found->second.device_name = name;
    }
    report(id, found->second);
  }

  void resolve(const std::wstring& container_id, const std::wstring& lookup,
               DeviceInformationKind kind, bool is_container) {
    // Resolved from the operation's completion rather than by blocking in the
    // watcher's callback, for the reason given beside `LampArrays::added`.
    DeviceInformation::CreateFromIdAsync(winrt::hstring(lookup), {}, kind)
        .Completed([self = shared_from_this(), container_id, is_container](
                       const auto& operation, const auto status) {
          if (status != winrt::Windows::Foundation::AsyncStatus::Completed) {
            return;
          }
          const auto device = operation.GetResults();
          if (device) {
            self->named(container_id, winrt::to_string(device.Name()),
                        is_container);
          }
        });
  }

  void enumerated() {
    const std::scoped_lock lock(mutex);
    if (!stopped) {
      sink.write(JsonLine("enumerated").text("source", "razer").finish());
    }
  }

  void added(const DeviceInformation& info) {
    const std::wstring container_id = property_text(info, kContainerIdProperty);
    if (container_id.empty()) {
      return;
    }
    const std::wstring instance_id = property_text(info, kInstanceIdProperty);
    std::int64_t product = 0;
    if (const auto value = info.Properties().TryLookup(kProductIdProperty)) {
      if (const auto number =
              value.try_as<winrt::Windows::Foundation::IReference<std::uint16_t>>()) {
        product = number.Value();
      }
    }

    bool first = false;
    {
      const std::scoped_lock lock(mutex);
      if (stopped) {
        return;
      }
      container_of_interface[std::wstring(info.Id())] = container_id;
      auto& container = containers[container_id];
      first = container.interfaces.empty();
      container.interfaces.insert(std::wstring(info.Id()));
      if (container.product == 0) {
        container.product = product;
      }
      if (product != 0 && container.products.insert(product).second &&
          !container.reported.empty()) {
        report(container_id, container);
      }
    }
    try {
      if (first) {
        resolve(container_id, container_id, DeviceInformationKind::DeviceContainer, true);
      }
      if (!instance_id.empty()) {
        resolve(container_id, instance_id, DeviceInformationKind::Device, false);
      }
    } catch (const winrt::hresult_error&) {
      // A device unplugged between the watcher seeing it and the lookup; the
      // removal follows.
      return;
    }
  }

  void removed(const DeviceInformationUpdate& update) {
    const std::scoped_lock lock(mutex);
    if (stopped) {
      return;
    }
    const auto found = container_of_interface.find(std::wstring(update.Id()));
    if (found == container_of_interface.end()) {
      return;
    }
    const std::wstring container_id = found->second;
    container_of_interface.erase(found);
    const auto container = containers.find(container_id);
    if (container == containers.end()) {
      return;
    }
    container->second.interfaces.erase(std::wstring(update.Id()));
    if (container->second.interfaces.empty()) {
      const bool was_reported = !container->second.reported.empty();
      containers.erase(container);
      if (was_reported) {
        sink.write(JsonLine("razer-removed")
                       .text("container", winrt::to_string(container_id))
                       .finish());
      }
    }
  }
};

RazerDevices::RazerDevices(EventSink& sink)
    : state_(std::make_shared<State>(sink)) {}

RazerDevices::~RazerDevices() { stop(); }

void RazerDevices::start() {
  auto properties = winrt::single_threaded_vector<winrt::hstring>(
      {winrt::hstring(kContainerIdProperty), winrt::hstring(kInstanceIdProperty),
       winrt::hstring(kProductIdProperty)});
  state_->watcher = DeviceInformation::CreateWatcher(kRazerHidSelector, properties);
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

void RazerDevices::stop() {
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
  }
  if (watcher) {
    const auto status = watcher.Status();
    if (status == DeviceWatcherStatus::Started ||
        status == DeviceWatcherStatus::EnumerationCompleted) {
      watcher.Stop();
    }
  }
}

}  // namespace fluideq_lighting
