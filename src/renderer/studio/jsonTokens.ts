import type { IGlslPiece } from './glslTokens';

/**
 * One line of a JSON file, cut into the pieces the Studio's Code tab
 * colours, in the kinds the shader's colouring already has so one palette
 * serves both: a key reads as a shader's uniform does (the names a reader
 * looks for), a string as a built-in, and numbers and the three bare words
 * as they do in GLSL. A picture of the file for the eye, like `glslPieces`,
 * never a parser: a line that is not JSON is shown as plain text.
 */

const TOKEN =
  /("(?:[^"\\]|\\.)*")(?=\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

const KINDS: readonly IGlslPiece['kind'][] = [
  'uniform',
  'builtin',
  'number',
  'keyword',
];

const jsonPieces = (line: string): IGlslPiece[] => {
  const pieces: IGlslPiece[] = [];
  let last = 0;
  line.replace(TOKEN, (match: string, ...groups: unknown[]) => {
    const offset = groups[KINDS.length];
    if (typeof offset !== 'number') {
      return match;
    }
    if (offset > last) {
      pieces.push({ kind: 'text', text: line.slice(last, offset) });
    }
    const index = groups
      .slice(0, KINDS.length)
      .findIndex((group) => group !== undefined);
    pieces.push({ kind: KINDS[index] ?? 'text', text: match });
    last = offset + match.length;
    return match;
  });
  if (last < line.length) {
    pieces.push({ kind: 'text', text: line.slice(last) });
  }
  return pieces;
};

export default jsonPieces;
