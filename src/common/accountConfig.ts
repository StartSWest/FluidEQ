/**
 * Optional account configuration.
 *
 * Signing in is not part of FluidEQ's job. The equaliser, the library, the
 * visualizers and everything else work with no account and no network, and
 * that is the arrangement for anybody who never signs in. What an account adds
 * is a layer on top: the extra visualizers, the community and the leaderboard.
 *
 * Like the contribution destinations in `support.ts`, all of it comes from
 * build-time environment variables rather than committed literals, and for the
 * same reason: a backend is per-maintainer rather than per-project. A fork that
 * builds this source must not sign its users into somebody else's service, so
 * everything defaults to empty and the whole feature stays hidden until a build
 * supplies a backend of its own.
 *
 * EVERYTHING HERE IS PUBLIC. webpack inlines these into both bundles, so each
 * value is readable in the shipped JavaScript. That is fine for what is here:
 * a project URL is a hostname, and Supabase's anon/publishable key is designed
 * to be handed to every client — row-level security in the database is what
 * protects data, not the secrecy of that key. A *secret* key is a different
 * thing entirely and `readAnonKey` below exists to refuse one.
 */

export interface IAccountEnv {
  FLUIDEQ_SUPABASE_URL?: string;
  FLUIDEQ_SUPABASE_ANON_KEY?: string;
  FLUIDEQ_API_URL?: string;
  FLUIDEQ_PLUS_PRICE?: string;
}

export interface IAccountConfig {
  /** Origin of the Supabase project, with no path, query or fragment. */
  supabaseUrl: string;
  /** The publishable key. Public by design; see the note above. */
  supabaseAnonKey: string;
  /**
   * Where the server-side functions answer — checkout, the billing portal.
   *
   * Defaults to the Supabase project's own functions gateway, and exists as a
   * separate value so the functions can move under the product's domain later
   * without the app changing: one variable, no code. No trailing slash; the
   * function name is appended.
   */
  apiUrl: string;
  /**
   * The price as text, shown beside the upgrade offer and nowhere else — and
   * the switch for the offer itself: empty means signing in works but nothing
   * is for sale, which is every build until a merchant account exists.
   *
   * Text rather than a number and a currency, because the checkout page shows
   * the real figure — with the buyer's tax — and anything the app computed
   * would disagree with it somewhere in the world. Requiring it for the offer
   * is deliberate: a button that opens a checkout without saying what it costs
   * is the kind of thing that earns a chargeback.
   */
  plusPrice: string;
}

const EMPTY_CONFIG: IAccountConfig = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  apiUrl: '',
  plusPrice: '',
};

const readPlainText = (value: string | undefined): string => {
  const text = value?.trim() ?? '';
  return text.length <= 40 ? text : '';
};

/**
 * An https origin and nothing else.
 *
 * A path is rejected rather than trimmed. This is joined with a known path
 * later, and silently discarding the half somebody typed would turn a
 * misconfigured build into one that quietly talks to the wrong endpoint —
 * which is worse than a build with no accounts at all.
 *
 * Plaintext http is refused so a sign-in cannot be downgraded in transit.
 */
const readOrigin = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return '';
  }
  if (url.protocol !== 'https:') {
    return '';
  }
  const bare = (url.pathname === '/' || url.pathname === '') && !url.search;
  return bare && !url.hash ? url.origin : '';
};

/**
 * An https URL with a path allowed but no query or fragment, and no trailing
 * slash — function names are appended to it with one.
 */
const readApiBase = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' || url.search || url.hash) {
    return '';
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
};

/**
 * The publishable key, or nothing.
 *
 * Only Supabase's `sb_publishable_` form is accepted, and every other shape is
 * refused — including the legacy JWT keys, which are deprecated in favour of
 * these.
 *
 * That strictness is the whole point rather than a limitation. The legacy anon
 * and service-role keys are both JWTs and are indistinguishable from the
 * outside; telling them apart means decoding the payload to read a `role`
 * claim, and a service-role key pasted here by accident bypasses every
 * row-level security policy in the database and ships to every user, because
 * the file it lands in is inlined into both bundles. Refusing the whole
 * ambiguous shape removes that failure instead of trying to detect it — and it
 * keeps a base64 decoder out of `src/common`, which the renderer imports and
 * where webpack polyfills no Node core.
 *
 * A build with a legacy key therefore gets no accounts rather than a possible
 * leaked master credential. Rotating to a publishable key is what Supabase
 * recommends regardless.
 */
const readAnonKey = (value: string | undefined): string => {
  const key = value?.trim() ?? '';
  if (key.length < 30 || key.length > 512) {
    return '';
  }
  return /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) ? key : '';
};

export const buildAccountConfig = (env: IAccountEnv): IAccountConfig => {
  const supabaseUrl = readOrigin(env.FLUIDEQ_SUPABASE_URL);
  const supabaseAnonKey = readAnonKey(env.FLUIDEQ_SUPABASE_ANON_KEY);
  // Both or none. One of two is a build that offers a sign-in button which
  // cannot complete, and a dead button is worse than no button. The price
  // rides on top: no accounts means nothing to sell to.
  if (!supabaseUrl || !supabaseAnonKey) {
    return EMPTY_CONFIG;
  }
  return {
    supabaseUrl,
    supabaseAnonKey,
    apiUrl: readApiBase(env.FLUIDEQ_API_URL) || `${supabaseUrl}/functions/v1`,
    plusPrice: readPlainText(env.FLUIDEQ_PLUS_PRICE),
  };
};

// Named one at a time rather than handing over `process.env`, because webpack
// replaces each `process.env.NAME` with a literal — passing the object wholesale
// would leave nothing to replace and both bundles would read an empty one.
export const ACCOUNT_CONFIG: IAccountConfig = buildAccountConfig({
  FLUIDEQ_SUPABASE_URL: process.env.FLUIDEQ_SUPABASE_URL,
  FLUIDEQ_SUPABASE_ANON_KEY: process.env.FLUIDEQ_SUPABASE_ANON_KEY,
  FLUIDEQ_API_URL: process.env.FLUIDEQ_API_URL,
  FLUIDEQ_PLUS_PRICE: process.env.FLUIDEQ_PLUS_PRICE,
});

/** Whether this build has a backend to sign in to at all. */
export const isAccountConfigured = (
  config: IAccountConfig = ACCOUNT_CONFIG,
): boolean => config.supabaseUrl !== '';

/** Whether this build has something to upgrade to. */
export const isCheckoutConfigured = (
  config: IAccountConfig = ACCOUNT_CONFIG,
): boolean => isAccountConfigured(config) && config.plusPrice !== '';
