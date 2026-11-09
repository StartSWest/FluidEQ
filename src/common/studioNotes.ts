import { readVersionNote } from './sceneVersionNote';

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

export const parseStudioNotes = (raw: unknown): IStudioNotes | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const { description, prompt, whatsNew, earlierIdea } = raw as Record<
    string,
    unknown
  >;
  if (
    typeof description !== 'string' ||
    description.length > MAX_STUDIO_DESCRIPTION
  ) {
    return undefined;
  }
  // Dropped rather than refused: a line too long or full of invisible
  // characters is a suggestion this version cannot offer, never a reason to
  // lose the description beside it.
  const line = whatsNew === undefined ? null : readVersionNote(whatsNew);
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
    ...(earlier && earlier.length <= MAX_EARLIER_IDEA
      ? { earlierIdea: earlier }
      : {}),
  };
};

/** Whether notes as written still carry a brief, to be taken out. */
export const notesHoldBrief = (raw: unknown): boolean =>
  !!raw && typeof raw === 'object' && 'prompt' in raw;
