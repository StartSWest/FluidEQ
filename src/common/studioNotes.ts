import {
  MAX_VERSION_NOTE,
  readVersionNote,
  VERSION_NOTE_LOCALES,
  type TVersionNoteLocale,
  type TVersionNotes,
} from './sceneVersionNote';

/** The notes' file, beside pack.json in the project's own folder. */
export const STUDIO_NOTES_FILE = 'studio-notes.json';

/**
 * THE one statement of where the publish dialog's line lives and in what
 * shape, quoted wherever an AI is told to write it: the chat's brief, the
 * brief for an outside AI, FluidEQ's own asks, the chat's tool and the
 * Studio's skills (Ivan, 2026-11-13: "the agent is lost, doesn't know where
 * notes I am talking about"). A chat asked for a first version's line read
 * other scenes' files, added a header and a description, and gave up calling
 * its last try "still a guess" - the publish box empty and Send held the
 * whole time. English: it is read by a model.
 */
export const STUDIO_NOTES_CONTRACT = `THE PUBLISH LINE. FluidEQ's Publish dialog fills its "What's new" box only from ${STUDIO_NOTES_FILE} beside pack.json. Write it with the write_whats_new tool when you have it; otherwise the file is JSON and the line is its "whatsNew" key, an object with ${VERSION_NOTE_LOCALES.join(', ')} ("en" required), each one line of at most ${MAX_VERSION_NOTE} characters. Keep the file's other keys; add no header or schema. A first version needs the line too, saying what the scene is; an update says what changed since the Gallery's version. Never read other projects to learn this.`;

/**
 * Editing context only. Never included in executable or signed scene packs.
 *
 * Only what is the member's: `description`, their words from "Describe your
 * scene", kept exactly as written, and `whatsNew`, the line their AI wrote
 * about its change. FluidEQ's brief is never kept here (Ivan, 2026-11-09:
 * "lets not have that there because updating it on each release not good
 * since the scene has the old prompt"): it is built from the running
 * FluidEQ whenever it is used - each chat, each copy for another AI - so a
 * scene folder never holds a brief an update cannot reach. Notes written
 * before carry it as `prompt`; reading drops it.
 */
export interface IStudioNotes {
  description: string;
  /**
   * One line of what changed since the last publication, written by the
   * member's AI as it finishes (see `aiPrompt.ts`) and offered as the note
   * when they publish. Nobody remembers what they changed three days later,
   * and the assistant that changed it does — so the line arrives written and
   * the member edits it rather than facing an empty box.
   *
   * Cleaned by the same rule the published note is, so what is offered is
   * always something that can be sent.
   */
  whatsNew?: string;
  /**
   * The same line in every language the AI wrote it in (Ivan, 2026-11-12:
   * each listener reads it in their own), `whatsNew` being its English. The
   * file holds `"whatsNew"` as that object, or as the English line alone as
   * every version before 2.5.1 wrote it; absent for the latter.
   */
  whatsNewLines?: TVersionNotes;
  /**
   * The file names a line FluidEQ cannot use: not text, every language too
   * long, or no English among them. Said in the publish dialog rather than
   * shown as an empty box nobody can explain.
   */
  whatsNewUnreadable?: true;
  /**
   * When the file was last written, in ms: told by the read, never stored
   * (a save is parsed, which drops it). A line older than the gallery's
   * version is about that version, not the next one (`usePublishNote.ts`).
   */
  writtenAt?: number;
  /**
   * When FluidEQ last published a version from these notes and took its
   * line out, in ms. Notes without it were last published by a FluidEQ that
   * kept the line, so a line in them older than the gallery's version is
   * that version's; notes with it hold only lines written since.
   */
  published?: number;
  /**
   * The idea a stored brief carried after "MY IDEA:" where it differs from
   * `description`: the member's own words from before, kept when the brief
   * around them was taken out, never lost with it. One of Ivan's 43 folders
   * had one (ridgeline: an 890-character brief beside a 223-character
   * description).
   */
  earlierIdea?: string;
}

export const MAX_STUDIO_DESCRIPTION = 1200;
/**
 * Room for anything an old brief carried: the limit a whole stored brief
 * had, so no idea notes could hold is ever left out.
 */
