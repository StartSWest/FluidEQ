/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Who this program says it is.
 *
 * One module so that renaming it is one edit. That is not tidiness for its own
 * sake: TRADEMARK.md tells anyone distributing a modified version to give it a
 * name and an icon of their own, and an instruction like that is only fair if
 * carrying it out is a small, findable job rather than a hunt through two
 * hundred files.
 *
 * WHAT DELIBERATELY DOES NOT LIVE HERE
 *
 * The `fluideq` that appears in file names, localStorage keys, DOM event names
 * and the Equalizer APO config tree is NOT branding. It is an on-disk and
 * in-storage contract with installations that already exist: `fluideq.txt` is
 * named in APO's own `config.txt`, `fluideq-<slug>-voicing.txt` is what the
 * config reader matches on, and `fluideq.locale` is where a user's language
 * already is. Routing those through a renameable constant would mean that
 * changing the display name silently orphaned every profile, every preference
 * and every APO include line on every machine — a rebrand that ate people's
 * settings. They stay spelled out where they are used.
 *
 * The translated dictionaries in `common/i18n` are the other deliberate
 * omission. There the name is inside sentences in ten languages, and pulling
 * it out into a placeholder would buy a rename at the cost of ten dictionaries
 * of interpolation that no translator asked for.
 *
 * The project's own build configuration is left alone too. It is read before
 * any of this module exists, so it cannot import it.
 */

/** The name shown to a person, everywhere one is shown. */
export const PRODUCT_NAME = 'FluidEQ';

/**
 * The shipped version, or an empty string outside the renderer.
 *
 * Substituted into the renderer bundle from the same version the installer
 * takes its own number from, so what the UI shows cannot disagree with what a
 * user actually has. Only the renderer defines it; the main process has
 * `app.getVersion()` and should use that.
 */
export const PRODUCT_VERSION = process.env.FLUIDEQ_VERSION || '';

/**
 * Windows application user model ID.
 *
 * Has to equal the `appId` in the packaging configuration, which cannot import
 * this. Two places, therefore, and this is the one the running app reads.
 */
export const APP_ID = 'com.gigabytz.fluideq';

export const AUTHOR_NAME = 'Ivan Carmenates Garcia';

/**
 * This fork's own copyright line, in the same shape as the upstream one below.
 *
 * It covers the modifications, not the whole program, and every caller says so
 * in the words around it. The work here is a modified version of somebody
 * else's GPL program; a bare copyright line over all of it would claim more
 * than is true, which is exactly the mistake this whole module exists to stop
 * anyone repeating.
 */
export const COPYRIGHT = `Copyright © 2026 ${AUTHOR_NAME}`;

/** Where the project lives, and the two places people are sent from the app. */
export const REPOSITORY_URL = 'https://github.com/StartSWest/FluidEQ';
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const LATEST_RELEASE_URL = `${REPOSITORY_URL}/releases/latest`;

/**
 * The brand mark, as geometry rather than as a component.
 *
 * A path and a viewBox travel anywhere — main process, canvas, an SVG written
 * into a file — where a React element only travels into JSX. The component
 * that renderers use is `renderer/icons/BrandMark`, and it reads this.
 */
export const BRAND_MARK = {
  viewBox: '0 0 48 48',
  /** One period of a wave: down through the middle, up, and out flat. */
  path: 'M5 24c6-13 12-13 18 0s12 13 20 0',
} as const;

/**
 * Where the licence texts sit inside an installation.
 *
 * `assets` is in the middle because that is the directory that is copied, and
 * it keeps its own name on the way in — the path is `resources/assets/…`, not
 * `resources/…`. Written down here because it is a fact a user is entitled to,
 * and one that is easy to state slightly wrong.
 */
export const LICENSE_DIR = 'resources/assets/licenses';

/** How the program is licensed, for anywhere that has to say so. */
export const LICENSE = {
  spdx: 'GPL-3.0-or-later',
  name: 'GNU General Public License, version 3 or later',
  url: 'https://www.gnu.org/licenses/gpl-3.0.html',
  /** Shipped beside the app, so the full text is readable offline. */
  path: `${LICENSE_DIR}/LICENSE.txt`,
} as const;

/**
 * The project this one is a modified version of.
 *
 * GPL-3.0 section 5(a) requires a modified work to say so prominently, and
 * NOTICE.md is where it says so at length. This is the short form, for the
 * About panel and anywhere else that has to carry the attribution.
 */
export const UPSTREAM = {
  name: 'AQUA',
  url: 'https://github.com/h39s/AQUA',
  copyright: 'Copyright © 2023 AQUA Dev Team',
} as const;

/**
 * Equalizer APO, which is bundled rather than linked.
 *
 * Two separate programs that exchange text files — see NOTICE.md. It is named
 * here because the About panel has to disclose the bundling, and because the
 * one thing a user must not conclude is that this is FluidEQ's own engine.
 */
export const BUNDLED_ENGINE = {
  name: 'Equalizer APO',
  author: 'Jonas Thedering',
  url: 'https://sourceforge.net/projects/equalizerapo/',
  license: 'GNU General Public License, version 2 or later',
  licensePath: `${LICENSE_DIR}/EqualizerAPO-LICENSE.txt`,
} as const;

/** The mark, and the one sentence that says what is not licensed with it. */
export const TRADEMARK = {
  notice: `${PRODUCT_NAME} and the ${PRODUCT_NAME} logo are marks of ${AUTHOR_NAME}.`,
  /** GPL-3.0 section 7(e) — declining to grant rights under trademark law. */
  additionalTerm:
    'Rights under trademark law to use the name or the logo are not granted. ' +
    'As an additional term under GPL-3.0 section 7(e), this declines to grant ' +
    'those rights; it restricts no right the GPL grants, and it does not apply ' +
    'to the source code. A modified version distributed to others should carry ' +
    'a name and an icon of its own.',
} as const;
