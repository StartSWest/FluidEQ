/* FluidEQ — GPL-3.0-or-later */
/**
 * The engine has to build to the same bytes in any folder.
 *
 * The app offers an engine update whenever the installed DLL's bytes differ
 * from the ones it ships (`engineUpdate.ts`), so an engine that builds
 * differently from one folder to the next is offered with every release for
 * nothing. `/Brepro` takes the link's time out of the file; this holds the
 * other way a build's surroundings get in. MSVC names an anonymous namespace
 * `?A0x<hash>`, hashing the source file's path, and the name reaches the
 * binary wherever a type inside one is kept by name — a lambda handed to
 * `std::shared_ptr` as its deleter, whose type descriptor the control block
 * holds. One did (the voice model's file handle, 2026-10-03), and the same
 * sources built in two folders differed in 56 bytes.
 *
 * Positive control: this executable carries such a name on purpose, built
 * with the same flags, and the same search has to find it here.
 */
#include <cstdio>
#include <fstream>
#include <iterator>
#include <memory>
#include <string>

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    ++failures;
    std::printf("  FAIL %s\n", what);
  }
}

std::string read_file(const std::wstring& path) {
  std::ifstream in(path, std::ios::binary);
  return std::string(std::istreambuf_iterator<char>(in),
                     std::istreambuf_iterator<char>());
}

/** Where a path-hashed anonymous namespace is named in `bytes`, if anywhere. */
size_t anonymous_name(const std::string& bytes) {
  for (size_t at = bytes.find("?A0x"); at != std::string::npos;
       at = bytes.find("?A0x", at + 1)) {
    bool hex = at + 12 <= bytes.size();
    for (size_t i = at + 4; hex && i < at + 12; ++i) {
      const char c = bytes[i];
      hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
    }
    if (hex) return at;
  }
  return std::string::npos;
}

// The positive control's own deleter, in an anonymous namespace as the
// engine's was.
std::shared_ptr<void> held_by_lambda() {
  return std::shared_ptr<void>(new int(7),
                               [](void* p) { delete static_cast<int*>(p); });
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  if (argc != 2) {
    std::printf("usage: fluideq-engine-repro-test <FluidEQ-Engine.dll>\n");
    return 2;
  }
  const auto control = held_by_lambda();
  check(control != nullptr, "the control's pointer exists");

  wchar_t self[MAX_PATH]{};
  check(GetModuleFileNameW(nullptr, self, MAX_PATH) != 0, "own path");
  const std::string own = read_file(self);
  check(own.size() > 4096, "read this executable");
  check(anonymous_name(own) != std::string::npos,
        "finds the control's anonymous namespace in this executable");

  const std::string engine = read_file(argv[1]);
  check(engine.size() > 4096, "read the engine");
  const size_t at = anonymous_name(engine);
  if (at != std::string::npos) {
    // Print what names it, so the type to move out is plain.
    size_t from = at;
    while (from > 0 && engine[from - 1] >= 0x20 && engine[from - 1] < 0x7f &&
           at - from < 120) {
      --from;
    }
    std::printf("  the engine names a path-hashed namespace: %s\n",
                engine.substr(from, at - from + 40).c_str());
  }
  check(at == std::string::npos,
        "the engine carries no name that depends on its build folder");

  std::printf("%s\n", failures == 0 ? "all checks passed"
                                    : "some checks failed");
  return failures == 0 ? 0 : 1;
}
