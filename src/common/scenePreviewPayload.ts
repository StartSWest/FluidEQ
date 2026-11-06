import { blankGlslComments } from './memberGlslSource';

/** The signing service's existing source transformation, shared for preview
 * identity. It never changes the author's local source or rendered program. */
export const stripPublishedGlslComments = (source: string): string | null => {
  const blanked = blankGlslComments(source);
  if (blanked === null) {
    return null;
  }
  return `${blanked
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
};

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const nodesWithoutNames = (nodes: unknown): unknown =>
  Array.isArray(nodes)
    ? nodes.map((node) => {
        if (!record(node)) {
          return node;
        }
        const { name: _name, ...rest } = node;
        return { ...rest, children: nodesWithoutNames(rest.children) };
      })
    : nodes;

/** The exact scene data that publishing signs: source/hook comments and world
 * editor-only node names are normalized by the SAME transformation on both
 * sides. All runtime settings, asset/model bytes and semantic GLSL remain in
 * the digest. Keys use code-unit order, independent of OS locale/ICU. */
export const canonicalPreviewPayload = (pack: unknown): string => {
  if (!record(pack) || typeof pack.source !== 'string') {
    throw new Error('Invalid preview scene payload');
  }
  const source = stripPublishedGlslComments(pack.source);
  if (source === null) {
    throw new Error('Unterminated preview shader comment');
  }
  const next: Record<string, unknown> = { ...pack, source };
  if (record(pack.world) && record(pack.world.materials)) {
    const materials = Object.fromEntries(
      Object.entries(pack.world.materials).map(([id, material]) => {
        if (!record(material)) {
          return [id, material];
        }
        const copy = { ...material };
        ['vertex', 'fragment'].forEach((stage) => {
          if (typeof copy[stage] === 'string') {
            const stripped = stripPublishedGlslComments(copy[stage]);
            if (stripped === null) {
              throw new Error('Unterminated preview material comment');
            }
            copy[stage] = stripped;
          }
        });
        return [id, copy];
      }),
    );
    next.world = {
      ...pack.world,
      materials,
      nodes: nodesWithoutNames(pack.world.nodes),
    };
  }
  return JSON.stringify(next, (_key, value: unknown) =>
    record(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]]),
        )
      : value,
  );
};
