import fs from 'fs';
import path from 'path';
import type { IAccountConfig } from '../../common/accountConfig';
import type { TAudioEngine } from '../../common/audioEngine';
import writeFileAtomically from '../atomicWrite';

/**
 * How many computers run each audio engine, as anonymous daily totals (Ivan,
 * 2026-11-13: "solo totales"; premium 0110).
 *
 * At most once a day per computer, this sends one word — `fluid`, `apo` or
 * `none` — and the server adds one to that day's total for it, reading
 * nothing about who asked. What decides "once a day" is a date kept on this
 * computer, never anything the server could recognise.
 *
 * Only for a signed-in account that has been shown terms revision 13, which
 * is the text that says this count is made (as revision 10 gated the first
 * engine report). Somebody signed out has never been shown the terms, so
 * their computer is never counted.
 */

/** The terms revision that says this count is made. */
export const ENGINE_COUNT_TERMS = 13;

/** The one word a computer is counted under. */
export type TCountedEngine = TAudioEngine | 'none';

const DAY_FILE = 'engine-count.json';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** This computer's own calendar day, as YYYY-MM-DD. */
export const localDay = (now: Date): string =>
  [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

export interface IEngineCountDeps {
  config: IAccountConfig;
  userDataDir: string;
  /** The engine chosen on this computer, or null when none is yet. */
  getEngine: () => TAudioEngine | null;
  /** The signed-in account, or undefined when nobody is. */
  accountId: () => string | undefined;
  accessToken: () => Promise<string>;
  /** Whether the account has been shown terms revision `version`. */
  toldOf: (version: number) => boolean;
  logger: { warn(message: string, ...args: unknown[]): void };
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface IEngineCount {
  /** Counts this computer for today, unless it already was or may not be. */
  countIfDue(reason: string): Promise<void>;
}

export const createEngineCount = ({
  config,
  userDataDir,
  getEngine,
  accountId,
  accessToken,
  toldOf,
  logger,
  fetchImpl = fetch,
  now = () => new Date(),
}: IEngineCountDeps): IEngineCount => {
  const dayFile = path.join(userDataDir, DAY_FILE);

  // The day this computer was last counted: a date and nothing else.
  const countedDay = (): string | undefined => {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(dayFile, 'utf8'));
      const day: unknown =
        typeof parsed === 'object' && parsed !== null
          ? Reflect.get(parsed, 'day')
          : undefined;
      return typeof day === 'string' && DAY_PATTERN.test(day) ? day : undefined;
    } catch {
      // Never written, or unreadable: counted again today at worst.
      return undefined;
    }
  };

  // One count at a time: two come-back events in a row must not both find
  // today uncounted and send twice.
  let inFlight: Promise<void> | undefined;

  const count = async (reason: string): Promise<void> => {
    if (accountId() === undefined || !toldOf(ENGINE_COUNT_TERMS)) {
      return;
    }
    const today = localDay(now());
    if (countedDay() === today) {
      return;
    }
    const engine: TCountedEngine = getEngine() ?? 'none';
    let response: Response;
    try {
      response = await fetchImpl(
        new URL('/rest/v1/rpc/count_audio_engine', config.supabaseUrl),
        {
          method: 'POST',
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${await accessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_engine: engine }),
        },
      );
    } catch (error) {
      // Offline, or signed out mid-way: tried again at the next event.
      logger.warn(`Engine count not sent (${reason}).`, error);
      return;
    }
    // A server before premium 0110 has nothing to count into (404): today is
    // marked all the same, so it is not asked again at every event.
    if (response.ok || response.status === 404) {
      writeFileAtomically(dayFile, JSON.stringify({ day: today }));
      return;
    }
    logger.warn(`Engine count refused (${reason}): ${response.status}.`);
  };

  return {
    countIfDue: (reason) => {
      inFlight ??= count(reason).finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
  };
};
