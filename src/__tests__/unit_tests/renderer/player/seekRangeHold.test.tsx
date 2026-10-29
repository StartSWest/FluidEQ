/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Let go, the song's thumb stays where it was put until the source says it
 * is there (Ivan, 2026-10-25: "fix the seek bar glitching on jump with
 * mouse"): it used to fall back to the place reported before the press and
 * then jump to the new one — forward, back, forward.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SeekRange from 'renderer/player/SeekRange';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SONG_MS = 240_000;

/** The line, as the transport draws it with the source at `positionMs`. */
const line = (
  positionMs: number,
  {
    durationMs = SONG_MS,
    onSeek = jest.fn(),
    canSeek = true,
  }: {
    durationMs?: number;
    onSeek?: (positionMs: number) => void;
    canSeek?: boolean;
  } = {},
) => (
  <SeekRange
    positionMs={positionMs}
    durationMs={durationMs}
    onSeek={canSeek ? onSeek : undefined}
  />
);

const thumb = () => screen.getByRole('slider', { name: 'player.seek' });

/** A press on the line at `toMs`, and the release. */
const seekTo = (toMs: number) => {
  fireEvent.change(thumb(), { target: { value: String(toMs) } });
  fireEvent.pointerUp(thumb());
};

describe('the song’s line after a seek', () => {
  it('sends the source there once, on the release', () => {
    const onSeek = jest.fn();
    render(line(30_000, { onSeek }));
    fireEvent.change(thumb(), { target: { value: '90000' } });
    fireEvent.change(thumb(), { target: { value: '120000' } });
    expect(onSeek).not.toHaveBeenCalled();
    fireEvent.pointerUp(thumb());
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(120_000);
  });

  it('keeps the thumb where it was put while the source still reports the old place, and follows once it is there', () => {
    const { rerender } = render(line(30_000));
    seekTo(120_000);
    // The source has not answered: the next report is the old place, a
    // second on.
    rerender(line(31_000));
    expect(thumb()).toHaveValue('120000');
    // There.
    rerender(line(120_400));
    expect(thumb()).toHaveValue('120400');
    rerender(line(121_400));
    expect(thumb()).toHaveValue('121400');
  });

  it('follows the source where it landed the seek somewhere else', () => {
    const { rerender } = render(line(30_000));
    seekTo(120_000);
    rerender(line(60_000));
    expect(thumb()).toHaveValue('60000');
  });

  it('goes back to the source when the seek was refused, after a few reports of the old place', () => {
    const { rerender } = render(line(30_000));
    seekTo(120_000);
    rerender(line(31_000));
    rerender(line(32_000));
    expect(thumb()).toHaveValue('120000');
    rerender(line(33_000));
    expect(thumb()).toHaveValue('33000');
  });

  // Even one that reports a place close to where the last song was — a song
  // resumed part way — which no jump in the position would give away.
  it('holds nothing from the last song over the next one', () => {
    const { rerender } = render(line(30_000));
    seekTo(120_000);
    rerender(line(31_000, { durationMs: 180_000 }));
    expect(thumb()).toHaveValue('31000');
  });

  it('holds nothing where the source cannot seek', () => {
    const { rerender } = render(line(30_000, { canSeek: false }));
    expect(thumb()).toBeDisabled();
    seekTo(120_000);
    rerender(line(31_000, { canSeek: false }));
    expect(thumb()).toHaveValue('31000');
  });
});
