/* FluidEQ — GPL-3.0-or-later */
#include "mirror_control.h"
#include <cmath>
#include <sstream>

MirrorControl::MirrorControl(std::uint32_t rate, std::uint16_t channels,
                             Reply reply)
    : rate_(rate), channels_(channels), reply_(reply) {
  event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (event_ != nullptr) {
    thread_ = CreateThread(nullptr, 0, read_commands, this, 0, nullptr);
  }
}

MirrorControl::~MirrorControl() {
  stopping_ = true;
  if (thread_ != nullptr) {
    CancelSynchronousIo(thread_);
    WaitForSingleObject(thread_, INFINITE);
    CloseHandle(thread_);
  }
  if (event_ != nullptr) { CloseHandle(event_); }
}

DWORD WINAPI MirrorControl::read_commands(void* context) {
  auto& self = *static_cast<MirrorControl*>(context);
  std::string line;
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  while (!self.stopping_) {
    char value = 0;
    DWORD read = 0;
    if (!ReadFile(input, &value, 1, &read, nullptr) || read != 1) { break; }
    if (value == '\n') {
      std::lock_guard lock(self.mutex_);
      if (self.commands_.size() >= 128) { break; }
      self.commands_.push_back(line);
      line.clear();
      SetEvent(self.event_);
    } else {
      if (line.size() >= 256) { break; }
      line += value;
    }
  }
  self.stopping_ = true;
  SetEvent(self.event_);
  return 0;
}

bool MirrorControl::commands() {
  std::deque<std::string> incoming;
  {
    std::lock_guard lock(mutex_);
    incoming.swap(commands_);
  }
  for (const auto& line : incoming) {
    std::istringstream input(line);
    std::string command;
    std::uint32_t request = 0;
    std::uint32_t id = 0;
    input >> command >> request >> id;
    HRESULT result = E_INVALIDARG;
    if (input && id != 0 && request != 0) {
      if (command == "start" && outputs_.size() < 16 && !outputs_.contains(id)) {
        std::string guid;
        std::string mode;
        float volume = 1;
        input >> guid >> mode >> volume;
        if (input && guid.size() == 38 && guid.front() == '{' &&
            guid.back() == '}' && (mode == "video" || mode == "music") &&
            std::isfinite(volume) && volume >= 0 && volume <= 1) {
          auto output = std::make_unique<MirrorOutput>();
          result = output->open(guid, rate_, channels_, mode == "video", volume);
          if (SUCCEEDED(result)) { outputs_.emplace(id, std::move(output)); }
        }
      } else if (command == "stop") {
        outputs_.erase(id);
        result = S_OK;
      } else if (command == "volume" && outputs_.contains(id)) {
        float volume = 1;
        input >> volume;
        if (input && std::isfinite(volume) && volume >= 0 && volume <= 1) {
          outputs_.at(id)->set_volume(volume);
          result = S_OK;
        }
      }
    }
    if (!reply_(3, request, result)) { return false; }
  }
  return !stopping_;
}

void MirrorControl::fail(std::uint32_t id, HRESULT result) {
  outputs_.erase(id);
  if (!reply_(4, id, result)) { stopping_ = true; }
}

void MirrorControl::push(const float* samples, std::uint32_t frames, bool silent) {
  for (auto it = outputs_.begin(); it != outputs_.end();) {
    const auto id = it->first;
    const HRESULT result = it->second->push(samples, frames, silent);
    ++it;
    if (FAILED(result)) { fail(id, result); }
  }
}

void MirrorControl::append_events(std::vector<HANDLE>& events) const {
  for (const auto& entry : outputs_) { events.push_back(entry.second->event()); }
}

void MirrorControl::render(HANDLE event) {
  for (const auto& entry : outputs_) {
    if (entry.second->event() == event) {
      const auto id = entry.first;
      const HRESULT result = entry.second->render();
      if (FAILED(result)) { fail(id, result); }
      return;
    }
  }
}
