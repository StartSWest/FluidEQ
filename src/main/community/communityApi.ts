import type { IAccountConfig } from 'common/accountConfig';

/**
 * The community's REST surface, spoken to directly.
 *
 * Every rule about who may post, how fast, and where lives in the database as
 * a policy or a trigger; this module only carries requests and reads answers.
 * When the server refuses, the trigger names why in one word, and that word is
 * what reaches the panel — so the app can say "Plus members can post here"
 * rather than "row-level security policy violation".
 *
 * Everything from the network is checked before it is trusted. A column renamed
 * on the server must read as an empty list, not as a list of undefineds.
 */

export type TCommunityRole = 'member' | 'contributor' | 'admin';
export type TChannelWriteRole = 'plus' | 'contributor' | 'admin';

export interface ICommunityProfile {
  userId: string;
  handle: string;
  displayName: string;
  role: TCommunityRole;
  acceptedConductAt?: number;
}

export interface ICommunityChannel {
  id: string;
  name: string;
  description: string;
  writeRole: TChannelWriteRole;
  position: number;
}

export interface ICommunityMessage {
  id: number;
  channelId: string;
  userId: string;
  handle: string;
  displayName: string;
  role: TCommunityRole;
  body: string;
  /** Epoch ms. */
  createdAt: number;
}

export interface ICommunityMention {
  messageId: number;
  channelId: string;
}

/**
 * The one word the server used, or the app's own for failures it never
 * reached. Exhaustive so a translation exists for each.
 */
export type TCommunityFailure =
  | 'banned'
  | 'handle_required'
  | 'handle_taken'
  | 'conduct_required'
  | 'plus_required'
  | 'contributor_required'
  | 'admin_required'
  | 'rate_limited'
  | 'empty'
  | 'immutable'
  | 'network'
  | 'signed_out'
  | 'rejected';

export class CommunityError extends Error {
  readonly failure: TCommunityFailure;

  constructor(failure: TCommunityFailure, message: string) {
    super(message);
    this.name = 'CommunityError';
    this.failure = failure;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown, max = 4_096): string | undefined =>
  typeof value === 'string' && value.length <= max ? value : undefined;

const readRole = (value: unknown): TCommunityRole =>
  value === 'admin' || value === 'contributor' ? value : 'member';

const readTime = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const readProfile = (value: unknown): ICommunityProfile | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const userId = readString(value.user_id, 64);
  const handle = readString(value.handle, 20);
  const displayName = readString(value.display_name, 40);
  if (!userId || !handle || !displayName) {
    return undefined;
  }
  return {
    userId,
    handle,
    displayName,
    role: readRole(value.role),
    acceptedConductAt: readTime(value.accepted_conduct_at),
  };
};

export const readChannel = (value: unknown): ICommunityChannel | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = readString(value.id, 32);
  const name = readString(value.name, 80);
  if (!id || !name) {
    return undefined;
  }
  const writeRole = value.write_role;
  return {
    id,
    name,
    description: readString(value.description, 200) ?? '',
    writeRole:
      writeRole === 'contributor' || writeRole === 'admin' ? writeRole : 'plus',
    position: typeof value.position === 'number' ? value.position : 0,
  };
};

export const readMessage = (value: unknown): ICommunityMessage | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = typeof value.id === 'number' ? value.id : undefined;
  const channelId = readString(value.channel_id, 32);
  const userId = readString(value.user_id, 64);
  const body = readString(value.body, 1_000);
  const createdAt = readTime(value.created_at);
  // The author rides along embedded, when asked for. A change event carries
  // the row alone, and the caller fills the author in from what it knows.
  const author = isRecord(value.profiles) ? value.profiles : {};
  if (!id || !channelId || !userId || !body || createdAt === undefined) {
    return undefined;
  }
  return {
    id,
    channelId,
    userId,
    handle: readString(author.handle, 20) ?? '',
    displayName: readString(author.display_name, 40) ?? '',
    role: readRole(author.role),
    body,
    createdAt,
  };
};

