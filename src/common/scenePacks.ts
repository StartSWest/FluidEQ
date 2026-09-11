import {
  canonicalGraphStyle,
  GRAPH_STYLES,
  type GraphStyle,
} from './graphStyles';
import type { LocaleCode } from './i18n';
import { normalizeSceneArtwork, type ISceneArtwork } from './sceneArtwork';
import {
  isNeutralResponse,
  readResponse,
  type ISceneResponse,
} from './sceneResponse';

/**
 * A premium look, as data.
 *
 * FluidEQ is GPL and it is not the only copyright holder in its own tree, so a
 * look that ships as code inside the app is part of the app and travels under
 * the same licence. A look that ships as a DOCUMENT the app plays does not —
 * the same way a level is not part of the game engine that loads it. That is
 * why a premium look is a fragment shader plus a handful of numbers, and why
 * this format exists beside `.fluideq-look.json` rather than inside it: a
 * custom look changes the tuning of geometry compiled into the app (see the
 * comment in `customLooks.ts` on why it deliberately cannot change the
 * geometry itself), and a scene pack is nothing BUT geometry.
 *
 * The two formats also fail differently. A look file that does not parse is a
 * mis-clicked screenshot and the answer is "nothing found". A scene pack
 * arrives signed, and "the signature did not verify" is a different sentence
 * from "this is not a pack" — so the parser here is separate, and the signature
 * check lives in the main process ahead of it.
 *
 * Everything is clamped and bounded on the way in, exactly as `customLooks.ts`
 * does. The one thing a normalizer cannot repair is refused: a pack with no
 * English name, no id, or a fallback form the app has never heard of is not a
 * pack the app can draw a row for.
 */

export const SCENE_PACK_SCHEMA = 1;

/** Alongside `custom:`; never a member of `GraphStyle`. */
export const PREMIUM_LOOK_PREFIX = 'premium:';

/**
 * Bounds on what the driver is asked to compile.
 *
 * ANGLE translates GLSL to HLSL before Direct3D compiles it, and that pipeline
 * is superlinear in source length — a 300 KB shader can take seconds and does
 * so on the render thread. Sixty-four kilobytes is an order of magnitude past
 * anything a scene needs, and it also bounds what a compromised server could
 * hand the GPU.
 */
export const MAX_SHADER_BYTES = 64 * 1024;
export const MAX_SCENE_PARAMS = 8;
export const MAX_SWATCH_COLOURS = 4;
// Accommodate a 6 MiB lossless atlas after base64 expansion, plus the bounded
// shader and metadata. Decoded artwork dimensions are checked separately.
export const MAX_PACK_BYTES = 9 * 1024 * 1024;

/** English is mandatory: a row in the picker with no name is unusable. */
export type TLocalizedName = Partial<Record<LocaleCode, string>> & {
  en: string;
};

export interface IScenePackParam {
  /** Uniform suffix: the preamble declares `uniform float uParam_<id>`. */
  id: string;
  names: TLocalizedName;
  min: number;
  max: number;
  value: number;
}

export interface IScenePack {
  schema: number;
  /** Server-issued and stable. The picker id is `premium:<id>`. */
  id: string;
  /** Bumped by the author. The cache compares it to decide a re-download. */
  version: number;
  /** The uniform contract this shader was written against. */
  contract: number;
  names: TLocalizedName;
  /** The free form drawn whenever this scene cannot run. */
  fallbackStyle: GraphStyle;
  /** Two to four hex colours for the picker row's icon. No GL needed. */
  swatch: string[];
  /**
   * GLSL ES 3.00 body providing `vec4 sceneColour(vec2 uv)`. Never a whole
   * program: the app owns the version line, the uniforms and `main()`.
   */
  source: string;
  params: IScenePackParam[];
  /** Optional signed colour atlas; paid image bytes stay in the scene pack. */
  artwork?: ISceneArtwork;
  /** Optional bottom/top of the live dB scale in normalized panel coordinates. */
  spectrumRange?: readonly [number, number];
  /**
   * How the scene answers the music (see `sceneResponse.ts`), as its author
   * tuned it. Absent means as the engine hears it.
   */
  response?: ISceneResponse;
}

/**
 * The signed wrapper a pack travels in.
 *
 * The signature covers the LITERAL payload bytes, carried as base64, and the
 * bytes are parsed only after they verify. That deletes the canonicalisation
 * problem outright — no key ordering, no whitespace, no BOM to argue about.
 */
