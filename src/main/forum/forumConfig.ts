import { ACCOUNT_CONFIG } from '../../common/accountConfig';
import { REPOSITORY_URL } from '../../common/branding';

/**
 * Where the forum lives and what the app signs in to GitHub as.
 *
 * The discussions are this project's own, so the repository is taken from
 * the one constant that already names it. The GitHub App is per-maintainer
 * and comes from a build-time variable, like the account backend: a fork that
 * builds this source must not sign its users into somebody else's app, so an
 * unset id leaves the forum readable and nothing more.
 *
 * No client secret is compiled in. GitHub wants the app's secret for the three
 * token requests — redeeming the sign-in code, renewing a token, revoking one
 * — and a secret inside the app is a secret in every installer anybody can
 * download. Those three go through this project's server instead
 * (`github-token`, among the Supabase functions), which holds the secret;
 * the id is public and stays here, where the browser page needs it.
 */

export interface IForumEnv {
  FLUIDEQ_GITHUB_CLIENT_ID?: string;
}

export interface IForumConfig {
  owner: string;
  name: string;
  /** The JSON the repository's workflow publishes on every discussion event. */
  feedUrl: string;
  /** Empty in a build that cannot sign in. */
  clientId: string;
  /** The server function that makes the token requests; empty with `clientId`. */
  tokenUrl: string;
}

/**
 * GitHub App client ids are `Iv1.` plus sixteen hex digits for older apps
 * and `Iv23` plus sixteen more characters for current ones; the pattern takes
 * both and anything else of that alphabet GitHub moves to. A value with a
 * space or a quote in it is a paste gone wrong, and refusing it is kinder
 * than a sign-in page that says the app does not exist.
 */
const CLIENT_ID = /^Iv[A-Za-z0-9.]{8,40}$/;

const readRepository = (url: string): { owner: string; name: string } => {
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(url);
  if (!match) {
    throw new Error(`REPOSITORY_URL is not a GitHub repository: ${url}`);
  }
  return { owner: match[1], name: match[2] };
};

export const buildForumConfig = (
  env: IForumEnv,
  apiUrl: string,
): IForumConfig => {
  const { owner, name } = readRepository(REPOSITORY_URL);
  const clientId = env.FLUIDEQ_GITHUB_CLIENT_ID?.trim() ?? '';
  // Both or neither: an id with no server to redeem the code is a sign-in
  // button that opens GitHub and then fails.
  const signs = CLIENT_ID.test(clientId) && apiUrl !== '';
  return {
    owner,
    name,
    feedUrl: `https://raw.githubusercontent.com/${owner}/${name}/discussions-data/discussions.json`,
    clientId: signs ? clientId : '',
    tokenUrl: signs ? `${apiUrl}/github-token` : '',
  };
};

// Named one at a time: webpack replaces each `process.env.NAME` with a literal,
// and handing over the object would leave it nothing to replace.
export const FORUM_CONFIG: IForumConfig = buildForumConfig(
  { FLUIDEQ_GITHUB_CLIENT_ID: process.env.FLUIDEQ_GITHUB_CLIENT_ID },
  ACCOUNT_CONFIG.apiUrl,
);

export const canSignIn = (config: IForumConfig): boolean =>
  config.clientId !== '';
