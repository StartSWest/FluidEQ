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

import {
  CRYPTO_ASSETS,
  ISupportConfig,
  buildSupportConfig,
  getBitcoinUri,
  getSupportCryptos,
  getSupportMethods,
  looksLikeBitcoinAddress,
} from 'common/support';

const config = (overrides: Partial<ISupportConfig> = {}): ISupportConfig => ({
  ...buildSupportConfig({}),
  ...overrides,
});

/** Documentation addresses only; they exercise the shape checks. */
const ADDRESSES: Record<string, string> = {
  bitcoinAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  ethereumAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  litecoinAddress: 'LhK2kQwiaAvhjWY799cZvMyYwnQAcxkarr',
  dogecoinAddress: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L',
  moneroAddress:
    '48jewbtxe4jU3MnzJFjTs3gVFWh2nRTsRJq4dPU9zjZKvAHU8N4b1a1Xm1PNMWvcYUCjTqCsWPTs1YRSjLZWpJDp4CGaCPP',
  solanaAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  cardanoAddress:
    'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x',
  tronAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
};

const withCrypto = (keys: string[]) =>
  config({
    crypto: Object.fromEntries(keys.map((key) => [key, ADDRESSES[key]])),
  });

// Documentation addresses, not destinations: these exist only to exercise the
// shape check.
const BECH32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const P2PKH = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
const P2SH = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';

describe('support', () => {
  describe('buildSupportConfig', () => {
    // The panel is always reachable, but each METHOD inside it still has to
    // earn its place: a build whose environment sets nothing offers no route
    // for money, because there is nowhere safe for it to go.
    it('yields no contribution destination when the environment is empty', () => {
      const empty = buildSupportConfig({});
      expect(empty.stripeUrl).toBe('');
      expect(empty.crypto.bitcoinAddress).toBe('');
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
        FLUIDEQ_CRYPTO_LABEL: ' Coffee fund ',
        FLUIDEQ_REPOSITORY_URL: ' https://example.invalid/repo ',
      });

      expect(built.stripeUrl).toBe('https://buy.stripe.com/test_abc123');
      expect(built.crypto.bitcoinAddress).toBe(BECH32);
      expect(built.cryptoLabel).toBe('Coffee fund');
      expect(built.repositoryUrl).toBe('https://example.invalid/repo');
      expect(getSupportMethods(built)).not.toEqual([]);
    });

    it('falls back to sensible defaults for the non-payment fields', () => {
      const built = buildSupportConfig({});
      expect(built.cryptoLabel).toBe('FluidEQ development');
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

    it('offers the coffee page only for a real https destination', () => {
      expect(
        getSupportMethods(config({ coffeeUrl: 'http://buymeacoffee.com/x' })),
      ).toEqual([]);
      const methods = getSupportMethods(
        config({ coffeeUrl: 'https://buymeacoffee.com/someone' }),
      );
      expect(methods.map((method) => method.id)).toEqual(['coffee']);
    });

    // Each chain is independent: filling one in must never imply another.
    it('offers exactly the chains that are configured', () => {
      Object.keys(ADDRESSES).forEach((key) => {
        const methods = getSupportMethods(withCrypto([key]));
        expect(methods).toHaveLength(1);
        const asset = CRYPTO_ASSETS.find((entry) => entry.configKey === key);
        expect(methods[0].id).toBe(asset?.id);
      });
    });

    it('accepts every documented address form', () => {
      const cryptos = getSupportCryptos(withCrypto(Object.keys(ADDRESSES)));
      expect(cryptos).toHaveLength(CRYPTO_ASSETS.length);
      // Shown low-friction first, in the declared order.
      expect(cryptos.map((entry) => entry.asset.id)).toEqual(
        CRYPTO_ASSETS.map((asset) => asset.id),
      );
    });

    it('rejects placeholders on every chain', () => {
      ['', '   ', 'your-address-here', 'TODO', 'https://example.com'].forEach(
        (junk) => {
          const crypto = Object.fromEntries(
            CRYPTO_ASSETS.map((asset) => [asset.configKey, junk]),
          );
          expect(getSupportCryptos(config({ crypto }))).toEqual([]);
        },
      );
    });

    it('does not accept an address belonging to another chain', () => {
      // Everything except the EVM chains, which genuinely share a format.
      const strict = CRYPTO_ASSETS.filter((asset) => asset.id !== 'ethereum');
      strict.forEach((asset) => {
        const wrong = Object.entries(ADDRESSES).find(
          ([key]) => key !== asset.configKey,
        );
        if (!wrong) {
          return;
        }
        const accepted = getSupportCryptos(
          config({ crypto: { [asset.configKey]: wrong[1] } }),
        );
        expect(accepted.map((entry) => entry.asset.id)).not.toContain(asset.id);
      });
    });

    it('names the network for each chain, since formats are shared', () => {
      getSupportMethods(withCrypto(['ethereumAddress', 'tronAddress'])).forEach(
        (method) => expect(method.description).toMatch(/mainnet/),
      );
    });
  });

  describe('getBitcoinUri', () => {
    it('builds a BIP-21 uri with an encoded label and no amount', () => {
      expect(
        getBitcoinUri(
          config({
            crypto: { bitcoinAddress: BECH32 },
            cryptoLabel: 'FluidEQ dev',
          }),
        ),
      ).toBe(`bitcoin:${BECH32}?label=FluidEQ%20dev`);
    });

    it('omits the label when there is none', () => {
      expect(
        getBitcoinUri(
          config({ crypto: { bitcoinAddress: P2PKH }, cryptoLabel: '' }),
        ),
      ).toBe(`bitcoin:${P2PKH}`);
    });

    it('returns nothing for an unusable address', () => {
      expect(
        getBitcoinUri(config({ crypto: { bitcoinAddress: 'nope' } })),
      ).toBe('');
    });

    it('has no uri for a chain without a standard scheme', () => {
      const solana = getSupportCryptos(withCrypto(['solanaAddress']))[0];
      expect(solana.uri).toBe('');
    });
  });
});