export interface IScenePackEnvelope {
  schema: number;
  keyId: string;
  algorithm: 'ed25519';
  payload: string;
  signature: string;
}

/**
 * A Plus look the account cannot draw yet, as the picker shows it.
 *
 * What the server's public catalogue answers for every pack: enough to paint a
 * row — the name in every language, the swatch for its icon, the free form it
 * stands in for — and nothing that is worth paying for. The shader source
 * never travels this way.
 */
export interface IScenePackCatalogueEntry {
  id: string;
  version: number;
  names: TLocalizedName;
  fallbackStyle: GraphStyle;
  swatch: string[];
}

export const premiumLookId = (packId: string): string =>
  `${PREMIUM_LOOK_PREFIX}${packId}`;

export const isPremiumLookId = (id: string): boolean =>
  id.startsWith(PREMIUM_LOOK_PREFIX);

export const packIdOfLook = (lookId: string): string =>
  lookId.slice(PREMIUM_LOOK_PREFIX.length);

/**
 * A locked row's id in the picker. Its own prefix, never `premium:`: a locked
 * row is not a selectable look, and giving it a real look's id would let the
 * cycle, the stored selection and the plot click all land on something that
 * cannot draw. Choosing one opens the upgrade card instead.
 */
export const LOCKED_LOOK_PREFIX = 'locked:';

export const lockedLookId = (packId: string): string =>
  `${LOCKED_LOOK_PREFIX}${packId}`;

export const isLockedLookId = (id: string): boolean =>
  id.startsWith(LOCKED_LOOK_PREFIX);

const PACK_ID = /^[a-z][a-z0-9-]{1,47}$/;
const PARAM_ID = /^[a-z][a-z0-9_]{0,23}$/;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
/** The one thing every pack must provide, at the top level of the source. */
const SCENE_ENTRY_POINT = /\bvec4\s+sceneColour\s*\(\s*vec2\s+\w+\s*\)/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readNames = (value: unknown): TLocalizedName | null => {
  if (!isRecord(value) || typeof value.en !== 'string' || !value.en.trim()) {
    return null;
  }
  const names: Record<string, string> = {};
  Object.entries(value).forEach(([locale, name]) => {
    if (typeof name === 'string' && name.trim() && name.length <= 80) {
      names[locale] = name.trim();
    }
  });
  return names as TLocalizedName;
};

const readParam = (value: unknown): IScenePackParam | null => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }
  if (!PARAM_ID.test(value.id)) {
    return null;
  }
  const names = readNames(value.names);
  if (!names) {
    return null;
  }
  const min = readNumber(value.min, 0);
  const max = Math.max(min, readNumber(value.max, 1));
  return {
    id: value.id,
    names,
    min,
    max,
    value: clamp(readNumber(value.value, min), min, max),
  };
};

const readSwatch = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .filter((entry) => HEX_COLOUR.test(entry))
    .slice(0, MAX_SWATCH_COLOURS)
    .map((entry) => entry.toLowerCase());
};

const isGraphStyle = (value: unknown): value is GraphStyle =>
  typeof value === 'string' && GRAPH_STYLES.some((style) => style === value);

/**
 * The source, or nothing.
 *
 * Refuses a `#version` line, because the app supplies one and a second is a
 * compile error on every driver. Refuses a source with no `sceneColour`, since
 * the app's `main()` calls it and a shader without it fails to link with a
 * message that names nothing the author wrote.
 */
const readSource = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  if (
    value.length === 0 ||
    new TextEncoder().encode(value).byteLength > MAX_SHADER_BYTES
  ) {
    return null;
  }
  if (/^\s*#version\b/m.test(value)) {
    return null;
  }
  return SCENE_ENTRY_POINT.test(value) ? value : null;
};

/**
 * A pack from anything, or `null` for the three things clamping cannot repair.
 *
 * The fallback form goes through `canonicalGraphStyle` so a pack naming a form
 * the app has since retired lands on that form's replacement — the same
 * mechanism a saved look from an older version already uses.
 */
