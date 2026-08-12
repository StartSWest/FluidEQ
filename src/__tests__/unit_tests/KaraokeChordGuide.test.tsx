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

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import KaraokeChordGuide from '../../renderer/karaoke/KaraokeChordGuide';

describe('KaraokeChordGuide', () => {
  it('shows the current and upcoming estimated guitar chords', () => {
    render(
      <KaraokeChordGuide
        status="ready"
        progress={1}
        playheadMs={1_000}
        chords={[
          {
            startMs: 0,
            endMs: 2_000,
            rootPitchClass: 0,
            quality: 'major',
            label: 'C',
            confidence: 0.87,
          },
          {
            startMs: 2_000,
            endMs: 4_000,
            rootPitchClass: 7,
            quality: 'major',
            label: 'G',
            confidence: 0.81,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('status', {
        name: 'Estimated guitar chords from the backing track',
      }),
    ).toBeVisible();
    expect(screen.getByText('Estimated chord')).toBeVisible();
    expect(screen.getByText('C')).toBeVisible();
    expect(screen.getByText('Next')).toBeVisible();
    expect(screen.getByText('G')).toBeVisible();
    expect(screen.getByText('in 1.0s')).toBeVisible();
  });

  it('reports local analysis progress before chords are ready', () => {
    render(
      <KaraokeChordGuide
        status="analyzing"
        progress={0.42}
        playheadMs={0}
        chords={[]}
      />,
    );

    expect(screen.getByText('Finding chords… 42%')).toBeVisible();
  });
});
