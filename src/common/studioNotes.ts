import { readVersionNote } from './sceneVersionNote';

/** Editing context only. Never included in executable or signed scene packs. */
export interface IStudioNotes {
  description: string;
  prompt: string;
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
}

export const MAX_STUDIO_DESCRIPTION = 1200;
export const MAX_STUDIO_PROMPT = 64000;

export const parseStudioNotes = (raw: unknown): IStudioNotes | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const { description, prompt, whatsNew } = raw as Record<string, unknown>;
  if (
    typeof description !== 'string' ||
    description.length > MAX_STUDIO_DESCRIPTION ||
    typeof prompt !== 'string' ||
    prompt.length > MAX_STUDIO_PROMPT
  ) {
    return undefined;
  }
  // Dropped rather than refused: a line too long or full of invisible
  // characters is a suggestion this version cannot offer, never a reason to
  // lose the description and the prompt beside it.
  const line = whatsNew === undefined ? null : readVersionNote(whatsNew);
  return {
    description,
    prompt,
    ...(line ? { whatsNew: line } : {}),
  };
};
