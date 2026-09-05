/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one translation unit that compiles the vendored decoders.
 *
 * They are single-header libraries: the declarations come from including the
 * header anywhere, and the implementation only from the file that defines the
 * `*_IMPLEMENTATION` macro. Two files defining it is a link full of duplicate
 * symbols, so exactly one does, and it is this one.
 *
 * Their warnings are not ours to fix. The rest of this project builds under
 * /W4 /WX, and holding twenty-three thousand lines of somebody else's public
 * domain code to that standard means either patching every release or turning
 * the flag off for the whole target — so it is turned off HERE, for these
 * three files, and nowhere else.
 *
 * Licences, each verified at the author's own repository rather than at a
 * mirror or a package index, and each also carried inside the file itself:
 *
 *   dr_mp3.h, dr_flac.h  David Reid, github.com/mackron/dr_libs
 *                        Unlicense (public domain) OR MIT-0, at our choice.
 *                        dr_mp3 derives from minimp3 by lieff, which is
 *                        CC0 1.0 — checked separately, because a derivative
 *                        cannot be more permissive than what it came from.
 *   stb_vorbis.c         Sean Barrett, github.com/nothings/stb
 *                        MIT OR public domain, at our choice.
 *
 * All three are GPL-3.0-compatible and none requires attribution. They are
 * recorded in NOTICE.md regardless: this app is sold, and "no attribution
 * required" is a permission rather than an instruction to stay quiet.
 */

#if defined(_MSC_VER)
/*
 * Four warnings the optimiser raises after the front end has finished:
 * uninitialised local (4701, 4703), unreachable code (4702) and a missing
 * return (4715). `push, 0` below does not reach them, because they are not
 * produced by the pass the level applies to; they have to be disabled by
 * number, at file scope, before any function they could fire in. Measured:
 * stb_vorbis's seek probe raised 4701 through the level-0 push, and the
 * build's answer was to take /WX off this file, which then warned about
 * overriding /WX. Both are gone with this.
 */
#pragma warning(disable : 4701 4702 4703 4715)
#pragma warning(push, 0)
#else
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wall"
#pragma GCC diagnostic ignored "-Wextra"
#endif

/**
 * No stdio in dr_flac's metadata path and no float64 anywhere we do not use.
 *
 * Every `NO_` here removes code we never call, which is smaller binary and
 * less surface. The `_ONLY_F32` pair matters more than size: the chain is
 * float end to end, and a decoder converting to s16 first would quantise a
 * 24-bit file to 16 on the way past.
 */
#define DR_MP3_IMPLEMENTATION
#define DR_MP3_ONLY_F32
#define DR_MP3_NO_STDIO_METADATA
#include "dr_mp3.h"

#define DR_FLAC_IMPLEMENTATION
#define DR_FLAC_NO_OGG
#include "dr_flac.h"

/**
 * stb_vorbis pulls in `alloca` and a pushdata API this never uses.
 *
 * `STB_VORBIS_NO_PUSHDATA_API` removes the half of the library that decodes
 * from caller-supplied chunks; the file API is what a local library needs.
 */
#define STB_VORBIS_NO_PUSHDATA_API
#define STB_VORBIS_NO_INTEGER_CONVERSION
#include "stb_vorbis.c"

#if defined(_MSC_VER)
#pragma warning(pop)
#else
#pragma GCC diagnostic pop
#endif
