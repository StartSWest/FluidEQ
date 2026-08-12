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

import { FilterTypeEnum, IPresetV2 } from 'common/constants';
import {
  CHAIN_BUNDLE_EXTENSION,
  IChainBundle,
  chainBundleFileName,
  isSafeImportedCustomBlock,
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

  /**
   * The headphone layer travels, and the import has to carry it off the bundle.
   *
   * It did not. The handler copies fifteen preset fields onto the live state one
   * by one, and when the headphone correction became a layer this list was the
   * one of four such sites that never learned about it — so importing a chain
   * dropped the correction it was carrying while still copying the signature
   * that describes it.
   *
   * Then it went further than the session: the profile is re-saved from the
   * live state immediately afterwards, so the correct file the import had just
   * written was overwritten from a state holding the previous output's
   * correction. Importing a chain destroyed the thing it imported.
   *
   * Asserted on the field rather than on the handler because the handler needs
   * a running main process. What this pins is the half that can be pinned: the
   * bundle carries it, so a copy that omits it is losing something that arrived
   * intact.
   */
  it('carries a headphone correction through the format', () => {
    const withHeadphone: IChainBundle = {
      ...bundle,
      preset: {
        ...preset,
        headphone: {
          filters: {
            h: {
              id: 'h',
              frequency: 3000,
              gain: -5,
              quality: 1.4,
              type: FilterTypeEnum.PK,
            },
          },
          intensity: 1,
        },
      },
    };
    const read = parseChainBundle(
      JSON.parse(serializeChainBundle(withHeadphone)),
    );

    expect(read?.preset.headphone?.intensity).toBe(1);
    expect(read?.preset.headphone?.filters.h.gain).toBe(-5);
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

  it('brings the rest of a chain in when the custom block cannot come', () => {
    // A `.fluideq` is a file a stranger can send, and its custom block is
    // copied into a file Equalizer APO includes — so a `Plugin:` line in one is
    // a DLL loaded into the Windows audio pipeline by email. The tuning is
    // still just a tuning, so it arrives; the block does not.
    const read = parseChainBundle({
      version: 1,
      preset,
      custom: 'Preamp: -2 dB\r\nPlugin: evil.dll\r\n',
    });

    expect(read?.preset.preAmp).toBe(-3);
    expect(read?.preset.filters.a.frequency).toBe(1000);
    expect(isSafeImportedCustomBlock(read?.custom || '')).toBe(false);
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

describe('a custom block arriving inside a bundle', () => {
  it('refuses the two commands that reach outside the audio', () => {
    // `Plugin:` loads a DLL into the Windows audio pipeline and `Include:`
    // pulls in any other file on disk. Neither is arithmetic on the signal,
    // and a chain that needs one is not a chain anybody has to be able to send.
    expect(isSafeImportedCustomBlock('Plugin: evil.dll')).toBe(false);
    expect(isSafeImportedCustomBlock('Include: C:\\Users\\me\\evil.txt')).toBe(
      false,
    );
    // The spelling that actually loads the library: APO's own factory tests
    // `command == L"VSTPlugin"`, and there is no `Plugin` command at all.
    expect(isSafeImportedCustomBlock('VSTPlugin: Library "evil.dll"')).toBe(
      false,
    );
  });

  it('matches the way Equalizer APO matches, not the way it is usually typed', () => {
    // APO cuts a line at the first colon and trims the key — the comment on
    // that line in FilterEngine.cpp is "allow to use indentation" — so a check
    // anchored to column zero would be one space wide. Case is refused more
    // loosely than APO compares it, because a check that only catches `Plugin`
    // is a check anybody bypasses with the shift key.
    expect(isSafeImportedCustomBlock('  plugin: evil.dll')).toBe(false);
    expect(isSafeImportedCustomBlock('\tInClUdE: evil.txt')).toBe(false);
    expect(isSafeImportedCustomBlock('Preamp: -3 dB\r\n   Plugin : x')).toBe(
      false,
    );
    expect(isSafeImportedCustomBlock('Filter: ON PK Fc 100 Hz\nplugin:x')).toBe(
      false,
    );
  });

  it('refuses a control character that is not a line break or an indent', () => {
    // The same reason `isSafeConvolutionFileName` refuses them: what the
    // parser does with a NUL or an escape is not ours to reason about.
    expect(isSafeImportedCustomBlock('Preamp: -3 dB\u0000')).toBe(false);
    expect(isSafeImportedCustomBlock('Preamp: -3 dB\u001b[0m')).toBe(false);
    expect(isSafeImportedCustomBlock('Preamp: -3 dB\u007f')).toBe(false);
  });

  it('leaves an ordinary custom block exactly as it was sent', () => {
    // Everything else in the grammar is arithmetic on the audio, and carrying
    // it is the whole point of sharing a chain.
    const block = [
      '# Mine.',
      'Preamp: -4 dB',
      'Filter: ON PK Fc 120 Hz Gain -2.5 dB Q 1.20',
      'Copy: L=R R=L',
      'Delay: 5 ms',
      'Stage: post',
      'Channel: L',
      'GraphicEQ: 25 -3; 40 -2; 100 0',
      '',
    ].join('\r\n');

    expect(isSafeImportedCustomBlock(block)).toBe(true);
  });

  it('reads a command only where a command can be, so a comment survives', () => {
    // Not a nicety: the template FluidEQ writes into every custom file says
    // "Equalizer APO commands go here — Plugin:, Copy:, Delay: and the rest",
    // so a rule that matched anywhere in a line would refuse the custom block
    // of every chain this app has ever exported.
    expect(
      isSafeImportedCustomBlock('# commands go here — Plugin:, Copy:, Delay:'),
    ).toBe(true);
    // And a longer word that merely starts the same way is a different command
    // to APO, which compares the whole trimmed key.
    expect(isSafeImportedCustomBlock('Includes: 3')).toBe(true);
    expect(isSafeImportedCustomBlock('MyPlugin: 1')).toBe(true);
  });
});
