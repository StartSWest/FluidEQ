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
import { fireEvent, render, screen } from '@testing-library/react';
import { IKaraokeSong } from '../../common/karaoke/types';
import KaraokeLyrics, {
  lyricHitRegionContains,
} from '../../renderer/karaoke/KaraokeLyrics';
import {
  groupKaraokeTokensIntoWords,
  karaokeLyricEntranceOpacity,
  karaokeTokenDisplayText,
} from '../../renderer/karaoke/karaokeLyricText';

const song: IKaraokeSong = {
  id: 'motion-song',
  title: 'Motion Song',
  assets: [],
  timingPrecision: 'line',
  lines: Array.from({ length: 6 }, (_, index) => ({
    id: `line-${index}`,
    startMs: index * 1_000,
    endMs: (index + 1) * 1_000,
    tokens: [{ text: `Line ${index + 1}` }],
  })),
  pitch: { kind: 'none', reason: 'missing' },
  meta: { sourceFormat: 'lrc', gapMs: 0 },
};

describe('KaraokeLyrics motion', () => {
  beforeEach(() => {
    window.localStorage.removeItem('fluideq-karaoke-lyric-text-size');
  });

  it('keeps one canvas mounted while the focused lyric advances', () => {
    const { container, rerender } = render(
      <KaraokeLyrics song={song} playheadMs={1_200} onSeek={jest.fn()} />,
    );
    const lyricCanvas = screen.getByRole('button', { name: 'Lyric line 2' });
    expect(lyricCanvas.tagName).toBe('CANVAS');
    expect(lyricCanvas).toHaveAttribute('aria-current', 'true');

    rerender(
      <KaraokeLyrics song={song} playheadMs={2_200} onSeek={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Lyric line 3' })).toBe(
      lyricCanvas,
    );
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(container.querySelector('.karaoke-lyrics > li')).toBeNull();
    expect(container.querySelector('.karaoke-lyrics__token')).toBeNull();
  });

  it('keeps a macro-recording target centered despite incorrect old timing', () => {
    render(
      <KaraokeLyrics
        song={song}
        playheadMs={1_200}
        onSeek={jest.fn()}
        centerLineId="line-5"
        showFollowButton={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Lyric line 6' }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('prepares the first lyric before its timing and eases it into view', () => {
    const delayedSong = {
      ...song,
      lines: song.lines.map((line) => ({
        ...line,
        startMs: (line.startMs ?? 0) + 1_000,
        endMs: (line.endMs ?? 0) + 1_000,
      })),
    };

    render(
      <KaraokeLyrics song={delayedSong} playheadMs={0} onSeek={jest.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: 'Lyric line 1' }),
    ).toHaveAttribute('aria-current', 'true');
    expect(karaokeLyricEntranceOpacity(0)).toBe(0);
    expect(karaokeLyricEntranceOpacity(280)).toBeCloseTo(0.875);
    expect(karaokeLyricEntranceOpacity(560)).toBe(1);
  });

  it('shows a section marker with its first lyric two seconds early', () => {
    const sectionSong: IKaraokeSong = {
      ...song,
      lines: [
        {
          id: 'intro-marker',
          kind: 'section',
          startMs: 3_000,
          endMs: 5_000,
          tokens: [{ text: '[Intro]' }],
        },
        {
          id: 'intro-lyric',
          startMs: 5_000,
          endMs: 7_000,
          tokens: [{ text: 'The real first line' }],
        },
      ],
    };

    render(
      <KaraokeLyrics
        song={sectionSong}
        playheadMs={3_000}
        onSeek={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Lyric line 2' }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('restores word spacing without separating joined syllables', () => {
    const first = { text: 'to', startsWord: true };
    expect(
      karaokeTokenDisplayText({ text: 'gether', startsWord: false }, 1, first),
    ).toBe('gether');
    expect(
      karaokeTokenDisplayText({ text: 'again', startsWord: true }, 1, first),
    ).toBe(' again');
    expect(
      karaokeTokenDisplayText({ text: 'again', startsWord: true }, 1, {
        text: 'to ',
      }),
    ).toBe('again');
  });

  it('groups timed syllables into indivisible visual words', () => {
    const words = groupKaraokeTokensIntoWords([
      { text: 'to', startsWord: true, startMs: 0, endMs: 200 },
      { text: 'geth', startsWord: false, startMs: 200, endMs: 400 },
      { text: 'er', startsWord: false, startMs: 400, endMs: 600 },
      { text: ' again', startsWord: true, startMs: 600, endMs: 900 },
      { text: '', startsWord: false, startMs: 900, endMs: 1_000 },
    ]);

    expect(words.map((word) => word.text)).toEqual(['together', ' again']);
    expect(words[0].tokens).toHaveLength(3);
    expect(words[1].tokens).toHaveLength(2);
  });

  it('only treats the painted lyric rectangle as clickable', () => {
    const region = {
      index: 2,
      left: 240,
      right: 560,
      top: 180,
      bottom: 220,
    };

    expect(lyricHitRegionContains(region, 400, 200)).toBe(true);
    expect(lyricHitRegionContains(region, 40, 200)).toBe(false);
    expect(lyricHitRegionContains(region, 760, 200)).toBe(false);
    expect(lyricHitRegionContains(region, 400, 150)).toBe(false);
  });

  it('moves the next phrase into focus as soon as the current phrase ends', () => {
    const songWithBreath = {
      ...song,
      lines: song.lines.map((line, index) =>
        index === 1 ? { ...line, endMs: 1_500 } : line,
      ),
    };
    render(
      <KaraokeLyrics
        song={songWithBreath}
        playheadMs={1_700}
        onSeek={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Lyric line 3' }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('pauses auto-follow while wheel browsing and resumes on demand', () => {
    const onSeek = jest.fn();
    const { rerender } = render(
      <KaraokeLyrics song={song} playheadMs={3_200} onSeek={onSeek} />,
    );

    fireEvent.wheel(screen.getByRole('button', { name: 'Lyric line 4' }), {
      deltaY: -120,
    });

    expect(screen.getByRole('button', { name: 'Follow lyrics' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lyric line 3' })).toBeVisible();
    expect(onSeek).not.toHaveBeenCalled();

    rerender(<KaraokeLyrics song={song} playheadMs={4_200} onSeek={onSeek} />);
    expect(screen.getByRole('button', { name: 'Lyric line 3' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Follow lyrics' }));

    expect(
      screen.queryByRole('button', { name: 'Follow lyrics' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lyric line 5' })).toBeVisible();
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('can hide the local follow action for an embedded preview', () => {
    render(
      <KaraokeLyrics
        song={song}
        playheadMs={3_200}
        onSeek={jest.fn()}
        showFollowButton={false}
      />,
    );
    fireEvent.wheel(screen.getByRole('button', { name: 'Lyric line 4' }), {
      deltaY: -120,
    });

    expect(
      screen.queryByRole('button', { name: 'Follow lyrics' }),
    ).not.toBeInTheDocument();
  });

  it('supports keyboard browsing, seeking, and automatic-follow recovery', () => {
    const onSeek = jest.fn();
    render(<KaraokeLyrics song={song} playheadMs={3_200} onSeek={onSeek} />);
    const canvas = screen.getByRole('button', { name: 'Lyric line 4' });
    fireEvent.wheel(canvas, { deltaY: -120 });
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });

    expect(screen.getByRole('button', { name: 'Lyric line 2' })).toBe(canvas);
    fireEvent.keyDown(canvas, { key: 'Enter' });

    expect(onSeek).toHaveBeenCalledWith(1_000);
    expect(
      screen.queryByRole('button', { name: 'Follow lyrics' }),
    ).not.toBeInTheDocument();
  });

  it('resumes lyric following when practice mode requests it', () => {
    const { rerender } = render(
      <KaraokeLyrics
        song={song}
        playheadMs={3_200}
        onSeek={jest.fn()}
        followRequestKey={0}
      />,
    );
    fireEvent.wheel(screen.getByRole('button', { name: 'Lyric line 4' }), {
      deltaY: -120,
    });
    expect(screen.getByRole('button', { name: 'Follow lyrics' })).toBeVisible();

    rerender(
      <KaraokeLyrics
        song={song}
        playheadMs={3_200}
        onSeek={jest.fn()}
        followRequestKey={1}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Follow lyrics' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lyric line 4' })).toBeVisible();
  });

  it('updates the canvas lyric size without remounting the canvas', () => {
    const { rerender } = render(
      <KaraokeLyrics
        song={song}
        playheadMs={1_200}
        onSeek={jest.fn()}
        textSize={100}
      />,
    );
    const lyricCanvas = screen.getByRole('button', { name: 'Lyric line 2' });

    rerender(
      <KaraokeLyrics
        song={song}
        playheadMs={1_200}
        onSeek={jest.fn()}
        textSize={300}
      />,
    );

    expect(screen.getByRole('button', { name: 'Lyric line 2' })).toBe(
      lyricCanvas,
    );
  });
});
