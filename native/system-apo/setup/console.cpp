/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "console.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <fcntl.h>
#include <io.h>

#include <cstdio>

namespace fluideq_engine::setup {

namespace {

/** A standard handle the caller actually left us, or null. */
HANDLE inherited(DWORD which) {
  const HANDLE handle = GetStdHandle(which);
  if (handle == INVALID_HANDLE_VALUE) {
    return nullptr;
  }
  return handle;
}

/**
 * Makes one CRT stream write to the handle the caller passed down.
 *
 * The rule this file exists for: an inherited handle always wins over the
 * console. When the app runs this program through `execFile` it hands it the
 * write end of a pipe and reads the JSON back off it; reopening that stream
 * on `CONOUT$` would send the answer to a console the app cannot read and
 * leave it waiting on a pipe that never says anything. `CONOUT$` is only ever
 * used for a stream nobody handed anything down for.
 *
 * The rebind is here because a windows subsystem process is not guaranteed to
 * have its CRT streams wired to the inherited handles the way a console one
 * is — the handle can be there and `printf` still go nowhere. `_dup2` onto the
 * stream's own descriptor is what connects the two, and the whole function is
 * a no-op when the CRT already did it.
 */
void bind_to_inherited(HANDLE handle, int descriptor) {
  if (_get_osfhandle(descriptor) == reinterpret_cast<intptr_t>(handle)) {
    return;
  }
  // A duplicate rather than the handle itself: `_close` below closes whatever
  // `_open_osfhandle` was given, and closing the caller's own stdout would
  // take the pipe out from under the second stream — stdout and stderr are
  // frequently the same handle.
  HANDLE copy = nullptr;
  if (DuplicateHandle(GetCurrentProcess(), handle, GetCurrentProcess(), &copy,
                      0, FALSE, DUPLICATE_SAME_ACCESS) == 0) {
    return;
  }
  // Text mode, matching what this program's streams were while it was a
  // console program: the one line of JSON it prints has always ended in CRLF
  // and both readers of it — the app and the gate script — have only ever
  // seen that.
  const int opened =
      _open_osfhandle(reinterpret_cast<intptr_t>(copy), _O_TEXT);
  if (opened == -1) {
    CloseHandle(copy);
    return;
  }
  if (opened == descriptor) {
    return;
  }
  _dup2(opened, descriptor);
  _close(opened);
}

/** Opens one CRT stream on the console this process just attached to. */
void bind_to_console(FILE* stream) {
  FILE* reopened = nullptr;
  // The result is deliberately ignored: a stream that cannot be reopened is
  // one whose output is lost, which is where it was already going, and there
  // is nowhere left to report it to.
  (void)freopen_s(&reopened, "CONOUT$", "w", stream);
}

}  // namespace

void borrow_caller_console() {
  const HANDLE out = inherited(STD_OUTPUT_HANDLE);
  const HANDLE error = inherited(STD_ERROR_HANDLE);

  // The console is attached only for the streams nothing was handed down for.
  // `helper status > out.txt` redirects stdout and leaves stderr on the
  // shell's console, so the two are decided one at a time rather than
  // together.
  const bool attached = (out == nullptr || error == nullptr) &&
                        AttachConsole(ATTACH_PARENT_PROCESS) != 0;

  if (out != nullptr) {
    bind_to_inherited(out, 1);
  } else if (attached) {
    bind_to_console(stdout);
  }

  if (error != nullptr) {
    bind_to_inherited(error, 2);
  } else if (attached) {
    bind_to_console(stderr);
  }
}

}  // namespace fluideq_engine::setup
