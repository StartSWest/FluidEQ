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
 * Fix tags' rules: the file-name pattern, the text taken out of titles, the
 * capitals and the spellings to keep using — as a reader set them on the
 * old Fix page, whose panel is gone (2026-11-16), or the defaults. Kept
 * like the Library's other view choices (`libraryWorkspacePrefs.ts`); a
 * storage that refuses gives the defaults.
 */

import {
  DEFAULT_FIX_RULES,
  type IFixRules,
  type TCapitals,
} from '../../../common/library/tagFix';

const RULES_KEY = 'fluideq.library.tagFixRules';

const CAPITALS: readonly TCapitals[] = ['released', 'title', 'sentence'];

const isText = (value: unknown): value is string => typeof value === 'string';

const readFixRules = (): IFixRules => {
  try {
    const raw: unknown = JSON.parse(
      window.localStorage.getItem(RULES_KEY) ?? 'null',
    );
    if (typeof raw !== 'object' || raw === null) {
      return DEFAULT_FIX_RULES;
    }
    const saved = raw as Record<string, unknown>;
    return {
      pattern: isText(saved.pattern)
        ? saved.pattern.slice(0, 200)
        : DEFAULT_FIX_RULES.pattern,
      strip: Array.isArray(saved.strip)
        ? saved.strip.filter(isText).slice(0, 40)
        : [],
      capitals:
        CAPITALS.find((choice) => choice === saved.capitals) ?? 'released',
      spellings: Array.isArray(saved.spellings)
        ? saved.spellings
            .filter(
              (entry): entry is { from: string; to: string } =>
                typeof entry === 'object' &&
                entry !== null &&
                isText((entry as Record<string, unknown>).from) &&
                isText((entry as Record<string, unknown>).to),
            )
            .slice(0, 200)
        : [],
    };
  } catch {
    return DEFAULT_FIX_RULES;
  }
};

export default readFixRules;
