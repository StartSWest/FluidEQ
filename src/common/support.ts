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

/**
 * Optional "support the work" configuration.
 *
 * FluidEQ is GPLv3 and every feature is free. Contributing is a thank-you, not
 * a purchase: nothing in the app is gated behind it and the app never asks
 * twice on its own.
 *
 * Every destination comes from a build-time environment variable (see
 * .env.example), never from a committed literal. Two reasons: a payment
 * destination is per-maintainer rather than per-project, and a wrong crypto
 * address sends money to a stranger with no way to recover it — so a fork that
 * forgets to set its own must offer NO route for money rather than inherit
 * somebody else's. Everything defaults to empty and each method stays hidden
 * until its destination validates.
 *
 * The panel itself is not gated on any of that. It is where the release notes,
 * the repository link and the game live as well, and those need no destination
 * — an unconfigured build hiding the whole thing meant a checkout without a
 * .env had no creature in the titlebar and no way in from the menu at all.
 */

import { PRODUCT_NAME, REPOSITORY_URL } from './branding';

/**
 * Where the "already contributed" flag lives.
 *
 * Spelled out rather than built from the product name: it is a key in a user's
 * existing localStorage, and a rebrand that renamed it would quietly forget who
 * had already contributed.
 *
 * A hosted checkout opens in the browser and a crypto transfer happens on a
 * chain, so the app genuinely cannot tell whether anyone paid. The flag is
 * therefore self-declared and unlocks a reward only — nothing is ever taken
 * away, so there is no incentive to lie and no cost when someone does.
 */
export const SUPPORT_CONTRIBUTED_KEY = 'fluideq.hasContributed';

export type SupportMethodId =
  | 'stripe'
  | 'coffee'
  | 'bitcoin'
  | 'ethereum'
  | 'litecoin'
  | 'dogecoin'
  | 'monero'
  | 'solana'
  | 'cardano'
  | 'tron';

/** A chain whose address is validated only by shape, never by checksum. */
export interface ICryptoAsset {
  id: SupportMethodId;
  /** Ticker shown to the donor. */
  symbol: string;
  name: string;
  /** Extra guidance where sending to the wrong network loses the funds. */
  network: string;
  /** Shape check. Deliberately not full validation — that belongs in a wallet. */
  pattern: RegExp;
  /** BIP-21 style URI scheme, when the chain has a widely supported one. */
  uriScheme?: string;
  /** Key in ISupportConfig.crypto. */
  configKey: string;
}

/**
 * The chains offered, in the order they are shown.
 *
 * Patterns are conservative shape checks: they reject placeholders, pasted
 * URLs and obviously truncated strings, and nothing more. Checksum validation
 * (base58, bech32, EIP-55, CRC) is a wallet's job — the meaningful protection
 * here is that an unset value shows no option at all.
 */
