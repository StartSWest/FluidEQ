/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  featureTourDismissal,
  shouldShowFeatureTour,
} from 'common/featureTour';

describe('remembering the feature tour by its content', () => {
  it.each([
    ['2.1.1', '2.1.0'],
    ['2.1.9', '2.1.4'],
    ['2.2.1', '2.2.0'],
  ])('does not reopen %s after a legacy %s dismissal', (version, legacy) => {
    expect(shouldShowFeatureTour(version, legacy)).toBe(false);
    // The same installed version must still introduce genuinely new content.
    expect(shouldShowFeatureTour(version, '2.0.0')).toBe(true);
  });

  it('introduces 2.2 after a 2.1 dismissal, then stays dismissed across patches', () => {
    expect(shouldShowFeatureTour('2.2.0', '2.1.9')).toBe(true);
    const remembered = featureTourDismissal('2.2.0', true);
    expect(remembered).toBe('2.2');
    expect(shouldShowFeatureTour('2.2.0', remembered)).toBe(false);
    expect(shouldShowFeatureTour('2.2.4', remembered)).toBe(false);
    expect(shouldShowFeatureTour('3.0.0', remembered)).toBe(true);
  });

  it('remembers the same key when the checkbox is ticked on a patch version', () => {
    expect(featureTourDismissal('2.2.7', true)).toBe('2.2');
    expect(shouldShowFeatureTour('2.2.8', '2.2')).toBe(false);
  });

  it('still treats an unticked close as not now and an unknown version as silent', () => {
    const remembered = featureTourDismissal('2.2.1', false);
    expect(remembered).toBeNull();
    expect(shouldShowFeatureTour('2.2.1', remembered)).toBe(true);
    expect(shouldShowFeatureTour('', remembered)).toBe(false);
  });
});
