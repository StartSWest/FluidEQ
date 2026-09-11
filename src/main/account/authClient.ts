import type { IAccountConfig } from 'common/accountConfig';

/**
 * The account backend, spoken to directly over its REST interface.
 *
 * No client library. This is a handful of requests — sign up, sign in, verify
 * a code, refresh, sign out — and the app has no HTTP dependency at all today;
 * every existing network feature uses the global `fetch` and nothing else. A
 * package to wrap them would be the largest new dependency in the tree, would
 * pull a WebSocket implementation this module does not use, and on a GPL
 * project every addition is also a licence to audit.
 *
 * Everything here runs in the main process. The renderer never reaches the
 * network, which is what keeps the content security policy untouched: no origin
 * is added to `connect-src`, and `script-src 'self'` stays as strict as it is.
 *
 * THE PASSWORD PASSES THROUGH AND IS KEPT NOWHERE. It travels from the form,
 * over IPC, into one request body, and is gone; what the app keeps is the
 * refresh token the server answers with. Nothing here logs a request body.
 */

/**
 * Deliberately no avatar.
 *
 * The content security policy allows images from `'self'`, `data:` and `blob:`
 * only, so a remote picture would be refused — and widening that for a
 * decoration would also mean a request announcing the app was opened, every
 * time. The panel draws initials instead.
 */
export interface IAccountIdentity {
  id: string;
  /** The address the account was made with. Shown, never sent on. */
  email?: string;
  name?: string;
}

export interface IAuthSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds, derived here so nothing downstream does the sum. */
  expiresAt: number;
  identity: IAccountIdentity;
}

/**
 * What a failure was, rather than what it said.
 *
 * The message a server returns is for a log; a caller needs to know whether to
 * say "wrong password", "check your inbox", or "try again later". Each of
 * these has one sentence in every language; a new one does not compile until
 * it does.
 */
export type TAuthFailure =
  | 'network'
  | 'rejected'
  | 'expired'
  | 'malformed'
  | 'wrong_credentials'
  | 'unconfirmed'
  | 'weak_password'
  | 'bad_code'
  | 'rate_limited'
  | 'invalid_email'
  | 'already_registered'
  /**
   * This computer's sign-in was ended from elsewhere: nearly always the
   * account signing in on a sixth computer, which signs out the one used
   * least recently (Plus runs on five at a time).
   */
  | 'signed_out_elsewhere';

export class AuthError extends Error {
  readonly failure: TAuthFailure;

