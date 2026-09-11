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
  // The optional account backend. Both or none: a build with one of them
  // would show a sign-in that cannot complete. Empty means the app has no
  // accounts at all, which is the right default for a fork and the arrangement
  // every existing build already has.
  //
  // The key here is the *publishable* one. `accountConfig.ts` refuses every
  // other shape, including the legacy JWT keys, because a service-role key
  // pasted here would ship to every user and bypass every database policy.
  FLUIDEQ_SUPABASE_URL: '',
  FLUIDEQ_SUPABASE_ANON_KEY: '',
  // Where the checkout and billing-portal functions answer; empty means the
  // Supabase project's own gateway. The one line that changes when they move
  // under the product's domain.
  FLUIDEQ_API_URL: '',
  // The price as text, and the switch for the upgrade offer: empty means
  // signing in works but there is nothing to buy, which is every build until
  // a merchant account exists.
  FLUIDEQ_PLUS_PRICE: '',
  // The yearly price beside it, as text; empty means monthly only.
  FLUIDEQ_PLUS_PRICE_YEARLY: '',
};

export default PUBLIC_ENV_DEFAULTS;
