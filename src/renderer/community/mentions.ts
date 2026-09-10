/**
 * Where the @handles are in a message body.
 *
 * The same pattern the server uses to derive mentions, so what is highlighted
 * on screen is exactly what the server notified. Pure, and tested on its own:
 * the message row only has to map these pieces to elements.
 */

export interface IBodySegment {
  kind: 'text' | 'mention';
  text: string;
  /** Character offset in the body — unique per segment, so a stable key. */
  start: number;
  /** For a mention: the handle, lowercase, without the @. */
  handle?: string;
}

const MENTION = /@([A-Za-z0-9_]{3,20})/g;

export const splitMentions = (body: string): IBodySegment[] => {
  const segments: IBodySegment[] = [];
  let last = 0;
  body.replace(MENTION, (match, handle: string, offset: number) => {
    if (offset > last) {
      segments.push({
        kind: 'text',
        text: body.slice(last, offset),
        start: last,
      });
    }
    segments.push({
      kind: 'mention',
      text: match,
      start: offset,
      handle: handle.toLowerCase(),
    });
    last = offset + match.length;
    return match;
  });
  if (last < body.length) {
    segments.push({ kind: 'text', text: body.slice(last), start: last });
  }
  return segments;
};

/** Whether this body names the given handle. */
export const mentionsHandle = (body: string, handle: string): boolean =>
  splitMentions(body).some(
    (segment) => segment.kind === 'mention' && segment.handle === handle,
  );
