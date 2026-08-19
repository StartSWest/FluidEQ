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
 * The canonical dictionary, assembled from one file per feature.
 *
 * English is the source of truth for two reasons: it is what the code is
 * written in, so a key with no translation yet falls back to something a
 * developer can read; and typing the other locales as `Partial<Dictionary>`
 * means adding a key here immediately tells every translator what is missing
 * without breaking the build.
 *
 * Keys are dotted and grouped by where the string appears, not by what it
 * says — `sidebar.output.title` is findable from the screen, `outputTitle`
 * is findable only from memory. The FILE a key lives in follows the same rule:
 * its first dotted segment. Before this the files were named after when their
 * keys were added, which meant one Karaoke string could be in any of four of
 * them and adding five keys touched twelve files.
 *
 * Placeholders are `{name}` and are substituted positionally by name.
 */
import karaoke from './karaoke';
import eq from './eq';
import app from './app';
import look from './look';
import video from './video';
import library from './library';

const en = {
  ...karaoke,
  ...eq,
  ...app,
  ...look,
  ...video,
  ...library,
};

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

export default en;
