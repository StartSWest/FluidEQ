/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ts from 'typescript';
import { GRAPH_FORM_LOOKS } from '../../../common/graphStyles';
import {
  codeOf,
  everyPiece,
  readKept,
  staleLooks,
  type IStillSources,
} from '../../../../scripts/look-stills/freshness';
import {
  SourceReader,
  refId,
} from '../../../../scripts/look-stills/stillSources';
import { shippedStillKey } from '../../../renderer/graph/lookStills/shippedStill';
import SHIPPED_STILL_FILES from '../../../renderer/graph/lookStills/shippedStillFiles';
import {
  STILL_COLOURS,
  STILL_SIDES,
  stillRoleNames,
} from '../../../renderer/graph/lookStills/stillRoles';

/**
 * The look picker's shipped stills (`renderer/graph/lookStills`) are drawn
 * ahead of time by `pnpm stills:looks` from the looks' own drawing code. A
 * look changed since is a still that shows a look the app no longer draws,
 * so this fails then and names the look and what changed under it: run the
 * script, which draws those looks again and no other.
 *
 * What a still is drawn from is what ran while it was drawn and what that
 * read (`scripts/look-stills/stillSources.ts`), so the controls below edit
 * code the window has and no still draws, and code a still does.
 */

const FORMS = GRAPH_FORM_LOOKS.map((look) => look.style);

const loaded = readKept();
if (!loaded) {
  throw new Error(
    'No list of what the stills were drawn from: run `pnpm stills:looks --all`.',
  );
}
const kept: IStillSources = loaded;
const reader = new SourceReader();

/** Every piece some still was drawn from, by `refId`. */
const drawnFrom = new Set(everyPiece(kept).map((piece) => refId(piece.ref)));

const staleWith = (edited: SourceReader) =>
  Object.fromEntries(
    [...staleLooks(kept, edited, FORMS)].map(([look, changed]) => [
      look,
      changed.map(({ file, key, how }) => `${file} ${key} ${how}`),
    ]),
  );

/** `text` with `inserted` put in at `at`, as somebody typing it would. */
const typedInto = (file: string, at: number, inserted: string) => {
  const text = reader.text(file) ?? '';
  return reader.edited(
    file,
    `${text.slice(0, at)}${inserted}${text.slice(at)}`,
  );
};

/**
 * `file` with the top-level piece `key` changed as an edit would change it:
 * its first number one more, or, with none, a statement at the head of its
 * first block, or an argument more in its first call. Nothing outside the
 * piece moves.
 */
const editedPiece = (file: string, key: string): SourceReader => {
  const text = reader.text(file);
  const unit = reader.unit({ file, key });
  if (text === undefined || !unit) {
    throw new Error(`No ${key} in ${file}.`);
  }
  const [start, end] = unit.ranges[0];
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    text,
    undefined,
    start,
    end - start,
  );
  let blockAt: number | undefined;
  let callAt: number | undefined;
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (token === ts.SyntaxKind.NumericLiteral) {
      return typedInto(file, scanner.getTokenEnd(), ' + 1');
    }
    if (token === ts.SyntaxKind.OpenBraceToken && blockAt === undefined) {
      blockAt = scanner.getTokenEnd();
    }
    if (token === ts.SyntaxKind.OpenParenToken && callAt === undefined) {
      callAt = scanner.getTokenEnd();
    }
  }
  if (blockAt !== undefined) {
    return typedInto(file, blockAt, ' void 0; ');
  }
  if (callAt !== undefined) {
    return typedInto(file, callAt, 'void 0, ');
  }
  throw new Error(`Nothing to edit in ${key} of ${file}.`);
};

it('was drawn from the looks as the app draws them now', () => {
  // Run `pnpm stills:looks`: it draws these looks again, and no other.
  expect(staleWith(reader)).toEqual({});
});

// The control for the test above: it sees a change to the code, and only
// that - a comment rewritten or a file reformatted is not a new look.
it('tells a changed look from a comment rewritten or a file reformatted', () => {
  const look = 'const glow = 0.26; // the halo\nexport default glow;';
  const reworded =
    '/* the glow */ const glow = 0.26;\n\n  export default glow ;';
  const changed = 'const glow = 0.3; // the halo\nexport default glow;';
  expect(codeOf(reworded, 'look.ts')).toBe(codeOf(look, 'look.ts'));
  expect(codeOf(changed, 'look.ts')).not.toBe(codeOf(look, 'look.ts'));
  const file = 'src/renderer/graph/slopeField.ts';
  const text = reader.text(file) ?? '';
  const noted = `// A note.\n${text.replace(
    'export const advanceSlopeField = (',
    'export const advanceSlopeField = ( // how the field moves\n',
  )}\n\n`;
  expect(noted).toContain('how the field moves');
  expect(staleWith(reader.edited(file, noted))).toEqual({});
});