export const normalizeScenePack = (raw: unknown): IScenePack | null => {
  if (!isRecord(raw)) {
    return null;
  }
  if (typeof raw.schema !== 'number' || raw.schema > SCENE_PACK_SCHEMA) {
    return null;
  }
  if (typeof raw.id !== 'string' || !PACK_ID.test(raw.id)) {
    return null;
  }
  const names = readNames(raw.names);
  const source = readSource(raw.source);
  if (!names || !source || !isGraphStyle(raw.fallbackStyle)) {
    return null;
  }
  const artwork =
    raw.artwork === undefined ? undefined : normalizeSceneArtwork(raw.artwork);
  if (artwork === null || (artwork && readNumber(raw.contract, 1) < 2)) {
    return null;
  }
  let spectrumRange: readonly [number, number] | undefined;
  if (raw.spectrumRange !== undefined) {
    const range = raw.spectrumRange;
    if (
      !Array.isArray(range) ||
      range.length !== 2 ||
      !range.every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      ) ||
      range[0] < 0 ||
      range[1] > 1 ||
      range[1] - range[0] < 0.2 ||
      readNumber(raw.contract, 1) < 4
    ) {
      return null;
    }
    spectrumRange = [range[0], range[1]];
  }
  const params: IScenePackParam[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.params)) {
    raw.params.forEach((entry) => {
      const param = readParam(entry);
      if (param && !seen.has(param.id) && params.length < MAX_SCENE_PARAMS) {
        seen.add(param.id);
        params.push(param);
      }
    });
  }
  // Kept in range rather than refused: a response is taste, and a slider
  // pushed past its end is still the author's meaning.
  const response =
    raw.response === undefined ? undefined : readResponse(raw.response);
  return {
    schema: raw.schema,
    id: raw.id,
    version: Math.max(1, Math.round(readNumber(raw.version, 1))),
    contract: Math.max(1, Math.round(readNumber(raw.contract, 1))),
    names,
    fallbackStyle: canonicalGraphStyle(raw.fallbackStyle),
    swatch: readSwatch(raw.swatch),
    source,
    params,
    ...(artwork ? { artwork } : {}),
    ...(spectrumRange ? { spectrumRange } : {}),
    ...(response && !isNeutralResponse(response) ? { response } : {}),
  };
};

/**
 * One row of the public catalogue, or `null`.
 *
 * The server decodes the signed payload and hands back the picker's fields in
 * its own column names. Nothing here is signed — it is a list of names and
 * colours, not something the GPU runs — so the checks are the same ones a pack
 * gets on the fields it shares, and a row that fails them is dropped rather
 * than repaired: a locked row with no name or no form to stand in for is not a
 * row the picker can show.
 */
export const normalizeCatalogueEntry = (
  raw: unknown,
): IScenePackCatalogueEntry | null => {
  if (!isRecord(raw)) {
    return null;
  }
  if (typeof raw.id !== 'string' || !PACK_ID.test(raw.id)) {
    return null;
  }
  const names = readNames(raw.names);
  if (!names || !isGraphStyle(raw.fallback_style)) {
    return null;
  }
  return {
    id: raw.id,
    version: Math.max(1, Math.round(readNumber(raw.version, 1))),
    names,
    fallbackStyle: canonicalGraphStyle(raw.fallback_style),
    swatch: readSwatch(raw.swatch),
  };
};

/** Never throws: the bytes arrived over a network and were signed, not vetted. */
export const parseScenePackPayload = (json: string): IScenePack | null => {
  if (new TextEncoder().encode(json).byteLength > MAX_PACK_BYTES) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  return normalizeScenePack(raw);
};

const isBase64 = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(value);

/** The wrapper's shape, before any cryptography is attempted on it. */
export const isScenePackEnvelope = (
  value: unknown,
): value is IScenePackEnvelope =>
  isRecord(value) &&
  value.schema === SCENE_PACK_SCHEMA &&
  typeof value.keyId === 'string' &&
  /^[a-z0-9-]{1,32}$/.test(value.keyId) &&
  value.algorithm === 'ed25519' &&
  isBase64(value.payload) &&
  isBase64(value.signature);

/**
 * The name to show, in the reader's language.
 *
 * The same fallback chain the dictionaries use — locale, then English, then
 * the key itself — so the picker, the gallery and a tooltip cannot disagree.
 * Never routed through `t()`: a runtime name is not a translation key, and the
 * test that guards the key namespace exists because one once rendered as its
 * own key in the menu with nothing failing anywhere.
 */
export const resolveSceneName = (
  pack: { names: TLocalizedName },
  locale: LocaleCode,
): string => pack.names[locale] ?? pack.names.en;

export const resolveParamName = (
  param: IScenePackParam,
  locale: LocaleCode,
): string => param.names[locale] ?? param.names.en;
