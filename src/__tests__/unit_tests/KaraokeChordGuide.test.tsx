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
import { createKaraokeLiveValue } from '../../renderer/karaoke/karaokeLiveValue';

const chord = (startMs: number, label: string, confidence = 0.8) => ({
  startMs,
  endMs: startMs + 2_000,
  label,
  confidence,
});

// A row of chips over the pitch strip since the K1 mockup (Ivan,
// 2026-11-15: "with the chords on top of it exactly as the mockups"): the
// chord just played, the one sounding, tinted, and the next two. It was a
// panel of labelled boxes with a countdown.
describe('KaraokeChordGuide', () => {
  it('shows the chord just played, the one sounding and the next two', () => {
    const { container } = render(
      <KaraokeChordGuide
        status="ready"
        progress={createKaraokeLiveValue(1)}
        playheadMs={3_000}
        chords={[
          chord(0, 'Am'),
          chord(2_000, 'C', 0.87),
          chord(4_000, 'G'),
          chord(6_000, 'D'),
          chord(8_000, 'E'),
        ]}
      />,
    );

    expect(
      screen.getByRole('status', {
        name: 'Estimated guitar chords from the backing track',
      }),
    ).toBeVisible();
    const chips = [...container.querySelectorAll('.karaoke-chords__chip')];
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Am',
      'C',
      'G',
      'D',
    ]);
    const current = screen.getByText('C');
    expect(current).toHaveClass('is-current');
    expect(current).toHaveAttribute('title', 'Audio estimate confidence: 87%');
    // The control: the one played and the ones coming are not tinted.
    expect(screen.getByText('Am')).not.toHaveClass('is-current');
    expect(screen.getByText('G')).toHaveClass('is-next');
  });

  it('shows the last chord and the next between two, with none sounding', () => {
    const { container } = render(
      <KaraokeChordGuide
        status="ready"
        progress={createKaraokeLiveValue(1)}
        playheadMs={2_500}
        chords={[{ ...chord(0, 'Am'), endMs: 2_000 }, chord(3_000, 'C')]}
      />,
    );
    expect(
      [...container.querySelectorAll('.karaoke-chords__chip')].map(
        (chip) => chip.textContent,
      ),
    ).toEqual(['Am', 'C']);
    expect(container.querySelector('.is-current')).toBeNull();
  });

  it('reports local analysis progress before chords are ready', () => {
    render(
      <KaraokeChordGuide
        status="analyzing"
        progress={createKaraokeLiveValue(0.42)}
        playheadMs={0}
        chords={[]}
      />,
    );

    expect(screen.getByText('Finding chords… 42%')).toBeVisible();
  });

  it('says so when no stable chord was found', () => {
    render(
      <KaraokeChordGuide
        status="ready"
        progress={createKaraokeLiveValue(1)}
        playheadMs={0}
        chords={[]}
      />,
    );
    expect(screen.getByText('No stable chord found')).toBeVisible();
  });
});
