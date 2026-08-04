/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as d3 from 'd3';

/**
 * The graph animates by calling `.transition()` on a d3 selection, and that
 * method does not exist on its own — `d3-transition` installs it onto
 * `selection.prototype` when the module is evaluated, and nothing in this
 * codebase refers to it by name.
 *
 * That combination is invisible to every other kind of check. It type-checks,
 * because the types are declared whether or not the module is linked in. It
 * runs in tests, because Jest resolves the real package. It only breaks in a
 * bundle, and only if the bundler has been told the package is free of side
 * effects — which is exactly what happened in 0.6.0: webpack concluded nothing
 * referenced d3-transition, dropped it, and every chart threw
 * "e.transition is not a function" on first paint.
 *
 * So this asserts the shape of the dependency rather than any behaviour. It
 * cannot catch a bundler misconfiguration by itself, but it is the anchor for
 * the comment in the webpack config, and it fails loudly if anyone ever
 * "cleans up" the `import * as d3` that keeps the module reachable.
 */
describe('d3 transitions', () => {
  it('are installed onto the selection prototype', () => {
    const selection = d3.select(document.createElement('div'));
    expect(typeof selection.transition).toBe('function');
    expect(typeof selection.interrupt).toBe('function');
  });

  it('are reachable through the namespace the graph imports', () => {
    // The graph uses `import * as d3`, so anything that makes the namespace
    // partial — a bundler dropping a submodule, someone narrowing the import
    // to named exports — takes the prototype patch with it.
    expect(typeof d3.transition).toBe('function');
    expect(typeof d3.easeLinear).toBe('function');
    expect(typeof d3.select).toBe('function');
  });
});
