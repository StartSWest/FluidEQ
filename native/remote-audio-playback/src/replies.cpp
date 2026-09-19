/* FluidEQ — GPL-3.0-or-later */
#include "replies.h"
namespace {
bool transfer(bool writing, void* data, std::uint32_t size) {
  auto* bytes = static_cast<unsigned char*>(data);
  const HANDLE pipe = GetStdHandle(writing ? STD_OUTPUT_HANDLE : STD_INPUT_HANDLE);
  while (size != 0) {
    DWORD done = 0;
    const BOOL ok = writing ? WriteFile(pipe, bytes, size, &done, nullptr)
                            : ReadFile(pipe, bytes, size, &done, nullptr);
    if (!ok || done == 0 || done > size) return false;
    bytes += done;
    size -= done;
  }
  return true;
}
}
bool playback_read(void* data, std::uint32_t size) { return transfer(false, data, size); }
bool playback_reply(std::uint32_t kind, std::uint32_t id, std::uint32_t result,
                    const void* data, std::uint32_t size) {
  PlaybackHeader header;
  header.kind = kind; header.id = id; header.rate = result; header.bytes = size;
  return transfer(true, &header, sizeof(header)) &&
         transfer(true, const_cast<void*>(data), size);
}
