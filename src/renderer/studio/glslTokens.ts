/**
 * One line of a scene's GLSL, cut into the pieces the Studio's code pane
 * colours: comments, numbers, the language's own words, the scene contract's
 * uniforms, built-in functions and the scene's own. Only what a reader's eye
 * uses to find its way; this is a picture of code, not a parser. A block
 * comment is coloured line by line as text — the scenes write `//`.
 */

export type TGlslToken =
  'text' | 'comment' | 'number' | 'keyword' | 'uniform' | 'builtin' | 'call';

export interface IGlslPiece {
  kind: TGlslToken;
  text: string;
}

const KEYWORDS =
  'float|int|bool|vec2|vec3|vec4|mat2|mat3|mat4|const|for|if|else|return|void|in|out|uniform|sampler2D|true|false';
const BUILTINS =
  'sin|cos|tan|atan|abs|mix|smoothstep|step|exp|pow|length|fract|floor|ceil|clamp|max|min|mod|dot|normalize|sqrt|texture|fwidth';

const TOKEN = new RegExp(
  [
    '(\\/\\/.*$)',
    '(\\b\\d+\\.?\\d*\\b)',
    `\\b(${KEYWORDS})\\b`,
    '\\b(u[A-Z]\\w*)\\b',
    `\\b(${BUILTINS})\\b(?=\\s*\\()`,
    '\\b([A-Za-z_]\\w*)(?=\\s*\\()',
  ].join('|'),
  'g',
);

const KINDS: readonly TGlslToken[] = [
  'comment',
  'number',
  'keyword',
  'uniform',
  'builtin',
  'call',
];

export const glslPieces = (line: string): IGlslPiece[] => {
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
