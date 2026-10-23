/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Force-included ahead of `wav.cpp`, which includes `<windows.h>` from inside
 * its own namespace. The system headers `compat/windows.h` needs have to be
 * seen at global scope first; included there for the first time, `::open`
 * and friends would be declared inside `fluideq_engine` and not exist.
 */
#ifndef FLUIDEQ_LINUX_COMPAT_WINDOWS_PRELUDE_H
#define FLUIDEQ_LINUX_COMPAT_WINDOWS_PRELUDE_H

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <cerrno>
#include <cstdint>
#include <string>

#include "wide_path.h"

#endif  // FLUIDEQ_LINUX_COMPAT_WINDOWS_PRELUDE_H