  constructor(failure: TAuthFailure, message: string) {
    super(message);
    this.name = 'AuthError';
    this.failure = failure;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= 4_096
    ? value
    : undefined;

const readIdentity = (value: unknown): IAccountIdentity | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = readString(value.id);
  if (!id) {
    return undefined;
  }
  const metadata = isRecord(value.user_metadata) ? value.user_metadata : {};
  return {
    id,
    email: readString(value.email),
    name:
      readString(metadata.display_name) ??
      readString(metadata.full_name) ??
      readString(metadata.name),
  };
};

/**
 * `expires_in` rather than `expires_at`.
 *
 * The absolute time the server sends is on the server's clock, and this machine
 * may disagree with it by minutes. A duration added to the moment the reply
 * landed is wrong by the round trip and nothing else, which is the smaller and
 * far more predictable error.
 */
const readSession = (value: unknown, now: number): IAuthSession => {
  if (!isRecord(value)) {
    throw new AuthError('malformed', 'The sign-in reply was not an object.');
  }
  const accessToken = readString(value.access_token);
  const refreshToken = readString(value.refresh_token);
  const identity = readIdentity(value.user);
  const expiresIn =
    typeof value.expires_in === 'number' && Number.isFinite(value.expires_in)
      ? Math.max(0, value.expires_in)
      : 3_600;
  if (!accessToken || !refreshToken || !identity) {
    throw new AuthError('malformed', 'The sign-in reply was incomplete.');
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: now + expiresIn * 1_000,
    identity,
  };
};

/**
 * The server's word for what went wrong, turned into ours.
 *
 * Newer replies carry `error_code`; the token endpoint still answers some
 * refusals in the older `error` / `error_description` shape. Both are read,
 * and anything unrecognised on a 400 or 401 is a credential that will not
 * work again — the caller signs the person out rather than retrying with it.
 */
const failureOf = (status: number, body: unknown): TAuthFailure => {
  const code = isRecord(body)
    ? (readString(body.error_code) ?? readString(body.error) ?? '')
    : '';
  switch (code) {
    case 'invalid_credentials':
    case 'invalid_grant':
      return 'wrong_credentials';
    case 'email_not_confirmed':
      return 'unconfirmed';
    case 'weak_password':
    case 'same_password':
      return 'weak_password';
    case 'otp_expired':
    case 'otp_disabled':
      return 'bad_code';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rate_limited';
    case 'validation_failed':
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return 'invalid_email';
    case 'user_already_exists':
    case 'email_exists':
      return 'already_registered';
    // The session this token belonged to is gone. The server removes the
    // least recently used one when an account signs in on a sixth computer.
    case 'refresh_token_not_found':
    case 'session_not_found':
      return 'signed_out_elsewhere';
    default:
      break;
  }
  if (status === 429) {
    return 'rate_limited';
  }
  // A 403 on `verify` is the code being wrong: the server has looked, and
  // refused. Everything else at 400/401 is a dead credential.
  if (status === 403) {
    return 'bad_code';
  }
  return status === 400 || status === 401 ? 'expired' : 'rejected';
};

interface IRequestOptions {
  method?: 'POST' | 'PUT';
  accessToken?: string;
}

const request = async (
  config: IAccountConfig,
  path: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  options: IRequestOptions = {},
): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}${path}`, {
      method: options.method ?? 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw new AuthError(
      'network',
      `The account service is unreachable: ${error}`,
    );
  }
  let json: unknown;
  try {
    json = (await response.json()) as unknown;
  } catch {
    json = undefined;
  }
  if (!response.ok) {
    throw new AuthError(
      failureOf(response.status, json),
      `The account service answered ${response.status}.`,
    );
  }
  if (json === undefined) {
    throw new AuthError('malformed', 'The account service sent no JSON.');
  }
  return json;
};

/**
 * Create the account. With confirmations on, the server sends the code and
 * answers with a user but no session; the session comes from `verifyCode`.
 *
 * An address that already has an account gets the same answer and no email,
 * on purpose — the server hides which addresses exist, and so must this. The
 * panel's "already have an account?" line is how that person finds their way.
 */
export const signUp = async (
  config: IAccountConfig,
  details: { email: string; password: string; name?: string },
  signal: AbortSignal,
): Promise<void> => {
  await request(
    config,
    '/auth/v1/signup',
    {
      email: details.email,
      password: details.password,
      data: details.name ? { display_name: details.name } : {},
    },
    signal,
  );
};

export const signInWithPassword = async (
  config: IAccountConfig,
  credentials: { email: string; password: string },
  signal: AbortSignal,
  now: number = Date.now(),
): Promise<IAuthSession> =>
  readSession(
    await request(
      config,
      '/auth/v1/token?grant_type=password',
      credentials,
      signal,
    ),
    now,
  );

export type TCodePurpose = 'signup' | 'recovery';

/** Redeem the six digits from the email for a session. */
export const verifyCode = async (
  config: IAccountConfig,
  details: { email: string; code: string; purpose: TCodePurpose },
  signal: AbortSignal,
  now: number = Date.now(),
): Promise<IAuthSession> =>
  readSession(
    await request(
      config,
      '/auth/v1/verify',
      { type: details.purpose, email: details.email, token: details.code },
      signal,
    ),
    now,
  );

/** Send the sign-up code again. */
export const resendSignUpCode = async (
  config: IAccountConfig,
  email: string,
  signal: AbortSignal,
): Promise<void> => {
  await request(config, '/auth/v1/resend', { type: 'signup', email }, signal);
};

/** Send the password-reset code. Same answer whether the address exists. */
export const requestRecovery = async (
  config: IAccountConfig,
  email: string,
  signal: AbortSignal,
): Promise<void> => {
  await request(config, '/auth/v1/recover', { email }, signal);
};

/** Set a new password on the session a recovery code just produced. */
export const updatePassword = async (
  config: IAccountConfig,
  accessToken: string,
  password: string,
  signal: AbortSignal,
): Promise<void> => {
  await request(config, '/auth/v1/user', { password }, signal, {
    method: 'PUT',
    accessToken,
  });
};

export const refreshSession = async (
  config: IAccountConfig,
  refreshToken: string,
  signal: AbortSignal,
  now: number = Date.now(),
): Promise<IAuthSession> =>
  readSession(
    await request(
      config,
      '/auth/v1/token?grant_type=refresh_token',
      { refresh_token: refreshToken },
      signal,
    ),
    now,
  );

/**
 * Tell the server to forget the refresh token, then forget it here.
 *
 * Deliberately never throws. Signing out locally must succeed even with the
 * network down or the token already dead — leaving somebody signed in because
 * the sign-out request failed is the one outcome that is clearly wrong.
 */
export const revokeSession = async (
  config: IAccountConfig,
  accessToken: string,
  signal: AbortSignal,
): Promise<void> => {
  try {
    await fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
  } catch {
    // The local credential is cleared by the caller regardless.
  }
};
