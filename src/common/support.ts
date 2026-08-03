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

/**
 * Optional "support the work" configuration.
 *
 * FluidEQ is GPLv3 and every feature is free. Contributing is a thank-you, not
 * a purchase: nothing in the app is gated behind it and the app never asks
 * twice on its own.
 *
 * The destinations come from build-time environment variables (see
 * .env.example), never from a committed literal. Two reasons: a payment
 * destination is per-maintainer rather than per-project, and a wrong Bitcoin
 * address sends money to a stranger with no way to recover it — so a fork that
 * forgets to set its own must get NO donate button rather than inherit
 * somebody else's. Everything below defaults to empty and the UI stays hidden
 * until a destination validates.
 */
export interface ISupportConfig {
  /**
   * A Stripe Payment Link (https://buy.stripe.com/...) or Stripe-hosted
   * donation page. Payment Links need no server and no keys in the client,
   * which is why they are the right fit here: the app only ever opens a URL.
   */
  stripeUrl: string;
  /** On-chain Bitcoin address that receives contributions. */
  bitcoinAddress: string;
  /** Shown next to the address so a donor can confirm where it goes. */
  bitcoinLabel: string;
  /** Where the code lives, for people who would rather contribute time. */
  repositoryUrl: string;
}

/** The build-time variables this module reads. */
export interface ISupportEnv {
  FLUIDEQ_STRIPE_URL?: string;
  FLUIDEQ_BITCOIN_ADDRESS?: string;
  FLUIDEQ_BITCOIN_LABEL?: string;
  FLUIDEQ_REPOSITORY_URL?: string;
}

const DEFAULT_BITCOIN_LABEL = 'FluidEQ development';
const DEFAULT_REPOSITORY_URL = 'https://github.com/StartSWest/FluidEQ';

/** Pure so the gating can be tested without touching the real environment. */
export const buildSupportConfig = (env: ISupportEnv): ISupportConfig => ({
  stripeUrl: (env.FLUIDEQ_STRIPE_URL || '').trim(),
  bitcoinAddress: (env.FLUIDEQ_BITCOIN_ADDRESS || '').trim(),
  bitcoinLabel:
    (env.FLUIDEQ_BITCOIN_LABEL || '').trim() || DEFAULT_BITCOIN_LABEL,
  repositoryUrl:
    (env.FLUIDEQ_REPOSITORY_URL || '').trim() || DEFAULT_REPOSITORY_URL,
});

// Each variable is read as its own static member expression because that is
// what webpack's EnvironmentPlugin can substitute at build time. Passing
// `process.env` wholesale would leave nothing to replace and the renderer,
// which has no real process object, would come up empty.
export const SUPPORT_CONFIG: ISupportConfig = buildSupportConfig({
  FLUIDEQ_STRIPE_URL: process.env.FLUIDEQ_STRIPE_URL,
  FLUIDEQ_BITCOIN_ADDRESS: process.env.FLUIDEQ_BITCOIN_ADDRESS,
  FLUIDEQ_BITCOIN_LABEL: process.env.FLUIDEQ_BITCOIN_LABEL,
  FLUIDEQ_REPOSITORY_URL: process.env.FLUIDEQ_REPOSITORY_URL,
});

export type SupportMethodId = 'stripe' | 'bitcoin';

export interface ISupportMethod {
  id: SupportMethodId;
  label: string;
  description: string;
}

/**
 * Basic sanity check on a Bitcoin address.
 *
 * This is deliberately a shape check, not validation: it catches an unfilled
 * placeholder or a pasted URL, and nothing more. Real validation means
 * checksumming base58 and bech32, which belongs in a wallet, not in an EQ.
 */
export const looksLikeBitcoinAddress = (address: string): boolean =>
  /^(bc1[02-9ac-hj-np-z]{7,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(
    address.trim(),
  );

const isConfiguredUrl = (value: string, prefix: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith(prefix) && trimmed.length > prefix.length;
};

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

  if (looksLikeBitcoinAddress(config.bitcoinAddress)) {
    methods.push({
      id: 'bitcoin',
      label: 'Bitcoin',
      description: 'Send on-chain to the address below.',
    });
  }

  return methods;
};

export const isSupportAvailable = (
  config: ISupportConfig = SUPPORT_CONFIG,
): boolean => getSupportMethods(config).length > 0;

/**
 * BIP-21 payment URI, so a desktop wallet can open pre-filled instead of the
 * donor hand-copying an address. No amount is set — that is the donor's call.
 */
export const getBitcoinUri = (
  config: ISupportConfig = SUPPORT_CONFIG,
): string => {
  const address = config.bitcoinAddress.trim();
  if (!looksLikeBitcoinAddress(address)) {
    return '';
  }
  const label = config.bitcoinLabel.trim();
  return label
    ? `bitcoin:${address}?label=${encodeURIComponent(label)}`
    : `bitcoin:${address}`;
};
