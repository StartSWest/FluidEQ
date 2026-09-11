import type {
  IForumPerson,
  TForumAuthorRole,
} from '../../common/forum/forumTypes';

/**
 * Readers for JSON that came from outside the process.
 *
 * GitHub's answers and the published feed are both somebody else's data, so
 * nothing is cast: every field is read through one of these, and a field that
 * is missing or the wrong type becomes a harmless default instead of an
 * `undefined` that surfaces three components later.
 */

export type TRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const rec = (value: unknown): TRecord => (isRecord(value) ? value : {});

export const arr = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

export const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

export const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const bool = (value: unknown): boolean => value === true;

/** An https URL, or nothing: these end up as link targets and image sources. */
export const httpsUrl = (value: unknown): string | null => {
  const text = str(value);
  return /^https:\/\//.test(text) ? text : null;
};

/**
 * An avatar at the size it is drawn. GitHub serves the original upload when
 * no size is asked for — 460px for a picture shown at 36 — and a list of
 * twenty-five topics is twenty-five of those.
 */
const sizedAvatar = (value: unknown): string | null => {
  const url = httpsUrl(value);
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === 'avatars.githubusercontent.com' &&
      !parsed.searchParams.has('s')
    ) {
      parsed.searchParams.set('s', '80');
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

export const person = (value: unknown): IForumPerson => {
  const author = rec(value);
  return {
    login: str(author.login) || 'ghost',
    avatarUrl: sizedAvatar(author.avatarUrl),
    url: httpsUrl(author.url),
  };
};

/**
 * GitHub's relationship of the author to the repository, reduced to what the
 * panel marks. The owner is the maker; a member or collaborator is somebody
 * who maintains it; everybody else is just a person.
 */
export const authorRole = (association: unknown): TForumAuthorRole => {
  switch (association) {
    case 'OWNER':
      return 'maker';
    case 'MEMBER':
    case 'COLLABORATOR':
      return 'maintainer';
    default:
      return 'none';
  }
};

/** GitHub gives the category emoji as `<div>📣</div>`; the character is the point. */
export const emojiOf = (emojiHtml: unknown): string =>
  str(emojiHtml)
    .replace(/<[^>]*>/g, '')
    .trim();

/** A line of plain text for a list row: whitespace folded, cut at a word. */
export const excerptOf = (text: string, max = 220): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) {
    return flat;
  }
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

/**
 * Whether a topic was opened by giscus. The website's comment box creates a
 * topic under this bot and posts the person's words as its first comment, so
 * a topic authored by it has its real author and opening post one level down.
 * GraphQL names the bot `giscus` and REST `giscus[bot]`; both are accepted so
 * the answer does not depend on which API a caller happened to read.
 */
export const isGiscus = (author: IForumPerson): boolean =>
  author.login === 'giscus' || author.login === 'giscus[bot]';
