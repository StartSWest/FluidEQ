import { GRAPH_STYLES } from './graphStyles';
import {
  checkMemberSceneSource,
  checkMemberWorldHook,
  type IMemberRuleViolation,
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
 * `studio.plus.oneFolder` and `studio.plus.lockedProject` strings spell the
 * number out in words, so a change here is a change to them too.
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

export type TMemberSceneFile = 'pack.json' | 'source' | 'artwork' | 'world';

/**
 * The picture FluidEQ writes into a project folder after each build, for the
 * member's AI to look at (`main/ipc/studioPreview.ts`).
 *
 * Here rather than beside the main process's other project file names because
 * three places need it and one of them is the window: the AI prompt names the
 * file so the assistant knows to open it, main writes it, and the folder
 * watcher ignores it. A renderer importing it from main would pull `fs` into
 * the window's bundle behind it.
 */
export const PREVIEW_FILE = 'preview.png';

export type TMemberProblemCode =
  | TMemberRuleCode
  | 'not-a-pack'
  | 'bad-id'
  | 'names-missing'
  | 'name-too-long'
  | 'bad-fallback'
  | 'bad-swatch'
  | 'bad-artwork'
  | 'bad-param'
  | 'too-many-params'
  | 'bad-ambient'
  // The 3D world (`sceneWorld.ts`) left nothing to draw, or a model in it
  // does not carry everything it needs inside itself.
  | 'bad-world'
  | 'bad-model'
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
 * Every rule a 3D world's own GLSL breaks, material by material, each at its
 * line in the piece the author wrote. A world's GLSL runs per vertex and per
 * pixel exactly as a scene's does, so it answers to the same rules
 * (`checkMemberWorldHook`), and a hook that breaks one is never compiled.
 */
export const checkWorldHooks = (world: unknown): IMemberRuleViolation[] => {
  if (!isRecord(world) || !isRecord(world.materials)) {
    return [];
  }
  const violations: IMemberRuleViolation[] = [];
  Object.values(world.materials).forEach((material) => {
    if (!isRecord(material)) {
      return;
    }
    (['vertex', 'fragment'] as const).forEach((stage) => {
      const source = material[stage];
      if (typeof source === 'string') {
        violations.push(...checkMemberWorldHook(source, stage));
      }
    });
  });
  return violations;
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
 * This is the AUTHOR's check, and only the author's: it is strict so the
 * Studio can point at the actual mistake while there is still somebody there
 * to fix it. A scene already out in the world is read by `readMemberScene`
 * below, which repairs instead of refusing — holding a listener's copy to
 * this would take a scene off their picker over something they cannot fix and
 * did not do.
 *
 * The specific checks run first so the Studio can name the actual mistake;
 * `normalizeScenePack` runs last as the same gate every official pack passes,
 * and anything it still refuses is reported as not a pack at all.
 *
 * The contract number is deliberately not checked. It says what the scene was
 * written against, not what it needs — see `normalizeScenePack` — and refusing
 * on it is what made Crystal, published at contract 7, unopenable on every app
 * that spoke contract 6.
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
  if (raw.artwork !== undefined && !normalizeSceneArtwork(raw.artwork)) {
    add('bad-artwork', 'artwork');
  }
  if (typeof raw.source === 'string') {
    checkMemberSceneSource(raw.source).forEach(({ code, line }) =>
      problems.push({ code, file: 'source', line }),
    );
  }
  checkWorldHooks(raw.world).forEach(({ code, line }) =>
    problems.push({ code, file: 'world', line }),
  );
  if (problems.length > 0) {
    return { ok: false, problems };
  }

  const pack = normalizeScenePack({
    ...raw,
    names: names as TLocalizedName,
    params: params.params,
  });
  if (!pack) {
    return { ok: false, problems: [{ code: 'not-a-pack', file: 'pack.json' }] };
  }
  // A listener's copy with no world left still plays its shader; the
  // author's is told, while there is somebody to add what was missing.
  if (raw.world !== undefined && !pack.world) {
    return { ok: false, problems: [{ code: 'bad-world', file: 'world' }] };
  }
  return { ok: true, pack };
};

/**
 * A member's scene as this copy of FluidEQ can play it, or nothing.
 *
 * The listener's side of `checkMemberScene`. A scene in somebody's looks was
 * made somewhere else, by a FluidEQ that may be newer than the one reading it
 * now, and there is nobody at that machine who can correct it — so everything
 * that can be repaired is repaired rather than refused. A name past the
 * members' limit is cut, a form this version has not got becomes the default
 * one, a control it cannot read is left out, and the scene stays in the
 * picker. Only a document with nothing left to draw gives up.
 *
 * The source rules are the one exception, and they are not about versions:
 * they are what stops a scene holding the graphics card until Windows resets
 * the display driver for every program on the machine. A source that breaks
 * them is not run here, whatever wrote it.
 */
export const readMemberScene = (raw: unknown): IScenePack | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  if (
    typeof raw.source === 'string' &&
    checkMemberSceneSource(raw.source).length > 0
  ) {
    return undefined;
  }
  // A world whose GLSL breaks a rule is not run, whatever wrote it; the
  // scene keeps its shader, which is the scene an older FluidEQ plays.
  const world =
    raw.world !== undefined && checkWorldHooks(raw.world).length === 0
      ? { world: raw.world }
      : {};
  const { names } = cleanNames(raw.names);
  const cut = Object.fromEntries(
    Object.entries(names ?? {}).map(([locale, name]) => [
      locale,
      name.slice(0, MAX_MEMBER_NAME_LENGTH),
    ]),
  );
  const { world: dropped, ...rest } = raw;
  return (
    normalizeScenePack({
      ...rest,
      ...world,
      names: cut,
      params: cleanParams(raw.params).params,
    }) ?? undefined
  );
};
