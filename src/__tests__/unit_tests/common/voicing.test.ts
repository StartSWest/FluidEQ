/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import {
  MAX_GAIN,
  MIN_GAIN,
  NO_GAIN_FILTER_TYPES,
  clampFrequency,
} from 'common/constants';
import {
  VOICING_PROFILES,
  getVoicingFilters,
  getVoicingProfile,
  isVoicingActive,
} from 'common/voicing';

/**
 * Every profile, held to the things that have to be true of all of them.
 *
 * Written after a genre was added and silently did nothing. The renderer listed
 * it, the picker offered it, and the main process — which validates the id
 * against its own call to `getVoicingProfile` — refused it as an invalid
 * parameter, because that process was still running an older bundle. The quick
 * pick reverts on failure and swallows the error, so from the outside the entry
 * simply could not be selected.
 *
 * A stale process is not something a test can catch. What it can catch is the
 * shape of the mistake: a profile that exists in the list but cannot survive the
 * round trip through the checks every layer is put through. Anything added to
 * `VOICING_PROFILES` is now held to that automatically.
 */
describe('voicing profiles', () => {
  it('has both groups, and every profile is in one of them', () => {
    const groups = new Set(VOICING_PROFILES.map((profile) => profile.group));

    expect(groups).toEqual(new Set(['purpose', 'genre']));
  });

  it('keeps each group contiguous, so one heading covers all of it', () => {
    // The pickers emit a heading wherever the group changes. Interleaved
    // entries would produce a second "Genre" heading part-way down the list.
    const changes = VOICING_PROFILES.filter(
      (profile, index) => profile.group !== VOICING_PROFILES[index - 1]?.group,
    );

    expect(changes).toHaveLength(2);
  });

  it('mints unique ids', () => {
    const ids = VOICING_PROFILES.map((profile) => profile.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can be found by id, which is what the main process checks', () => {
    // The exact call `SET_VOICING` makes before accepting a profile. A profile
    // this returns nothing for is one the app will refuse to apply.
    VOICING_PROFILES.forEach((profile) => {
      expect(getVoicingProfile(profile.id)?.id).toBe(profile.id);
    });
  });

  it('produces filters Equalizer APO can actually write', () => {
    VOICING_PROFILES.forEach((profile) => {
      const filters = getVoicingFilters({
        profileId: profile.id,
        intensity: 1,
      });

      expect(filters.length).toBeGreaterThan(0);
      filters.forEach((filter) => {
        expect(Number.isFinite(filter.frequency)).toBe(true);
        expect(filter.frequency).toBe(clampFrequency(filter.frequency));
        expect(Number.isFinite(filter.quality)).toBe(true);
        expect(filter.quality).toBeGreaterThan(0);
        expect(filter.reason).toBeTruthy();
      });

      // Split out rather than guarded inside the loop above: a gainless type
      // carries no gain to check, and asserting conditionally hides a filter
      // list that accidentally contains none of the kind being tested.
      filters
        .filter((filter) => !NO_GAIN_FILTER_TYPES.includes(filter.type))
        .forEach((filter) => {
          expect(filter.gain).toBeGreaterThanOrEqual(MIN_GAIN);
          expect(filter.gain).toBeLessThanOrEqual(MAX_GAIN);
        });
    });
  });

  it('is describable — every profile has a name and a tagline', () => {
    // Both are shown in the picker. A blank one is an entry nobody can choose
    // on purpose.
    VOICING_PROFILES.forEach((profile) => {
      expect(profile.name.trim()).not.toBe('');
      expect(profile.tagline.trim()).not.toBe('');
    });
  });

  describe('whether one is actually shaping the sound', () => {
    it('says no to nothing chosen, and no to a profile that does not exist', () => {
      expect(isVoicingActive(undefined)).toBe(false);
      expect(isVoicingActive({ profileId: '', intensity: 1 })).toBe(false);
      expect(isVoicingActive({ profileId: 'nonsense', intensity: 1 })).toBe(
        false,
      );
    });

    it('says no at zero strength, however definite the choice', () => {
      // The bug this exists for: Smart EQ read the id alone, so a voicing at 0%
      // counted as a named curve. It contributed nothing to the sound and
      // Target dropped its own built-in shape as though something had replaced
      // it, leaving the record on a bare tilt with neither curve on it.
      VOICING_PROFILES.forEach((profile) => {
        expect(isVoicingActive({ profileId: profile.id, intensity: 0 })).toBe(
          false,
        );
        expect(isVoicingActive({ profileId: profile.id, intensity: 1 })).toBe(
          true,
        );
      });
    });

    it('agrees with whether any filters are actually written', () => {
      // The two must not be able to disagree: one decides what reaches
      // Equalizer APO, the other decides what Smart EQ aims at.
      VOICING_PROFILES.forEach((profile) => {
        [0, 0.5, 1].forEach((intensity) => {
          const settings = { profileId: profile.id, intensity };
          expect(isVoicingActive(settings)).toBe(
            getVoicingFilters(settings).length > 0,
          );
        });
      });
    });
  });

  it('stays inside the headroom a voicing is allowed to ask for', () => {
    // A layer that stacks on the user's own bands and on Smart EQ. Any one of
    // these asking for a large boost is how a chain ends up needing more preamp
    // than the format has.
    VOICING_PROFILES.forEach((profile) => {
      const peak = getVoicingFilters({
        profileId: profile.id,
        intensity: 1,
      }).reduce((highest, filter) => Math.max(highest, filter.gain), 0);

      expect(peak).toBeLessThanOrEqual(6);
    });
  });
});