const readList = <T>(
  value: unknown,
  read: (entry: unknown) => T | undefined,
): T[] =>
  Array.isArray(value)
    ? value.map(read).filter((entry): entry is T => entry !== undefined)
    : [];

/**
 * The server's one word, out of PostgREST's error envelope.
 *
 * A trigger's `raise exception 'rate_limited'` arrives as
 * `{ "message": "rate_limited", ... }` with status 400. A unique-key collision
 * on the handle arrives as code 23505. Anything else is a refusal the app has
 * no sentence for.
 */
const failureFromResponse = async (
  response: Response,
): Promise<TCommunityFailure> => {
  if (response.status === 401) {
    return 'signed_out';
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return 'rejected';
  }
  if (!isRecord(body)) {
    return 'rejected';
  }
  if (body.code === '23505') {
    return 'handle_taken';
  }
  const message = readString(body.message, 200) ?? '';
  const known: TCommunityFailure[] = [
    'banned',
    'handle_required',
    'conduct_required',
    'plus_required',
    'contributor_required',
    'admin_required',
    'rate_limited',
    'empty',
  ];
  const match = known.find((word) => message.includes(word));
  if (match) {
    return match;
  }
  return message.includes('messages_are_immutable') ? 'immutable' : 'rejected';
};

export interface ICommunityApiOptions {
  config: IAccountConfig;
  /** A usable access token, or a rejection when nobody is signed in. */
  accessToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export interface ICommunityApi {
  getMyProfile(): Promise<ICommunityProfile | undefined>;
  createProfile(
    handle: string,
    displayName: string,
  ): Promise<ICommunityProfile>;
  acceptConduct(): Promise<void>;
  listChannels(): Promise<ICommunityChannel[]>;
  /** Newest first, at most `limit`, older than `beforeId` when given. */
  listMessages(
    channelId: string,
    beforeId?: number,
    limit?: number,
  ): Promise<ICommunityMessage[]>;
  sendMessage(channelId: string, body: string): Promise<ICommunityMessage>;
  deleteMessage(id: number): Promise<void>;
  reportMessage(id: number, reason: string): Promise<void>;
  listBlocks(): Promise<string[]>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  unreadMentions(): Promise<ICommunityMention[]>;
  markMentionsRead(messageIds: readonly number[]): Promise<void>;
}

const MESSAGE_SELECT =
  'id,channel_id,user_id,body,created_at,profiles!inner(handle,display_name,role)';

export const createCommunityApi = ({
  config,
  accessToken,
  fetchImpl = fetch,
}: ICommunityApiOptions): ICommunityApi => {
  const request = async (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    prefer?: string,
  ): Promise<unknown> => {
    let token: string;
    try {
      token = await accessToken();
    } catch {
      throw new CommunityError('signed_out', 'Nobody is signed in.');
    }
    let response: Response;
    try {
      response = await fetchImpl(`${config.supabaseUrl}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(prefer ? { Prefer: prefer } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new CommunityError('network', `Unreachable: ${error}`);
    }
    if (!response.ok) {
      const failure = await failureFromResponse(response);
      throw new CommunityError(failure, `Answered ${response.status}`);
    }
    if (response.status === 204) {
      return undefined;
    }
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  };

  const one = <T>(value: unknown, read: (entry: unknown) => T | undefined) => {
    const [first] = readList(value, read);
    return first;
  };

  /**
   * The signed-in user's id, read out of the token's `sub` claim.
   *
   * Decoded, not verified — there is nothing to verify against here, and the
   * server checks the same token on every request. This only saves a round
   * trip to ask the server who it already knows we are.
   */
  const whoAmI = async (): Promise<string> => {
    let token: string;
    try {
      token = await accessToken();
    } catch {
      throw new CommunityError('signed_out', 'Nobody is signed in.');
    }
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new CommunityError('rejected', 'Token is not a JWT.');
    }
    let sub: string | undefined;
    try {
      const payload: unknown = JSON.parse(
        Buffer.from(segments[1], 'base64url').toString('utf8'),
      );
      sub = isRecord(payload) ? readString(payload.sub, 64) : undefined;
    } catch {
      sub = undefined;
    }
    if (!sub) {
      throw new CommunityError('rejected', 'Token has no subject.');
    }
    return sub;
  };

  return {
    getMyProfile: async () =>
      one(
        await request('GET', `profiles?select=*&user_id=eq.${await whoAmI()}`),
        readProfile,
      ),

    createProfile: async (handle, displayName) => {
      const created = one(
        await request(
          'POST',
          'profiles?select=*',
          [{ user_id: await whoAmI(), handle, display_name: displayName }],
          'return=representation',
        ),
        readProfile,
      );
      if (!created) {
        throw new CommunityError('rejected', 'Profile did not come back.');
      }
      return created;
    },

    acceptConduct: async () => {
      await request(
        'PATCH',
        `profiles?user_id=eq.${await whoAmI()}`,
        { accepted_conduct_at: new Date().toISOString() },
        'return=minimal',
      );
    },

    listChannels: async () =>
      readList(
        await request('GET', 'channels?select=*&order=position.asc'),
        readChannel,
      ),

    listMessages: async (channelId, beforeId, limit = 50) => {
      const params = new URLSearchParams({
        select: MESSAGE_SELECT,
        channel_id: `eq.${channelId}`,
        order: 'id.desc',
        limit: String(Math.min(100, Math.max(1, limit))),
      });
      if (beforeId !== undefined) {
        params.set('id', `lt.${beforeId}`);
      }
      return readList(
        await request('GET', `messages?${params.toString()}`),
        readMessage,
      );
    },

    sendMessage: async (channelId, body) => {
      const sent = one(
        await request(
          'POST',
          `messages?select=${MESSAGE_SELECT}`,
          [{ channel_id: channelId, body }],
          'return=representation',
        ),
        readMessage,
      );
      if (!sent) {
        throw new CommunityError('rejected', 'Message did not come back.');
      }
      return sent;
    },

    deleteMessage: async (id) => {
      await request(
        'PATCH',
        `messages?id=eq.${id}`,
        { deleted_at: new Date().toISOString() },
        'return=minimal',
      );
    },

    reportMessage: async (id, reason) => {
      await request(
        'POST',
        'reports',
        [{ message_id: id, reporter_id: await whoAmI(), reason }],
        'return=minimal',
      );
    },

    listBlocks: async () =>
      readList(await request('GET', 'blocks?select=blocked_id'), (entry) =>
        isRecord(entry) ? readString(entry.blocked_id, 64) : undefined,
      ),

    block: async (userId) => {
      await request(
        'POST',
        'blocks',
        [{ blocker_id: await whoAmI(), blocked_id: userId }],
        'return=minimal,resolution=ignore-duplicates',
      );
    },

    unblock: async (userId) => {
      await request('DELETE', `blocks?blocked_id=eq.${userId}`);
    },

    unreadMentions: async () =>
      readList(
        await request(
          'GET',
          'mentions?select=message_id,messages(channel_id)&read_at=is.null',
        ),
        (entry): ICommunityMention | undefined => {
          if (!isRecord(entry) || typeof entry.message_id !== 'number') {
            return undefined;
          }
          const message = isRecord(entry.messages) ? entry.messages : {};
          const channelId = readString(message.channel_id, 32);
          return channelId
            ? { messageId: entry.message_id, channelId }
            : undefined;
        },
      ),

    markMentionsRead: async (messageIds) => {
      if (messageIds.length === 0) {
        return;
      }
      await request(
        'PATCH',
        `mentions?read_at=is.null&message_id=in.(${messageIds.join(',')})`,
        { read_at: new Date().toISOString() },
        'return=minimal',
      );
    },
  };
};
