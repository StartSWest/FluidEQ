import { GRAPH_STYLES } from './graphStyles';
import {
  checkMemberSceneSource,
  type TMemberRuleCode,
} from './memberSceneRules';
import { normalizeSceneArtwork } from './sceneArtwork';
import {
  MAX_PARAM_MAGNITUDE,
  MAX_SCENE_PARAMS,
  normalizeScenePack,
  SCENE_PARAM_ID,
  type IScenePack,
  type TLocalizedName,
} from './scenePacks';
import { SCENE_CONTRACT_VERSION } from './sceneUniformContract';

/**
 * Scenes made by FluidEQ Plus members, as opposed to the Plus looks FluidEQ
 * itself publishes.
 *
 * A member scene is an ordinary scene pack — the same engine, the same
 * uniform contract, the same format as an official one in `fluideq-premium`
 * — held to stricter rules, because nobody reads it before it runs. This
 * module is where "a pack" becomes "a member's pack": the source rules from
 * `memberSceneRules.ts`, names short and cleaned of anything that could make
 * one string display as another, and a problem list precise enough for the
 * Studio to say which rule, in which file, on which line.
 */

/** Alongside `custom:` and `premium:`; never a member of `GraphStyle`. */
export const MEMBER_LOOK_PREFIX = 'member:';

/**
 * How many projects the Studio keeps for a member without Plus. Enforced in
 * the main process (`ipc/memberScenes.ts`); the ten `studio.plus.oneProject`
 * and `studio.plus.oneFolder` strings spell the number out in words, so a
 * change here is a change to them too.
 */
export const STUDIO_TRIAL_PROJECTS = 1;

/** Half the official limit: a member's name sits beside its author's. */
export const MAX_MEMBER_NAME_LENGTH = 40;

const PACK_ID = /^[a-z][a-z0-9-]{1,47}$/;
/** Supabase account ids are UUIDs; nothing else is an author. */
const AUTHOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

export const memberLookId = (authorId: string, packId: string): string =>
  `${MEMBER_LOOK_PREFIX}${authorId}:${packId}`;

export const isMemberLookId = (id: string): boolean =>
  id.startsWith(MEMBER_LOOK_PREFIX);

export interface IMemberLookRef {
  authorId: string;
  packId: string;
}

export const parseMemberLookId = (id: string): IMemberLookRef | undefined => {
  if (!isMemberLookId(id)) {
    return undefined;
  }
  const rest = id.slice(MEMBER_LOOK_PREFIX.length);
  const split = rest.indexOf(':');
  if (split < 0) {
    return undefined;
  }
  const authorId = rest.slice(0, split);
  const packId = rest.slice(split + 1);
  return AUTHOR_ID.test(authorId) && PACK_ID.test(packId)
    ? { authorId, packId }
    : undefined;
};

/**
 * Control characters, zero-width characters, bidirectional overrides and
 * isolates, the byte-order mark and the soft hyphen — everything that can make
 * a name display as something other than what it is. Built from code points so
 * this file carries none of them itself.
 *
 * The same set the server refuses in a display name (server migration 0022).
 * The review of 2026-09-13 added the ones that still let a name look blank or
 * pad a look-alike: the combining grapheme joiner, the Arabic letter mark,
 * the Hangul and Khmer fillers, the Mongolian variation selectors and vowel
 * separator, the blank Braille pattern and the variation selectors. The tag
 * characters beyond the basic plane are stripped by `withoutTags` below.
 */
const hex = (code: number) => code.toString(16).padStart(4, '0');
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x34f, 0x34f],
  [0x61c, 0x61c],
  [0x115f, 0x1160],
  [0x17b4, 0x17b5],
  [0x180b, 0x180f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0x2800, 0x2800],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
];
const INVISIBLE_CLASS = `[${INVISIBLE_RANGES.map(
  ([from, to]) => `\\u${hex(from)}-\\u${hex(to)}`,
).join('')}]`;
const INVISIBLE = new RegExp(INVISIBLE_CLASS, 'g');
const HAS_INVISIBLE = new RegExp(INVISIBLE_CLASS);

/** Unicode tag characters, U+E0000 to U+E007F: invisible, and astral. */
const isTag = (character: string) => {
  const code = character.codePointAt(0) ?? 0;
  return code >= 0xe0000 && code <= 0xe007f;
};
const withoutTags = (text: string) =>
  Array.from(text)
    .filter((character) => !isTag(character))
    .join('');

/** Whether `text` carries any character the set above names. */
export const hasInvisibleCharacters = (text: string): boolean =>
  HAS_INVISIBLE.test(text) || Array.from(text).some(isTag);

/**
 * Text a person will read, made safe to show: normalised, cleared of the
 * characters above, whitespace collapsed. `undefined` for anything that is not
 * text, or nothing once cleaned. Length is the caller's rule, not this one's —
 * a name that is too long deserves a sentence saying so, not a silent cut.
 */
