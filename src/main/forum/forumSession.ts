import type {
  IForumPerson,
  TForumAuthState,
} from '../../common/forum/forumTypes';
import {
  createEncryptedJsonStore,
  type IEncryptedJsonStore,
} from '../encryptedJsonStore';
import { canSignIn, type IForumConfig } from './forumConfig';
import ForumError from './forumError';
import {
  buildAuthorizeUrl,
  createPkce,
  exchangeCode,
  type IGithubTokens,
  type ISignInPages,
  openCallbackServer,
  refreshTokens,
  revokeToken,
} from './githubOAuth';

/**
 * Who is writing in the forum, and the token they write with.
 *
 * Separate from the FluidEQ account on purpose. The forum is GitHub's, so the
 * identity is GitHub's: what somebody posts carries their own GitHub name, is
 * answerable on github.com, and is theirs to edit or delete there. It needs no
 * FluidEQ account and no Plus — reading and writing are open to everyone who
 * runs the app, which is the point of having a forum at all.
 *
 * The token set lives in its own file under the credential cipher, like the
 * account's. Where the platform has no real cipher it is kept for this run
 * only rather than written somewhere that pretends to protect it.
 */

const STORE_FILE = 'forum-github.json';

/**
 * Renew a minute early. The expiry is GitHub's clock and the check is this
 * machine's, and a token that dies between being read and being used turns
 * one request into a sign-out.
 */
const REFRESH_SKEW_MS = 60_000;

interface IStoredForumSession extends IGithubTokens {
  viewer: IForumPerson;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPerson = (value: unknown): value is IForumPerson =>
  isRecord(value) &&
  typeof value.login === 'string' &&
  (value.avatarUrl === null || typeof value.avatarUrl === 'string') &&
  (value.url === null || typeof value.url === 'string');

const isStoredSession = (value: unknown): value is IStoredForumSession =>
  isRecord(value) &&
  typeof value.accessToken === 'string' &&
  value.accessToken.length > 0 &&
  typeof value.accessExpiresAt === 'number' &&
  typeof value.refreshToken === 'string' &&
  typeof value.refreshExpiresAt === 'number' &&
  isPerson(value.viewer);

export interface IForumSession {
  state(): TForumAuthState;
  /** A token that is good now, renewed first if it is about to lapse. */
  accessToken(): Promise<string>;
  /**
   * The whole sign-in, from opening GitHub's page to the token being kept.
   * Settles when the browser comes back, or when `cancelSignIn` is called.
   */
  signIn(
    pages: ISignInPages,
    openBrowser: (url: string) => boolean,
  ): Promise<TForumAuthState>;
  cancelSignIn(): void;
  signOut(): Promise<TForumAuthState>;
  /** GitHub refused the token outright: it is dead whatever its expiry says. */
  invalidate(): void;
}

export interface IForumSessionDeps {
  config: IForumConfig;
  userDataDir: string;
  fetchViewer: (accessToken: string) => Promise<IForumPerson>;
  onState: (state: TForumAuthState) => void;
  logger?: { warn(message: string): void };
  fetchImpl?: typeof fetch;
  /** Injected by tests; the real one is the credential cipher. */
  store?: IEncryptedJsonStore<IStoredForumSession>;
  now?: () => number;
}

export const createForumSession = ({
  config,
  userDataDir,
  fetchViewer,
  onState,
  logger,
  fetchImpl = fetch,
  store = createEncryptedJsonStore(userDataDir, STORE_FILE, isStoredSession),
  now = Date.now,
}: IForumSessionDeps): IForumSession => {
  const client = {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  };
  let current: IStoredForumSession | undefined;
  // The cipher cannot read anything before `ready`, so the stored session is
  // read on first use rather than at construction, which is before it.
  let loaded = false;
  let signingIn:
    { controller: AbortController; authorizeUrl: string } | undefined;
  // One renewal at a time. Two requests racing to renew would both redeem the
  // refresh token, and GitHub rotates it on use, so the second would be
  // refused and sign the person out for having been asked twice.
  let refreshing: Promise<string> | undefined;

  const load = () => {
    if (!loaded && store.available()) {
      current = store.read();
      loaded = true;
    }
  };

  const state = (): TForumAuthState => {
    if (!canSignIn(config)) {
      return { status: 'unconfigured' };
    }
    if (signingIn) {
      return { status: 'signing-in', authorizeUrl: signingIn.authorizeUrl };
    }
    load();
    return current
      ? { status: 'signed-in', viewer: current.viewer }
      : { status: 'signed-out' };
  };

  const publish = () => onState(state());

  const keep = (next: IStoredForumSession | undefined) => {
    current = next;
    loaded = true;
    if (!store.available()) {
      return;
    }
    if (next) {
      store.write(next);
    } else {
      store.clear();
    }
  };

  const forget = () => {
    keep(undefined);
    publish();
  };

  const renew = async (session: IStoredForumSession): Promise<string> => {
    if (
      !session.refreshToken ||
      (session.refreshExpiresAt !== 0 && session.refreshExpiresAt <= now())
    ) {
      forget();
      throw new ForumError('signed_out', 'The GitHub sign-in has lapsed.');
    }
    try {
      const tokens = await refreshTokens(
        fetchImpl,
        client,
        session.refreshToken,
      );
      keep({ ...tokens, viewer: session.viewer });
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ForumError && error.failure === 'signed_out') {
        forget();
      }
      throw error;
    }
  };

