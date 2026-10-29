/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <Windows.h>
#include <avrt.h>

namespace feq::remote {
// Audio I/O drains and packet ingest join the medium Audio task. Capture and
// device render keep their existing Pro Audio task; no process is elevated.
class AudioIoTask final {
 public:
  AudioIoTask() : task_(AvSetMmThreadCharacteristicsW(L"Audio", &index_)) {}
  ~AudioIoTask() { if (task_) AvRevertMmThreadCharacteristics(task_); }
  AudioIoTask(const AudioIoTask&) = delete;
  AudioIoTask& operator=(const AudioIoTask&) = delete;
 private:
  DWORD index_ = 0;
  HANDLE task_ = nullptr;
};
}
