/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

import {
  commitPaneSizes,
  getEditorHeight,
  setEditorHeight,
} from '../../renderer/utils/paneSizes';

describe('workspace pane sizes', () => {
  it('resizes and persists each response graph divider independently', () => {
    window.localStorage.clear();
    const untouchedHeight = getEditorHeight('autoeq');

    setEditorHeight(220, 'eq');
    setEditorHeight(360, 'karaoke');

    expect(getEditorHeight('eq')).toBe(220);
    expect(getEditorHeight('karaoke')).toBe(360);
    expect(getEditorHeight('autoeq')).toBe(untouchedHeight);

    commitPaneSizes();
    const stored = JSON.parse(
      window.localStorage.getItem('fluideq.editorShareByTab') ?? '{}',
    ) as Record<string, number>;
    expect(stored.eq).not.toBe(stored.karaoke);
    expect(stored.autoeq).toBeUndefined();
  });
});