export const sanitizeDisplayText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const cleaned = withoutTags(value.normalize('NFC').replace(INVISIBLE, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
};

export type TMemberSceneFile = 'pack.json' | 'source' | 'artwork';

export type TMemberProblemCode =
  | TMemberRuleCode
  | 'not-a-pack'
  | 'bad-id'
  | 'names-missing'
  | 'name-too-long'
  | 'bad-fallback'
  | 'bad-swatch'
  | 'bad-artwork'
  | 'contract-too-new'
  | 'bad-param'
  | 'too-many-params'
  | 'bad-ambient'
  // Raised by the project folder reader, never by a pack in memory.
  | 'bad-json'
  | 'missing-file'
  | 'unsafe-path'
  | 'file-too-large';

export interface IMemberSceneProblem {
  code: TMemberProblemCode;
  file: TMemberSceneFile;
  /** One-based, in the author's own file, when the problem has a line. */
  line?: number;
}

export type TMemberSceneCheck =
  | { ok: true; pack: IScenePack }
  | { ok: false; problems: IMemberSceneProblem[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every name cleaned; `tooLong` when any of them breaks the limit. */
const cleanNames = (value: unknown) => {
  if (!isRecord(value)) {
    return { names: undefined, tooLong: false };
  }
  const names: Record<string, string> = {};
  let tooLong = false;
  Object.entries(value).forEach(([locale, name]) => {
    const cleaned = sanitizeDisplayText(name);
    if (!cleaned) {
      return;
    }
    if (cleaned.length > MAX_MEMBER_NAME_LENGTH) {
      tooLong = true;
    }
    names[locale] = cleaned;
  });
  return { names, tooLong };
};

const cleanParams = (value: unknown) => {
  if (!Array.isArray(value)) {
    return { params: value, tooLong: false };
  }
  let tooLong = false;
  const params = value.map((param: unknown) => {
    if (!isRecord(param)) {
      return param;
    }
    const cleaned = cleanNames(param.names);
    tooLong = tooLong || cleaned.tooLong;
    return { ...param, names: cleaned.names };
  });
  return { params, tooLong };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Whether one entry of `params` is a control the scene will really get. */
const isWholeParam = (entry: unknown): boolean => {
  if (
    !isRecord(entry) ||
    typeof entry.id !== 'string' ||
    !SCENE_PARAM_ID.test(entry.id)
  ) {
    return false;
  }
  const { min, max, value } = entry;
  return (
    Boolean(cleanNames(entry.names).names?.en) &&
    isFiniteNumber(min) &&
    isFiniteNumber(max) &&
    min < max &&
    Math.max(Math.abs(min), Math.abs(max)) <= MAX_PARAM_MAGNITUDE &&
    (value === undefined || isFiniteNumber(value))
  );
};

/**
 * What is wrong with the controls in a project's `pack.json`, for its author
 * to fix.
 *
 * `normalizeScenePack` repairs what it can and drops the rest, which is right
 * for a scene already out in the world: one that plays keeps playing. In the
 * author's own folder it hid the mistake. A control dropped for its id or its
 * name is a uniform never declared, so the scene failed on a compiler line
 * about `uParam_` that points at nothing in `pack.json`; one the shader did
 * not use simply never appeared as a slider. The Studio names it instead.
 */
export const checkProjectParams = (value: unknown): TMemberProblemCode[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return ['bad-param'];
  }
  const problems: TMemberProblemCode[] = [];
  const ids = value.map((entry: unknown) =>
    isRecord(entry) ? entry.id : undefined,
  );
  const repeated = ids.some((id, index) => ids.indexOf(id) !== index);
  if (repeated || !value.every(isWholeParam)) {
    problems.push('bad-param');
  }
  if (value.length > MAX_SCENE_PARAMS) {
    problems.push('too-many-params');
  }
  return problems;
};

/**
 * A member's pack, or every reason it cannot be one.
 *
 * The specific checks run first so the Studio can name the actual mistake;
 * `normalizeScenePack` runs last as the same gate every official pack passes,
 * and anything it still refuses is reported as not a pack at all.
 */
export const checkMemberScene = (raw: unknown): TMemberSceneCheck => {
  if (!isRecord(raw)) {
    return { ok: false, problems: [{ code: 'not-a-pack', file: 'pack.json' }] };
  }
  const problems: IMemberSceneProblem[] = [];
  const add = (
    code: TMemberProblemCode,
    file: TMemberSceneFile = 'pack.json',
  ) => problems.push({ code, file });

  if (typeof raw.id !== 'string' || !PACK_ID.test(raw.id)) {
    add('bad-id');
  }
  const { names, tooLong } = cleanNames(raw.names);
  if (!names?.en) {
    add('names-missing');
  }
  const params = cleanParams(raw.params);
  if (tooLong || params.tooLong) {
    add('name-too-long');
  }
  if (!GRAPH_STYLES.some((style) => style === raw.fallbackStyle)) {
    add('bad-fallback');
  }
  const swatch = Array.isArray(raw.swatch)
    ? raw.swatch.filter(
        (colour): colour is string =>
          typeof colour === 'string' && HEX_COLOUR.test(colour),
      )
    : [];
  if (swatch.length < 2 || swatch.length > 4) {
    add('bad-swatch');
  }
  if (
    typeof raw.contract === 'number' &&
    raw.contract > SCENE_CONTRACT_VERSION
  ) {
    add('contract-too-new');
  }
  if (raw.artwork !== undefined && !normalizeSceneArtwork(raw.artwork)) {
    add('bad-artwork', 'artwork');
  }
  if (typeof raw.source === 'string') {
    checkMemberSceneSource(raw.source).forEach(({ code, line }) =>
      problems.push({ code, file: 'source', line }),
    );
  }
  if (problems.length > 0) {
    return { ok: false, problems };
  }

  const pack = normalizeScenePack({
    ...raw,
    names: names as TLocalizedName,
    params: params.params,
  });
  return pack
    ? { ok: true, pack }
    : { ok: false, problems: [{ code: 'not-a-pack', file: 'pack.json' }] };
};