  return {
    state,

    accessToken: async () => {
      load();
      const session = current;
      if (!session) {
        throw new ForumError('signed_out', 'Nobody is signed in to GitHub.');
      }
      if (
        session.accessExpiresAt === 0 ||
        session.accessExpiresAt - REFRESH_SKEW_MS > now()
      ) {
        return session.accessToken;
      }
      refreshing =
        refreshing ??
        renew(session).finally(() => {
          refreshing = undefined;
        });
      return refreshing;
    },

    signIn: async (pages, openBrowser) => {
      if (!canSignIn(config)) {
        throw new ForumError('unconfigured', 'This build cannot sign in.');
      }
      signingIn?.controller.abort();
      const controller = new AbortController();
      const pkce = createPkce();
      const server = await openCallbackServer(pkce, pages, controller.signal);
      const attempt = {
        controller,
        authorizeUrl: buildAuthorizeUrl(
          client.clientId,
          server.redirectUri,
          pkce,
        ),
      };
      signingIn = attempt;
      publish();

      try {
        if (!openBrowser(attempt.authorizeUrl)) {
          throw new ForumError('rejected', 'The browser could not be opened.');
        }
        const code = await server.code;
        const tokens = await exchangeCode(
          fetchImpl,
          client,
          code,
          server.redirectUri,
          pkce.verifier,
        );
        const viewer = await fetchViewer(tokens.accessToken);
        keep({ ...tokens, viewer });
        server.finish(pages.success);
      } catch (error) {
        const cancelled =
          error instanceof ForumError && error.failure === 'cancelled';
        server.finish(cancelled ? pages.cancelled : pages.failure);
        throw error;
      } finally {
        // A newer attempt may have replaced this one; only the attempt that
        // is still current gets to end the "signing in" state.
        if (signingIn === attempt) {
          signingIn = undefined;
        }
        publish();
      }
      return state();
    },

    cancelSignIn: () => {
      signingIn?.controller.abort();
    },

    signOut: async () => {
      signingIn?.controller.abort();
      load();
      const token = current?.accessToken;
      forget();
      if (token) {
        try {
          await revokeToken(fetchImpl, client, token);
        } catch (error) {
          // Signed out here regardless; the token simply lives out its hours
          // on GitHub's side, where it can still be revoked from the account.
          logger?.warn(`Forum sign-out could not revoke the token: ${error}`);
        }
      }
      return state();
    },

    invalidate: () => {
      load();
      if (current) {
        forget();
      }
    },
  };
};
