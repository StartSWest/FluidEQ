import loadDotenv from '../scripts/load-dotenv';
// eslint-disable-next-line import/no-relative-packages
import { version } from '../../release/app/package.json';

loadDotenv();

/**
 * Build-time variables that get inlined into the renderer bundle.
 *
 * EVERYTHING HERE IS PUBLIC. webpack replaces `process.env.NAME` with a string
 * literal, so each value ends up readable in the shipped JavaScript. Only
 * values that are public by nature belong here — a Stripe *Payment Link* and a
 * receiving Bitcoin address are meant to be shared, so they qualify. A Stripe
 * secret key never does.
 *
 * The defaults are empty on purpose: with no destination configured the app
 * hides its contribution UI entirely rather than showing a broken one.
 */
const PUBLIC_ENV_DEFAULTS = {
  // Taken from release/app/package.json — the same file electron-builder reads
  // for the installer version, so what the UI shows can never disagree with
  // what was actually shipped.
  FLUIDEQ_VERSION: version,
  FLUIDEQ_STRIPE_URL: '',
  FLUIDEQ_COFFEE_URL: '',
  FLUIDEQ_BITCOIN_ADDRESS: '',
  FLUIDEQ_ETHEREUM_ADDRESS: '',
  FLUIDEQ_LITECOIN_ADDRESS: '',
  FLUIDEQ_DOGECOIN_ADDRESS: '',
  FLUIDEQ_MONERO_ADDRESS: '',
  FLUIDEQ_SOLANA_ADDRESS: '',
  FLUIDEQ_CARDANO_ADDRESS: '',
  FLUIDEQ_TRON_ADDRESS: '',
  FLUIDEQ_CRYPTO_LABEL: '',
  FLUIDEQ_REPOSITORY_URL: '',
  FLUIDEQ_DOWNLOAD_URL: '',
  // Empty like the rest, and for a sharper reason than the others: a fork
  // building from this source must not ship somebody else's support address.
  // With none set the private route is simply not offered, and the public one
  // through GitHub still is.
  FLUIDEQ_SUPPORT_EMAIL: '',
};

export default PUBLIC_ENV_DEFAULTS;
