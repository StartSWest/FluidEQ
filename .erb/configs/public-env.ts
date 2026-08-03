import loadDotenv from '../scripts/load-dotenv';

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
  FLUIDEQ_STRIPE_URL: '',
  FLUIDEQ_BITCOIN_ADDRESS: '',
  FLUIDEQ_BITCOIN_LABEL: '',
  FLUIDEQ_REPOSITORY_URL: '',
};

export default PUBLIC_ENV_DEFAULTS;
