/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether a preset can be shared as a link or to the community. Off for
 * 2.6 (Ivan, 2026-11-23: "I don't want to build the community preset just
 * yet, that will go in release 2.7"; "oculta compartir presets"): no Share
 * to the community, no Copy share link, no short link in the export, and
 * the tile's quick action opens the export instead. Export, Import and a
 * link someone pastes or opens still work: the server's short links are
 * live (0116), so an older link keeps resolving.
 *
 * Turned on for 2.7 together with the site's preset page, which is not
 * published yet: a short link made now would open a page that is not there.
 */
const PRESET_LINKS_OPEN = false;

export default PRESET_LINKS_OPEN;
