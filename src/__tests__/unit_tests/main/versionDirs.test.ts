/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `newestVersionDir` backs the Visual Studio toolset and redistributable
 * directory picks in the native DSP build script. A lexicographic sort was
 * picking `"14.9.1"` over `"14.10.2"` (string comparison, not numeric) and
 * a non-version name such as `"v145"` over every real version (it sorts
 * after every `14.x.y` name). These cases pin the numeric, segment-by-segment
 * comparison that replaced it.
 */

import { newestVersionDir } from '../../../../.erb/scripts/versionDirs';

describe('newestVersionDir', () => {
  it('picks the numerically greatest version, ignoring non-version and junk names', () => {
    expect(newestVersionDir(['14.9.1', '14.10.2', 'v145', 'junk'])).toBe(
      '14.10.2',
    );
  });

  it('compares every segment numerically, not lexicographically', () => {
    expect(newestVersionDir(['14.51.36231', '14.44.35207'])).toBe(
      '14.51.36231',
    );
  });

  it('returns undefined when nothing matches a version pattern', () => {
    expect(newestVersionDir(['v145'])).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(newestVersionDir([])).toBeUndefined();
  });
});
