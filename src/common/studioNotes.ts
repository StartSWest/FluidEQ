/** Editing context only. Never included in executable or signed scene packs. */
export interface IStudioNotes {
  description: string;
  prompt: string;
}

export const MAX_STUDIO_DESCRIPTION = 1200;
export const MAX_STUDIO_PROMPT = 64000;

export const parseStudioNotes = (raw: unknown): IStudioNotes | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const { description, prompt } = raw as Record<string, unknown>;
  if (
    typeof description !== 'string' ||
    description.length > MAX_STUDIO_DESCRIPTION ||
    typeof prompt !== 'string' ||
    prompt.length > MAX_STUDIO_PROMPT
  ) {
    return undefined;
  }
  return { description, prompt };
};