export const CRYPTO_ASSETS: ICryptoAsset[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin mainnet',
    // bech32/bech32m (bc1...) and legacy base58 (1... / 3...).
    pattern: /^(bc1[02-9ac-hj-np-z]{7,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
    uriScheme: 'bitcoin',
    configKey: 'bitcoinAddress',
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    // The same address format is used by every EVM chain, so the network
    // matters more here than anywhere else on this list.
    network: 'Ethereum mainnet (ERC-20)',
    pattern: /^0x[0-9a-fA-F]{40}$/,
    uriScheme: 'ethereum',
    configKey: 'ethereumAddress',
  },
  {
    id: 'litecoin',
    symbol: 'LTC',
    name: 'Litecoin',
    network: 'Litecoin mainnet',
    pattern: /^(ltc1[02-9ac-hj-np-z]{7,71}|[LM3][1-9A-HJ-NP-Za-km-z]{25,34})$/,
    uriScheme: 'litecoin',
    configKey: 'litecoinAddress',
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    network: 'Dogecoin mainnet',
    pattern: /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/,
    uriScheme: 'dogecoin',
    configKey: 'dogecoinAddress',
  },
  {
    id: 'monero',
    symbol: 'XMR',
    name: 'Monero',
    network: 'Monero mainnet',
    pattern: /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,
    uriScheme: 'monero',
    configKey: 'moneroAddress',
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    network: 'Solana mainnet',
    pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    configKey: 'solanaAddress',
  },
  {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    network: 'Cardano mainnet (Shelley)',
    pattern: /^addr1[02-9ac-hj-np-z]{20,110}$/,
    configKey: 'cardanoAddress',
  },
  {
    id: 'tron',
    symbol: 'TRX',
    name: 'Tron',
    network: 'Tron mainnet (TRC-20)',
    pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    configKey: 'tronAddress',
  },
];

export interface ISupportConfig {
  /**
   * A Stripe Payment Link (https://buy.stripe.com/...) or Stripe-hosted
   * donation page. Payment Links need no server and no keys in the client,
   * which is why they are the right fit here: the app only ever opens a URL.
   */
  stripeUrl: string;
  /** A Buy Me a Coffee page (https://buymeacoffee.com/...) or Ko-fi. */
  coffeeUrl: string;
  /** Address per chain, keyed by ICryptoAsset.configKey. */
  crypto: Record<string, string>;
  /** Shown next to an address so a donor can confirm where it goes. */
  cryptoLabel: string;
  /** Where the code lives, for people who would rather contribute time. */
  repositoryUrl: string;
  /**
   * Where a stranger goes to get the app.
   *
   * Separate from the repository because they are two different invitations.
   * A share post is read by people who have never seen FluidEQ, and sending
   * them to a source tree asks them to work out how to build it; the releases
   * page hands them an installer. Defaults to the repository's own releases
   * page, so a fork that sets only `FLUIDEQ_REPOSITORY_URL` still gets a
   * working download link rather than none.
   */
  downloadUrl: string;
}

export interface ISupportEnv {
  FLUIDEQ_STRIPE_URL?: string;
  FLUIDEQ_COFFEE_URL?: string;
  FLUIDEQ_BITCOIN_ADDRESS?: string;
  FLUIDEQ_ETHEREUM_ADDRESS?: string;
  FLUIDEQ_LITECOIN_ADDRESS?: string;
  FLUIDEQ_DOGECOIN_ADDRESS?: string;
  FLUIDEQ_MONERO_ADDRESS?: string;
  FLUIDEQ_SOLANA_ADDRESS?: string;
  FLUIDEQ_CARDANO_ADDRESS?: string;
  FLUIDEQ_TRON_ADDRESS?: string;
  FLUIDEQ_CRYPTO_LABEL?: string;
  FLUIDEQ_REPOSITORY_URL?: string;
  FLUIDEQ_DOWNLOAD_URL?: string;
}

const DEFAULT_CRYPTO_LABEL = `${PRODUCT_NAME} development`;
const DEFAULT_REPOSITORY_URL = REPOSITORY_URL;

const clean = (value: string | undefined) => (value || '').trim();

/** Pure so the gating can be tested without touching the real environment. */
export const buildSupportConfig = (env: ISupportEnv): ISupportConfig => {
  const repositoryUrl =
    clean(env.FLUIDEQ_REPOSITORY_URL) || DEFAULT_REPOSITORY_URL;
  return {
    stripeUrl: clean(env.FLUIDEQ_STRIPE_URL),
    coffeeUrl: clean(env.FLUIDEQ_COFFEE_URL),
    crypto: {
      bitcoinAddress: clean(env.FLUIDEQ_BITCOIN_ADDRESS),
      ethereumAddress: clean(env.FLUIDEQ_ETHEREUM_ADDRESS),
      litecoinAddress: clean(env.FLUIDEQ_LITECOIN_ADDRESS),
      dogecoinAddress: clean(env.FLUIDEQ_DOGECOIN_ADDRESS),
      moneroAddress: clean(env.FLUIDEQ_MONERO_ADDRESS),
      solanaAddress: clean(env.FLUIDEQ_SOLANA_ADDRESS),
      cardanoAddress: clean(env.FLUIDEQ_CARDANO_ADDRESS),
      tronAddress: clean(env.FLUIDEQ_TRON_ADDRESS),
    },
    cryptoLabel: clean(env.FLUIDEQ_CRYPTO_LABEL) || DEFAULT_CRYPTO_LABEL,
    repositoryUrl,
    // Trailing slash stripped before appending, or a repository URL written
    // with one produces a double slash that GitHub happens to tolerate and
    // most other hosts do not.
    downloadUrl:
      clean(env.FLUIDEQ_DOWNLOAD_URL) ||
      `${repositoryUrl.replace(/\/+$/, '')}/releases/latest`,
  };
};

// Each variable is read as its own static member expression because that is
// what webpack's EnvironmentPlugin can substitute at build time. Passing
// `process.env` wholesale would leave nothing to replace and the renderer,
// which has no real process object, would come up empty.
export const SUPPORT_CONFIG: ISupportConfig = buildSupportConfig({
  FLUIDEQ_STRIPE_URL: process.env.FLUIDEQ_STRIPE_URL,
  FLUIDEQ_COFFEE_URL: process.env.FLUIDEQ_COFFEE_URL,
  FLUIDEQ_BITCOIN_ADDRESS: process.env.FLUIDEQ_BITCOIN_ADDRESS,
  FLUIDEQ_ETHEREUM_ADDRESS: process.env.FLUIDEQ_ETHEREUM_ADDRESS,
  FLUIDEQ_LITECOIN_ADDRESS: process.env.FLUIDEQ_LITECOIN_ADDRESS,
  FLUIDEQ_DOGECOIN_ADDRESS: process.env.FLUIDEQ_DOGECOIN_ADDRESS,
  FLUIDEQ_MONERO_ADDRESS: process.env.FLUIDEQ_MONERO_ADDRESS,
  FLUIDEQ_SOLANA_ADDRESS: process.env.FLUIDEQ_SOLANA_ADDRESS,
  FLUIDEQ_CARDANO_ADDRESS: process.env.FLUIDEQ_CARDANO_ADDRESS,
  FLUIDEQ_TRON_ADDRESS: process.env.FLUIDEQ_TRON_ADDRESS,
  FLUIDEQ_CRYPTO_LABEL: process.env.FLUIDEQ_CRYPTO_LABEL,
  FLUIDEQ_REPOSITORY_URL: process.env.FLUIDEQ_REPOSITORY_URL,
  FLUIDEQ_DOWNLOAD_URL: process.env.FLUIDEQ_DOWNLOAD_URL,
});

/**
 * Shape check for one chain's address.
 *
 * Catches an unfilled placeholder, a pasted URL or a truncated string, and
 * nothing more. Real validation means checksumming base58, bech32 and EIP-55,
 * which belongs in a wallet, not in an equaliser.
 */
export const looksLikeCryptoAddress = (
  asset: ICryptoAsset,
  address: string,
): boolean => asset.pattern.test(address.trim());

/** Kept for the Bitcoin-only call sites that predate the multi-chain list. */
export const looksLikeBitcoinAddress = (address: string): boolean =>
  looksLikeCryptoAddress(CRYPTO_ASSETS[0], address);

const isConfiguredUrl = (value: string, prefix: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith(prefix) && trimmed.length > prefix.length;
};

/** One configured crypto destination, ready to render. */
export interface ISupportCrypto {
  asset: ICryptoAsset;
  address: string;
  /** Payment URI, or empty when the chain has no widely supported scheme. */
  uri: string;
}

export const getSupportCryptos = (
  config: ISupportConfig = SUPPORT_CONFIG,
): ISupportCrypto[] =>
  CRYPTO_ASSETS.flatMap((asset) => {
    const address = (config.crypto?.[asset.configKey] || '').trim();
    if (!looksLikeCryptoAddress(asset, address)) {
      return [];
    }
    const label = config.cryptoLabel.trim();
    // No amount is ever preset — that is the donor's call.
    const uri = asset.uriScheme
      ? `${asset.uriScheme}:${address}${
          label ? `?label=${encodeURIComponent(label)}` : ''
        }`
      : '';
    return [{ asset, address, uri }];
  });

export interface ISupportMethod {
  id: SupportMethodId;
  label: string;
  description: string;
}

/** The contribution methods this build actually has a destination for. */
export const getSupportMethods = (
  config: ISupportConfig = SUPPORT_CONFIG,
): ISupportMethod[] => {
  const methods: ISupportMethod[] = [];

  if (isConfiguredUrl(config.stripeUrl, 'https://')) {
    methods.push({
      id: 'stripe',
      label: 'Card or wallet',
      description: 'Secure checkout hosted by Stripe. Opens in your browser.',
    });
  }

  if (isConfiguredUrl(config.coffeeUrl, 'https://')) {
    methods.push({
      id: 'coffee',
      label: 'Buy me a coffee',
      description: 'One-off tip, no account needed. Opens in your browser.',
    });
  }

  getSupportCryptos(config).forEach(({ asset }) => {
    methods.push({
      id: asset.id,
      label: asset.name,
      description: `Send on-chain — ${asset.network}.`,
    });
  });

  return methods;
};

/** BIP-21 payment URI for Bitcoin specifically. */
export const getBitcoinUri = (
  config: ISupportConfig = SUPPORT_CONFIG,
): string =>
  getSupportCryptos(config).find((entry) => entry.asset.id === 'bitcoin')
    ?.uri ?? '';
