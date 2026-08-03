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
  ISupportConfig,
  buildSupportConfig,
  getBitcoinUri,
  getSupportMethods,
  isSupportAvailable,
  looksLikeBitcoinAddress,
} from 'common/support';

const config = (overrides: Partial<ISupportConfig> = {}): ISupportConfig => ({
  ...buildSupportConfig({}),
  ...overrides,
});

// Documentation addresses, not destinations: these exist only to exercise the
// shape check.
const BECH32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const P2PKH = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
const P2SH = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';

describe('support', () => {
  describe('buildSupportConfig', () => {
    // The whole point of the gate: a build whose environment sets nothing must
    // not offer a donate route, because there is nowhere safe for money to go.
    it('yields no contribution destination when the environment is empty', () => {
      const empty = buildSupportConfig({});
      expect(empty.stripeUrl).toBe('');
      expect(empty.bitcoinAddress).toBe('');
      expect(isSupportAvailable(empty)).toBe(false);
      expect(getSupportMethods(empty)).toEqual([]);
      expect(getBitcoinUri(empty)).toBe('');
    });

    it('treats unset and blank variables identically', () => {
      expect(
        buildSupportConfig({
          FLUIDEQ_STRIPE_URL: '   ',
          FLUIDEQ_BITCOIN_ADDRESS: '',
        }),
      ).toEqual(buildSupportConfig({}));
    });

    it('reads destinations from the environment and trims them', () => {
      const built = buildSupportConfig({
        FLUIDEQ_STRIPE_URL: '  https://buy.stripe.com/test_abc123  ',
        FLUIDEQ_BITCOIN_ADDRESS: `  ${BECH32} `,
        FLUIDEQ_BITCOIN_LABEL: ' Coffee fund ',
        FLUIDEQ_REPOSITORY_URL: ' https://example.invalid/repo ',
      });

      expect(built.stripeUrl).toBe('https://buy.stripe.com/test_abc123');
      expect(built.bitcoinAddress).toBe(BECH32);
      expect(built.bitcoinLabel).toBe('Coffee fund');
      expect(built.repositoryUrl).toBe('https://example.invalid/repo');
      expect(isSupportAvailable(built)).toBe(true);
    });

    it('falls back to sensible defaults for the non-payment fields', () => {
      const built = buildSupportConfig({});
      expect(built.bitcoinLabel).toBe('FluidEQ development');
      expect(built.repositoryUrl).toBe('https://github.com/StartSWest/FluidEQ');
    });
  });

  describe('looksLikeBitcoinAddress', () => {
    it('accepts the standard address forms', () => {
      expect(looksLikeBitcoinAddress(BECH32)).toBe(true);
      expect(looksLikeBitcoinAddress(P2PKH)).toBe(true);
      expect(looksLikeBitcoinAddress(P2SH)).toBe(true);
      expect(looksLikeBitcoinAddress(`  ${BECH32}  `)).toBe(true);
    });

    it('rejects placeholders and pasted junk', () => {
      expect(looksLikeBitcoinAddress('')).toBe(false);
      expect(looksLikeBitcoinAddress('   ')).toBe(false);
      expect(looksLikeBitcoinAddress('your-address-here')).toBe(false);
      expect(looksLikeBitcoinAddress('TODO')).toBe(false);
      expect(looksLikeBitcoinAddress('https://example.com/donate')).toBe(false);
      // Base58 excludes 0, O, I and l.
      expect(
        looksLikeBitcoinAddress('1BvBMSEY0tWetqTFn5Au4m4GFg7xJaNVN2'),
      ).toBe(false);
      // Too short to be an address.
      expect(looksLikeBitcoinAddress('1BvBMSEY')).toBe(false);
    });
  });

  describe('getSupportMethods', () => {
    it('offers card checkout only for a real https destination', () => {
      expect(getSupportMethods(config({ stripeUrl: 'https://' }))).toEqual([]);
      expect(getSupportMethods(config({ stripeUrl: 'not a url' }))).toEqual([]);
      // Refuses a plaintext destination: payment routing must not be
      // downgradeable in transit.
      expect(
        getSupportMethods(config({ stripeUrl: 'http://buy.stripe.com/x' })),
      ).toEqual([]);

      const methods = getSupportMethods(
        config({ stripeUrl: 'https://buy.stripe.com/test_abc123' }),
      );
      expect(methods).toHaveLength(1);
      expect(methods[0].id).toBe('stripe');
    });

    it('offers bitcoin only for an address-shaped value', () => {
      expect(
        getSupportMethods(config({ bitcoinAddress: 'coming soon' })),
      ).toEqual([]);

      const methods = getSupportMethods(config({ bitcoinAddress: BECH32 }));
      expect(methods).toHaveLength(1);
      expect(methods[0].id).toBe('bitcoin');
    });

    it('offers both when both are configured', () => {
      const methods = getSupportMethods(
        config({
          stripeUrl: 'https://buy.stripe.com/test_abc123',
          bitcoinAddress: BECH32,
        }),
      );
      expect(methods.map((method) => method.id)).toEqual(['stripe', 'bitcoin']);
      expect(isSupportAvailable(config())).toBe(false);
    });
  });

  describe('getBitcoinUri', () => {
    it('builds a BIP-21 uri with an encoded label and no amount', () => {
      expect(
        getBitcoinUri(
          config({ bitcoinAddress: BECH32, bitcoinLabel: 'FluidEQ dev' }),
        ),
      ).toBe(`bitcoin:${BECH32}?label=FluidEQ%20dev`);
    });

    it('omits the label when there is none', () => {
      expect(
        getBitcoinUri(config({ bitcoinAddress: P2PKH, bitcoinLabel: '  ' })),
      ).toBe(`bitcoin:${P2PKH}`);
    });

    it('returns nothing for an unusable address', () => {
      expect(getBitcoinUri(config({ bitcoinAddress: 'nope' }))).toBe('');
    });
  });
});
