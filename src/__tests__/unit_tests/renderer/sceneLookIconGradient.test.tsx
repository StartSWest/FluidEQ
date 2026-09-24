/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render } from '@testing-library/react';
import SceneLookIcon from 'renderer/icons/SceneLookIcon';

const SWATCH = ['#ff3cac', '#00e5cf'];

/** The gradient each of an icon's paths is filled from, looked up by id. */
const gradientsOf = (svg: SVGSVGElement) =>
  [...svg.querySelectorAll('path')].map((path) => {
    const match = /^url\(#(.+)\)$/.exec(path.getAttribute('fill') ?? '');
    return match ? document.getElementById(match[1]) : null;
  });

describe("a scene's picker icon", () => {
  // The player's picker and the full app's graph picker draw the same scene
  // at once, and the app's is inside a root the player hides. An id shared
  // between them made the player's icon paint from the hidden copy, which
  // paints nothing: an empty square beside the scene's name.
  it('paints from a gradient of its own, even beside a copy of the same scene', () => {
    const { container } = render(
      <>
        <div hidden>
          <SceneLookIcon swatch={SWATCH} />
        </div>
        <SceneLookIcon swatch={SWATCH} />
      </>,
    );
    const [hidden, shown] = [...container.querySelectorAll('svg')];
    const own = gradientsOf(shown);
    // Every path finds a gradient — the control, or "inside its own icon"
    // below would pass for paths that reference nothing at all.
    expect(own).toHaveLength(3);
    own.forEach((gradient) => {
      expect(gradient).not.toBeNull();
      expect(shown.contains(gradient)).toBe(true);
      expect(hidden.contains(gradient)).toBe(false);
    });
  });

  it('gives two icons of the same colours two different ids', () => {
    const { container } = render(
      <>
        <SceneLookIcon swatch={SWATCH} />
        <SceneLookIcon swatch={SWATCH} />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map(
      (gradient) => gradient.id,
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