/**
 * What these files hold runs in the window and decides no still: the state
 * provider the window is wrapped in, the stored graph settings, the history
 * of looks played. Each landing that touched one used to cost a whole run
 * of the generator.
 */
const NOT_DRAWN_FROM = [
  'src/renderer/utils/FluidEqContext.tsx',
  'src/renderer/utils/fluidEqContextTypes.ts',
  'src/renderer/utils/graphStorage.ts',
  'src/renderer/utils/lookHistory.ts',
];

it('leaves every still as it is when the window changes code no still is drawn from', () => {
  const edited = NOT_DRAWN_FROM.flatMap((file) =>
    (reader.units(file)?.units ?? [])
      .filter((unit) => !drawnFrom.has(refId({ file, key: unit.key })))
      .map((unit) => ({ file, key: unit.key })),
  );
  // The provider is among them: it is never mounted on the stills' page.
  expect(edited).toEqual(
    expect.arrayContaining([
      {
        file: 'src/renderer/utils/FluidEqContext.tsx',
        key: 'FluidEqProvider',
      },
    ]),
  );
  edited.forEach(({ file, key }) =>
    expect({ file, key, stale: staleWith(editedPiece(file, key)) }).toEqual({
      file,
      key,
      stale: {},
    }),
  );
  // A file of types alone runs nothing at all.
  const types = 'src/renderer/utils/fluidEqContextTypes.ts';
  expect(
    staleWith(
      reader.edited(
        types,
        `${reader.text(types) ?? ''}\nexport interface IAdded { more: number }\n`,
      ),
    ),
  ).toEqual({});
});

it('leaves out a callback that never ran, inside code that did', () => {
  // The graph's look store wakes when a custom look is deleted: that
  // callback never runs on the stills' page, the line handing it over does.
  const file = 'src/renderer/utils/graphStyle.ts';
  const text = reader.text(file) ?? '';
  const handing = 'subscribeCustomLooks(() => {';
  const at = text.indexOf(handing);
  expect(at).toBeGreaterThan(0);
  expect(
    everyPiece(kept).some(
      ({ ref, leftOut }) =>
        ref.file === file && ref.key === 'effects' && leftOut.length > 0,
    ),
  ).toBe(true);
  expect(staleWith(typedInto(file, at + handing.length, ' void 0; '))).toEqual(
    {},
  );
  // The control: the same edit outside the callback reaches every still.
  expect(
    Object.keys(staleWith(typedInto(file, at, 'void 0; '))).sort(),
  ).toEqual([...FORMS].sort());
});

it('draws again the looks whose drawing changed, and only those', () => {
  // Slope's field: how its ticks lean on the music.
  const slope = staleWith(
    editedPiece('src/renderer/graph/slopeField.ts', 'advanceSlopeField'),
  );
  expect(Object.keys(slope)).toEqual(['slope']);
  // A colour every look is split into: every still.
  const roles = staleWith(
    editedPiece(
      'src/renderer/graph/lookStills/stillRoles.ts',
      'readStillRoles',
    ),
  );
  expect(Object.keys(roles).sort()).toEqual([...FORMS].sort());
});

it('sees an import pointed at another module, though the code reading it is the same', () => {
  const file = 'src/renderer/graph/slopeField.ts';
  const text = reader.text(file) ?? '';
  const repointed = text.replace(
    "import noise from 'common/seededNoise';",
    "import noise from 'common/smoothing';",
  );
  expect(repointed).not.toBe(text);
  expect(Object.keys(staleWith(reader.edited(file, repointed)))).toEqual([
    'slope',
  ]);
});

it('ships every standard look, on both sides of the Brightness, in one colour and many', () => {
  const missing = GRAPH_FORM_LOOKS.flatMap((look) =>
    STILL_SIDES.flatMap((side) =>
      STILL_COLOURS.map((colours) =>
        shippedStillKey(look.style, 'auto', side, colours),
      ),
    ),
  ).filter((key) => SHIPPED_STILL_FILES[key] === undefined);
  expect({ missing }).toEqual({ missing: [] });
});

it('paints each still only in colours the window hands the looks', () => {
  const unknown = Object.entries(SHIPPED_STILL_FILES).flatMap(([key, file]) => {
    const [style, , , colours] = key.split(' ');
    const roles = stillRoleNames(
      colours as (typeof STILL_COLOURS)[number],
      style,
    );
    return file.roles
      .filter((role) => !roles.includes(role))
      .map((role) => `${key}: ${role}`);
  });
  expect({ unknown }).toEqual({ unknown: [] });
});
