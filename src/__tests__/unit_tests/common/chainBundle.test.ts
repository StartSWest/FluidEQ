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

import { FilterTypeEnum, IPresetV2 } from 'common/constants';
import {
  CHAIN_BUNDLE_EXTENSION,
  IChainBundle,
  chainBundleFileName,
  parseChainBundle,
  serializeChainBundle,
} from 'common/chainBundle';

const preset: IPresetV2 = {
  preAmp: -3,
  filters: {
    a: {
      id: 'a',
      frequency: 1000,
      gain: 4,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
};

const bundle: IChainBundle = {
  version: 1,
  exportedFrom: 'Headphones',
  exportedAt: '2026-08-07T00:00:00.000Z',
  preset,
  custom: 'Preamp: -1 dB\r\n',
};

describe('a chain bundle', () => {
  it('survives a round trip', () => {
    const read = parseChainBundle(JSON.parse(serializeChainBundle(bundle)));

    expect(read?.preset.preAmp).toBe(-3);
    expect(read?.preset.filters.a.frequency).toBe(1000);
    expect(read?.custom).toBe('Preamp: -1 dB\r\n');
    expect(read?.exportedFrom).toBe('Headphones');
  });

  it('carries the custom file, which is the one part that cannot be rebuilt', () => {
    // Everything else in a chain is generated from the preset at the far end.
    // This file is not, so if it does not travel it is simply gone.
    expect(
      parseChainBundle(JSON.parse(serializeChainBundle(bundle)))?.custom,
    ).toBeDefined();
    expect(parseChainBundle({ version: 1, preset })?.custom).toBeUndefined();
  });

  it('refuses anything that is not a chain, rather than repairing it', () => {
    // Half a chain reaching Equalizer APO is worse than none of it, and the
    // caller can say "that is not a FluidEQ chain" where it could say nothing
    // useful about one quietly mended into something the sender never had.
    expect(parseChainBundle(undefined)).toBeUndefined();
    expect(parseChainBundle('chain')).toBeUndefined();
    expect(parseChainBundle({})).toBeUndefined();
    expect(parseChainBundle({ version: 2, preset })).toBeUndefined();
    expect(parseChainBundle({ version: 1 })).toBeUndefined();
    expect(
      parseChainBundle({ version: 1, preset: { preAmp: 'loud' } }),
    ).toBeUndefined();
  });

  it('ignores a label that is not a string rather than carrying it through', () => {
    const read = parseChainBundle({
      version: 1,
      preset,
      exportedFrom: 7,
      custom: 12,
    });

    expect(read).toBeDefined();
    expect(read?.exportedFrom).toBeUndefined();
    expect(read?.custom).toBeUndefined();
  });

  it('builds a file name Windows will accept from an output name', () => {
    // Real endpoint names are full of characters a filename may not carry.
    expect(chainBundleFileName('Speakers (Realtek(R) Audio)')).toBe(
      `Speakers (Realtek(R) Audio).${CHAIN_BUNDLE_EXTENSION}`,
    );
    expect(chainBundleFileName('Line In / Out: 1')).toBe(
      `Line In Out 1.${CHAIN_BUNDLE_EXTENSION}`,
    );
    expect(chainBundleFileName('   ')).toBe(
      `FluidEQ chain.${CHAIN_BUNDLE_EXTENSION}`,
    );
  });
});
