/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { GRAPH_FORM_LOOKS } from '../../../common/graphStyles';
import {
  ROOT,
  SOURCES_FILE,
  codeOf,
  hashSources,
  type IStillSources,
} from '../../../../scripts/look-stills/freshness';
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
 * so this fails then and names what changed: run the script again.
 */

const kept = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8')) as IStillSources;

it('was drawn from the looks as the app draws them now', () => {
  const missing = kept.files
    .map(({ file }) => file)
    .filter((file) => !fs.existsSync(path.join(ROOT, file)));
  expect({ missing }).toEqual({ missing: [] });
  const now = hashSources(kept.files.map(({ file }) => file));
  const changed = kept.files
    .filter(
      ({ file, hash }, index) =>
        now.files[index]?.file !== file || now.files[index]?.hash !== hash,
    )
    .map(({ file }) => file);
  // Run `pnpm stills:looks`: these files changed since the stills were drawn.
  expect({ changed }).toEqual({ changed: [] });
  expect(now.hash).toBe(kept.hash);
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
});

it('lists what the looks are drawn from, and the drawing itself among it', () => {
  const files = kept.files.map(({ file }) => file);
  expect(files).toEqual(
    expect.arrayContaining([
      'src/renderer/graph/LiveTraceCanvas.tsx',
      'src/renderer/graph/drawLiveTraceFrame.ts',
      'src/renderer/graph/lookStills/stillRoles.ts',
      'scripts/look-stills/fit.ts',
    ]),
  );
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
