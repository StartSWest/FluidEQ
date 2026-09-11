import { REPOSITORY_URL } from '../../common/branding';

/**
 * Where the forum lives and what the app signs in to GitHub as.
 *
 * The discussions are this project's own, so the repository is taken from
 * the one constant that already names it. The GitHub App is per-maintainer
 * and comes from build-time variables, like the account backend: a fork that
 * builds this source must not sign its users into somebody else's app, so an
 * unset pair leaves the forum readable and nothing more.
 *
 * The client secret is not a secret in any sense that matters here, and
 * GitHub's own guidance says so: an app that runs on the user's machine is a
 * public client, its secret ships inside it, and PKCE is what protects the
 * sign-in. It is kept to this process — compiled into main by its own
 * EnvironmentPlugin entry and referenced by nothing the renderer imports —
 * because there is no reason for the window to hold it either.
 */

export interface IForumEnv {
  FLUIDEQ_GITHUB_CLIENT_ID?: string;
  FLUIDEQ_GITHUB_CLIENT_SECRET?: string;
}

export interface IForumConfig {
  owner: string;
  name: string;
  /** The JSON the repository's workflow publishes on every discussion event. */
  feedUrl: string;
  /** Empty in a build that cannot sign in. */
  clientId: string;
  clientSecret: string;
}

/**
 * GitHub App client ids are `Iv1.` plus sixteen hex digits for older apps
 * and `Iv23` plus sixteen more characters for current ones; the pattern takes
 * both and anything else of that alphabet GitHub moves to. A value with a
 * space or a quote in it is a paste gone wrong, and refusing it is kinder
 * than a sign-in page that says the app does not exist.
 */
const CLIENT_ID = /^Iv[A-Za-z0-9.]{8,40}$/;
/** Forty hex digits, which is what GitHub issues. */
const CLIENT_SECRET = /^[0-9a-f]{40}$/;

const readRepository = (url: string): { owner: string; name: string } => {
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(url);
  if (!match) {
    throw new Error(`REPOSITORY_URL is not a GitHub repository: ${url}`);
  }
  return { owner: match[1], name: match[2] };
};

export const buildForumConfig = (env: IForumEnv): IForumConfig => {
  const { owner, name } = readRepository(REPOSITORY_URL);
  const clientId = env.FLUIDEQ_GITHUB_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.FLUIDEQ_GITHUB_CLIENT_SECRET?.trim() ?? '';
  // Both or neither, for the reason the account backend gives: half of the
  // pair is a sign-in button that opens GitHub and then fails.
  const signs = CLIENT_ID.test(clientId) && CLIENT_SECRET.test(clientSecret);
  return {
    owner,
    name,
    feedUrl: `https://raw.githubusercontent.com/${owner}/${name}/discussions-data/discussions.json`,
    clientId: signs ? clientId : '',
    clientSecret: signs ? clientSecret : '',
  };
};

// Named one at a time: webpack replaces each `process.env.NAME` with a literal,
// and handing over the object would leave it nothing to replace.
export const FORUM_CONFIG: IForumConfig = buildForumConfig({
  FLUIDEQ_GITHUB_CLIENT_ID: process.env.FLUIDEQ_GITHUB_CLIENT_ID,
  FLUIDEQ_GITHUB_CLIENT_SECRET: process.env.FLUIDEQ_GITHUB_CLIENT_SECRET,
});

export const canSignIn = (config: IForumConfig): boolean =>
  config.clientId !== '';
