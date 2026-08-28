/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * stb_vorbis's declarations, without its implementation.
 *
 * The library is a `.c` file that is both header and body: including it plainly
 * compiles the whole decoder into whichever translation unit did so, and two of
 * those is a link full of duplicate symbols. `STB_VORBIS_HEADER_ONLY` is the
 * author's own switch for exactly this, and `vendor.cpp` is the one file that
 * includes it without the switch.
 */
#ifndef FLUIDEQ_STB_VORBIS_DECL_H
#define FLUIDEQ_STB_VORBIS_DECL_H

#if defined(_MSC_VER)
#pragma warning(push, 0)
#endif

#define STB_VORBIS_HEADER_ONLY
#include "stb_vorbis.c"
#undef STB_VORBIS_HEADER_ONLY

#if defined(_MSC_VER)
#pragma warning(pop)
#endif

#endif /* FLUIDEQ_STB_VORBIS_DECL_H */
