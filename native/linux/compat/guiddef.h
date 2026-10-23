/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `GUID` for the shared engine's `log.h`, which declares `guid_text` over it.
 * The Linux engine names outputs by text and never builds one; the type only
 * has to exist for that header to be the same header on both systems.
 */
#ifndef FLUIDEQ_LINUX_COMPAT_GUIDDEF_H
#define FLUIDEQ_LINUX_COMPAT_GUIDDEF_H

#if !defined(__linux__)
#error "compat/guiddef.h is the Linux engine's stand-in and must not be used elsewhere"
#endif

#include <cstdint>

struct GUID {
  uint32_t Data1;
  uint16_t Data2;
  uint16_t Data3;
  uint8_t Data4[8];
};

#endif  // FLUIDEQ_LINUX_COMPAT_GUIDDEF_H
