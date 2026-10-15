/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { headphonePageUrl, slugOf } from '../../../common/headphonePage';

/*
 * Each slug here is what the site's own slugOf (FluidEQ-Site
 * scripts/headphones.mjs) returns for the name, printed from it on
 * 2026-10-15. The picker's "on fluideq.com" link is only right while the two
 * agree, so a change to either function has to change both and this list.
 */
const SITE_SLUGS: Array<[string, string]> = [
  ['Sennheiser', 'sennheiser'],
  ['HD 600', 'hd-600'],
  ['RØDE', 'r-de'],
  ['Bang & Olufsen', 'bang-olufsen'],
  ['Aurvana Live!2', 'aurvana-live-2'],
  ['Aurvana Live! 2', 'aurvana-live-2'],
  ['HE90 "Orpheus"', 'he90-orpheus'],
  ['Moondrop x Crinacle DUSK', 'moondrop-x-crinacle-dusk'],
  ['ATH-M50x', 'ath-m50x'],
  ['Beyerdynamic DT 770 Pro (80 Ω)', 'beyerdynamic-dt-770-pro-80'],
  ['Shure SE215+', 'shure-se215-plus'],
  ['Etymōtic ER2XR', 'etymotic-er2xr'],
  ['iBasso IT00', 'ibasso-it00'],
  ['64 Audio U12t', '64-audio-u12t'],
];

describe('the fluideq.com page for an OPRA headphone', () => {
  it.each(SITE_SLUGS)('slugs %p as the site does', (name, slug) => {
    expect(slugOf(name)).toBe(slug);
  });

  it('builds the address from the brand and the model', () => {
    expect(headphonePageUrl('Sennheiser', 'HD 600')).toBe(
      'https://fluideq.com/headphones/sennheiser/hd-600',
    );
  });

  it('sends two spellings of one headphone to the one merged page', () => {
    expect(headphonePageUrl('Creative', 'Aurvana Live!2')).toBe(
      headphonePageUrl('Creative', 'Aurvana Live! 2'),
    );
  });
});
