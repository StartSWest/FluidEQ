/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { TApoConfigFiles } from 'main/deviceProfiles';
import { FLUIDEQ_CONFIG_FILENAME } from 'main/flush';

/**
 * What Equalizer APO ends up seeing, with every `Include:` followed.
 *
 * The writer spreads a device's chain over a file per feature, so no one file
 * holds a chain any more and no one string can be asserted against. This does
 * what APO does when it reads the config — splices each included file in where
 * its Include line stood — which is the thing these tests are actually about.
 */
export const expandApoConfig = (
  files: TApoConfigFiles,
  fileName: string = FLUIDEQ_CONFIG_FILENAME,
): string =>
  (files.get(fileName) ?? '')
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\s*Include:\s*(.+?)\s*$/i);
      return include ? expandApoConfig(files, include[1]) : line;
    })
    .join('\n');
