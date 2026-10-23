/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * The page fluideq.com keeps for a headphone in the OPRA library: every
 * correction drawn, credited to who made and measured it, and given as
 * Equalizer APO settings.
 *
 * The site addresses a page by its brand's and model's slugs and nothing
 * else, and merges listings whose names make the same address, so this is
 * computed from the names the picker already shows, with no list of pages to
 * keep in step. `slugOf` is the site's own (FluidEQ-Site scripts/headphones.mjs)
 * and must stay identical to it: headphonePage.test.ts holds both to the same
 * names and slugs, and a change on either side without the other sends the
 * link to a page that does not exist.
 */

const SITE = 'https://fluideq.com';

/** Lowercase, accents dropped, `+` spelled out, anything else a hyphen. */
export const slugOf = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

export const headphonePageUrl = (vendor: string, name: string): string =>
  `${SITE}/headphones/${slugOf(vendor)}/${slugOf(name)}`;
