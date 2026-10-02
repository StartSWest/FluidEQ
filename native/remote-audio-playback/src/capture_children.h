/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <Windows.h>

#include <cstdint>
#include <mutex>
#include <string_view>
#include <thread>
#include <vector>

/**
 * The capture helpers this process starts as its own children.
 *
 * Share Audio both ways plays the other computer's sound here and sends this
 * computer's sound to it, and Windows can leave one process tree out of a
 * process loopback. So this process is the root of that tree: a capture for
 * the network is started with `--exclude-tree-pid` naming this process, and
 * leaves out the received sound (played here) and the second output's
 * mirrors (rendered by the local capture, a child of this one too). Without
 * it the sound came straight back to the computer that sent it.
 *
 * The children sit in a job that ends them with this process, so a capture
 * never outlives the tree it was told to leave out. Each one's end is
 * reported (`Exited`, with the id it was started under), which is how the app
 * learns of a capture that died before it ever reached the app's pipe — there
 * is nothing else to wait on for that.
 */
class CaptureChildren final {
 public:
  using Exited = void (*)(std::uint32_t id, DWORD code);
  CaptureChildren(DWORD app_pid, Exited exited);
  ~CaptureChildren();
  CaptureChildren(const CaptureChildren&) = delete;
  CaptureChildren& operator=(const CaptureChildren&) = delete;

  /** `request` is "<pipe> <token> local|lan", exactly (`capture_request_valid`). */
  HRESULT spawn(std::string_view request, std::uint32_t id);

 private:
  struct Child {
    HANDLE process;
    std::uint32_t id;
  };
  void watch();
  DWORD app_pid_;
  Exited exited_;
  HANDLE job_ = nullptr;
  HANDLE changed_ = nullptr;
  HANDLE stop_ = nullptr;
  std::mutex mutex_;
  std::vector<Child> children_;
  std::thread watcher_;
};

/** The request's shape alone, for the command loop and the tests. */
[[nodiscard]] bool capture_request_valid(std::string_view request);