const MAX_EARLIER_IDEA = 128000;

/** The words after the last "MY IDEA:" of a brief notes used to keep. */
const ideaOfStoredBrief = (prompt: unknown): string | undefined => {
  if (typeof prompt !== 'string') {
    return undefined;
  }
  const at = prompt.lastIndexOf('MY IDEA:');
  return at === -1 ? undefined : prompt.slice(at + 'MY IDEA:'.length).trim();
};

/** A key as an AI may spell it, reduced to its letters and digits. */
const squeezed = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Names an AI gives the line, best first. "whatsNew" is the one FluidEQ
 * writes and asks for; the rest are what models reach for when told to
 * write "release notes" or "a note" (2026-11-13), and a line under one of
 * them is still the member's line.
 */
const NOTE_KEYS = [
  'whatsnew',
  'whatsnewlines',
  'releasenotes',
  'releasenote',
  'versionnote',
  'versionnotes',
  'note',
  'notes',
  'changelog',
];

/** Whether a key of the notes is one the publish line is read from. */
export const isNoteKey = (key: string): boolean =>
  NOTE_KEYS.includes(squeezed(key));

/** Language names and regional tags an AI writes, as FluidEQ's languages. */
const LOCALE_ALIASES: Record<string, TVersionNoteLocale> = {
  english: 'en',
  german: 'de',
  deutsch: 'de',
  spanish: 'es',
  espanol: 'es',
  french: 'fr',
  hindi: 'hi',
  italian: 'it',
  japanese: 'ja',
  korean: 'ko',
  portuguese: 'pt',
  russian: 'ru',
  chinese: 'zh',
  zhcn: 'zh',
  zhsg: 'zh',
  zhhans: 'zh',
  zhhanscn: 'zh',
  simplifiedchinese: 'zh',
  zhtw: 'zh-Hant',
  zhhk: 'zh-Hant',
  zhmo: 'zh-Hant',
  zhhant: 'zh-Hant',
  zhhanttw: 'zh-Hant',
  traditionalchinese: 'zh-Hant',
};

/**
 * The FluidEQ language a key names: exactly, as an alias, or by its first
 * part ("pt-BR" is Portuguese, "en_US" English). Undefined for anything
 * else, which is skipped rather than refusing the lines beside it.
 */
export const noteLocaleOf = (key: string): TVersionNoteLocale | undefined => {
  const exact = VERSION_NOTE_LOCALES.find((locale) => locale === key);
  if (exact) {
    return exact;
  }
  const alias = LOCALE_ALIASES[squeezed(key)];
  if (alias) {
    return alias;
  }
  const primary = key
    .trim()
    .toLowerCase()
    .split(/[-_\s]/)[0];
  return VERSION_NOTE_LOCALES.find((locale) => locale === primary);
};

/**
 * The line as an AI left it, kept wherever it can be: a plain line is the
 * English one; in an object every language FluidEQ knows is kept, a key in
 * a spelling of its own read as its language, and a key or a line it cannot
 * use dropped alone instead of costing every other (the old reader refused
 * the whole object for one "pt-BR" or one line too long, and the publish box
 * stayed empty with nothing to say why). `unreadable` when there was a line
 * and nothing in it can be offered.
 */
export const readLooseNoteLines = (
  value: unknown,
): { lines?: TVersionNotes; unreadable: boolean } => {
  if (value === undefined || value === null) {
    return { unreadable: false };
  }
  if (typeof value === 'string') {
    const line = readVersionNote(value);
    if (line === null) {
      return { unreadable: false };
    }
    return line === undefined
      ? { unreadable: true }
      : { lines: { en: line }, unreadable: false };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { unreadable: true };
  }
  const kept: Partial<Record<TVersionNoteLocale, string>> = {};
  // Exact names first, so "zh" is never taken over by a "zh-CN" beside it.
  const entries = Object.entries(value).sort(
    ([a], [b]) => Number(noteLocaleOf(b) === b) - Number(noteLocaleOf(a) === a),
  );
  let offered = false;
  entries.forEach(([key, written]) => {
    const locale = noteLocaleOf(key);
    const line = readVersionNote(written);
    offered = offered || (written !== undefined && written !== null);
    if (locale && typeof line === 'string' && kept[locale] === undefined) {
      kept[locale] = line;
    }
  });
  const { en } = kept;
  if (en === undefined) {
    return { unreadable: offered };
  }
  return { lines: { ...kept, en }, unreadable: false };
};

