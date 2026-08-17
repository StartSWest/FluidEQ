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

  /**
   * The guide-vocal fader, which exists only for a song that has been
   * separated into a backing track and an isolated voice.
   */
  describe('the guide vocal fader', () => {
    const transport = (vocalLevel?: number) => {
      const onVocalLevel = jest.fn();
      render(
        <KaraokeTransport
          status="paused"
          playheadMs={0}
          durationMs={60_000}
          volume={0.7}
          onTogglePlayback={() => {}}
          onRestart={() => {}}
          onSeek={() => {}}
          onSeekLyric={() => {}}
          onVolume={() => {}}
          vocalLevel={vocalLevel}
          onVocalLevel={onVocalLevel}
        />,
      );
      return { onVocalLevel };
    };

    it('stays hidden for a song that was never separated', () => {
      // Nothing to blend, so the control would be a slider that does nothing.
      render(
        <KaraokeTransport
          status="paused"
          playheadMs={0}
          durationMs={60_000}
          volume={0.7}
          onTogglePlayback={() => {}}
          onRestart={() => {}}
          onSeek={() => {}}
          onSeekLyric={() => {}}
          onVolume={() => {}}
        />,
      );
      expect(screen.queryByLabelText('Guide vocal')).not.toBeInTheDocument();
    });

    it('appears once a song has an isolated voice to blend', () => {
      transport(0);
      expect(screen.getByLabelText('Guide vocal')).toBeInTheDocument();
    });

    it('reports the level as a fraction, like the volume beside it', () => {
      const { onVocalLevel } = transport(0.25);
      fireEvent.change(screen.getByLabelText('Guide vocal'), {
        target: { value: '0.6' },
      });
      expect(onVocalLevel).toHaveBeenCalledWith(0.6);
    });

    it('names silence rather than showing a bare zero', () => {
      // "0%" invites the reading that something is broken. The bottom of this
      // fader is a working state with a name: the backing track on its own.
      transport(0);
      expect(screen.getByLabelText('Guide vocal')).toHaveAttribute(
        'aria-valuetext',
        'Backing only',
      );
    });

    it('is a control separate from the song volume', () => {
      // Folding the two together would mean turning the guide vocal down also
      // quietened the backing track, which is not what anyone means by it.
      transport(0.5);
      expect(screen.getByLabelText('Guide vocal')).toBeInTheDocument();
      expect(screen.getByLabelText('Volume')).toBeInTheDocument();
    });
  });
});
