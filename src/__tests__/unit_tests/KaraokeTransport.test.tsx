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
import KaraokeTransport from '../../renderer/karaoke/KaraokeTransport';

describe('KaraokeTransport', () => {
  it('uses app-style icon controls and keeps every transport action wired', () => {
    const onTogglePlayback = jest.fn();
    const onRestart = jest.fn();
    const onSeek = jest.fn();
    const onSeekLyric = jest.fn();
    const onVolume = jest.fn();
    const { container } = render(
      <KaraokeTransport
        status="paused"
        playheadMs={12_000}
        durationMs={60_000}
        volume={0.7}
        onTogglePlayback={onTogglePlayback}
        onRestart={onRestart}
        onSeek={onSeek}
        onSeekLyric={onSeekLyric}
        onVolume={onVolume}
      />,
    );

    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).toHaveClass('button', 'small');
    expect(container.querySelectorAll('.karaoke-button__icon')).toHaveLength(5);
    expect(screen.getByLabelText('Song position')).toHaveStyle(
      '--karaoke-range-progress: 20%',
    );
    expect(screen.getByLabelText('Volume')).toHaveStyle(
      '--karaoke-range-progress: 70%',
    );
    expect(screen.getByText('70%')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Restart song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous lyric' }));
    fireEvent.click(play);
    fireEvent.click(screen.getByRole('button', { name: 'Next lyric' }));
    fireEvent.change(screen.getByLabelText('Song position'), {
      target: { value: '25000' },
    });
    fireEvent.change(screen.getByLabelText('Volume'), {
      target: { value: '0.4' },
    });

    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onSeekLyric).toHaveBeenNthCalledWith(1, -1);
    expect(onSeekLyric).toHaveBeenNthCalledWith(2, 1);
    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(25_000);
    expect(onVolume).toHaveBeenCalledWith(0.4);
  });
});