/** The line under whichever name an AI gave it (`NOTE_KEYS`). */
const noteValueOf = (raw: Record<string, unknown>): unknown => {
  const byName = new Map(
    Object.entries(raw).map(([key, value]) => [squeezed(key), value] as const),
  );
  const found = NOTE_KEYS.find((key) => byName.get(key) !== undefined);
  return found === undefined ? undefined : byName.get(found);
};

/**
 * Notes an AI wrote as text instead of JSON - a line, or a line under a
 * Markdown heading: the words, headings and rules left out, as the line.
 */
export const notesFromPlainText = (text: string): Record<string, unknown> => {
  const words = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) => line && !line.startsWith('#') && !/^[-=*_]{3,}$/.test(line),
    )
    .join(' ');
  return words ? { whatsNew: words } : {};
};

export const parseStudioNotes = (raw: unknown): IStudioNotes | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const { description: written, prompt, earlierIdea, published } = record;
  const whatsNew = noteValueOf(record);
  // Beside an update note, no description is an empty one. The member's AI
  // is told to make the file with the note alone when there is none, and a
  // file of {"whatsNew": ...} was refused whole for lacking the description:
  // the line was written, read as no notes, and the publish box stayed
  // empty. Anything else without one is still no notes.
  const description =
    written === undefined && whatsNew !== undefined ? '' : written;
  if (
    typeof description !== 'string' ||
    description.length > MAX_STUDIO_DESCRIPTION
  ) {
    return undefined;
  }
  // Dropped rather than refused: a line too long or full of invisible
  // characters is a suggestion this version cannot offer, never a reason to
  // lose the description beside it.
  const loose = readLooseNoteLines(whatsNew);
  const lines =
    whatsNew !== null && typeof whatsNew === 'object' ? loose.lines : undefined;
  const line = loose.lines?.en;
  const fromBrief = ideaOfStoredBrief(prompt);
  let earlier: string | undefined;
  if (typeof earlierIdea === 'string' && earlierIdea.trim()) {
    earlier = earlierIdea;
  } else if (fromBrief && fromBrief !== description.trim()) {
    earlier = fromBrief;
  }
  return {
    description,
    ...(line ? { whatsNew: line } : {}),
    ...(lines ? { whatsNewLines: lines } : {}),
    ...(loose.unreadable ? { whatsNewUnreadable: true as const } : {}),
    ...(earlier && earlier.length <= MAX_EARLIER_IDEA
      ? { earlierIdea: earlier }
      : {}),
    ...(typeof published === 'number' && Number.isFinite(published)
      ? { published }
      : {}),
  };
};

/**
 * The notes as the file holds them: the line in every language, when there
 * is one, under `whatsNew` itself, the key the member's AI writes and every
 * FluidEQ reads, never beside it under a name of the app's own.
 */
export const storedStudioNotes = (
  notes: IStudioNotes,
): Record<string, unknown> => {
  const { whatsNewLines, writtenAt, whatsNewUnreadable, ...rest } = notes;
  return whatsNewLines ? { ...rest, whatsNew: whatsNewLines } : rest;
};

/**
 * Whether the notes' update line was written before the gallery's version
 * went out (`galleryAt`, ms), and so is about that version, not the next:
 * only notes no FluidEQ has published from since lines were taken out at
 * publishing (2026-11-12), whose file is older than that version.
 */
export const isOldNote = (
  notes: IStudioNotes | undefined,
  galleryAt: number | undefined,
): boolean =>
  notes?.whatsNew !== undefined &&
  notes.published === undefined &&
  notes.writtenAt !== undefined &&
  galleryAt !== undefined &&
  notes.writtenAt < galleryAt;

/** Whether notes as written still carry a brief, to be taken out. */
export const notesHoldBrief = (raw: unknown): boolean =>
  !!raw && typeof raw === 'object' && 'prompt' in raw;
