import ForumError from './forumError';

/**
 * GitHub's API, as the forum needs it: GraphQL for the discussions — they
 * exist nowhere else in documented form — and the markdown renderer for the
 * composer's preview, so what somebody previews is exactly what GitHub will
 * publish.
 *
 * Every failure becomes a `ForumError` with the word the panel shows. The
 * cases worth telling apart are the ones the person can do something about:
 * signed out (sign in again), rate limited (come back at a time GitHub
 * names), locked (nobody can reply) and forbidden (this account cannot).
 */

const GRAPHQL_URL = 'https://api.github.com/graphql';
const MARKDOWN_URL = 'https://api.github.com/markdown';

export interface IGithubApi {
  graphql(query: string, variables: Record<string, unknown>): Promise<unknown>;
  markdown(text: string, context: string): Promise<string>;
}

export interface IGithubApiDeps {
  accessToken: () => Promise<string>;
  /** GitHub said the token is no good; the session forgets it. */
  onUnauthorized: () => void;
  fetchImpl?: typeof fetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** When GitHub says to come back, as epoch ms. */
const retryAtOf = (response: Response): number | undefined => {
  const after = Number(response.headers.get('retry-after'));
  if (Number.isFinite(after) && after > 0) {
    return Date.now() + after * 1_000;
  }
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  return Number.isFinite(reset) && reset > 0 ? reset * 1_000 : undefined;
};

const failForStatus = (response: Response): ForumError => {
  const limited =
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get('x-ratelimit-remaining') === '0' ||
        response.headers.has('retry-after')));
  if (limited) {
    return new ForumError('rate_limited', 'GitHub is limiting requests.', {
      retryAt: retryAtOf(response),
    });
  }
  if (response.status === 403) {
    return new ForumError('forbidden', 'GitHub refused the request.');
  }
  if (response.status === 404) {
    return new ForumError('not_found', 'GitHub has no such thing.');
  }
  return new ForumError(
    response.status >= 500 ? 'network' : 'rejected',
    `GitHub answered ${response.status}.`,
  );
};

/**
 * GraphQL reports most refusals as a 200 with an `errors` list. The type is
 * the reliable part; the message is kept as detail when it explains a
 * refusal the person could act on.
 */
const failForErrors = (errors: unknown[]): ForumError => {
  const first = isRecord(errors[0]) ? errors[0] : {};
  const type = typeof first.type === 'string' ? first.type : '';
  const message = typeof first.message === 'string' ? first.message : '';
  if (type === 'RATE_LIMITED') {
    return new ForumError('rate_limited', message || 'Rate limited.');
  }
  if (type === 'NOT_FOUND') {
    return new ForumError('not_found', message || 'Not found.');
  }
  if (/locked/i.test(message)) {
    return new ForumError('locked', message);
  }
  if (type === 'FORBIDDEN' || /permission|not authorized/i.test(message)) {
    return new ForumError('forbidden', message || 'Forbidden.', {
      detail: message || undefined,
    });
  }
  return new ForumError('rejected', message || 'GitHub refused the request.', {
    detail: message || undefined,
  });
};

export const createGithubApi = ({
  accessToken,
  onUnauthorized,
  fetchImpl = fetch,
}: IGithubApiDeps): IGithubApi => {
  const send = async (url: string, body: unknown, accept: string) => {
    const token = await accessToken();
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Accept: accept,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ForumError('network', `GitHub could not be reached: ${error}`);
    }
    if (response.status === 401) {
      onUnauthorized();
      throw new ForumError('signed_out', 'GitHub no longer accepts the token.');
    }
    if (!response.ok) {
      throw failForStatus(response);
    }
    return response;
  };

  return {
    graphql: async (query, variables) => {
      const response = await send(
        GRAPHQL_URL,
        { query, variables },
        'application/json',
      );
      const payload: unknown = await response.json();
      if (!isRecord(payload)) {
        throw new ForumError('rejected', 'GitHub sent something unreadable.');
      }
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        throw failForErrors(payload.errors);
      }
      return payload.data;
    },

    markdown: async (text, context) => {
      // The Accept GitHub documents for this endpoint is its JSON media type,
      // even though what comes back is HTML.
      const response = await send(
        MARKDOWN_URL,
        { text, mode: 'gfm', context },
        'application/vnd.github+json',
      );
      return response.text();
    },
  };
};
