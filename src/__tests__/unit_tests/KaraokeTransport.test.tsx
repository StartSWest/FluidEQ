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
import { fireEvent, render, screen, within } from '@testing-library/react';
import KaraokeTransport from '../../renderer/karaoke/KaraokeTransport';

describe('KaraokeTransport', () => {
  it('uses app-style icon controls and keeps every transport action wired', () => {
    const onTogglePlayback = jest.fn();
    const onJumpToStart = jest.fn();
    const onJumpToEnd = jest.fn();
    const onSeek = jest.fn();
    const onVolume = jest.fn();
    const { container } = render(
      <KaraokeTransport
        status="paused"
        playheadMs={12_000}
        durationMs={60_000}
        levels={[
          {
            id: 'volume',
            label: 'Volume',
            value: 0.7,
            onChange: onVolume,
          },
        ]}
        onTogglePlayback={onTogglePlayback}
        onJumpToStart={onJumpToStart}
        onJumpToEnd={onJumpToEnd}
        onSeek={onSeek}
      />,
    );

    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).toHaveClass('button', 'small');
    expect(
      container.querySelectorAll(
        '.karaoke-transport__buttons .karaoke-button__icon',
      ),
    ).toHaveLength(5);
    expect(screen.getByLabelText('Song position')).toHaveStyle(
      '--karaoke-range-progress: 20%',
    );
    expect(screen.getByLabelText('Volume')).toHaveStyle(
      '--karaoke-range-progress: 70%',
    );
    expect(screen.getByText('70%')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Jump to song start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back 5 seconds' }));
    fireEvent.click(play);
    fireEvent.click(
      screen.getByRole('button', { name: 'Go forward 5 seconds' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Jump to song end' }));
    fireEvent.change(screen.getByLabelText('Song position'), {
      target: { value: '25000' },
    });
    fireEvent.change(screen.getByLabelText('Volume'), {
      target: { value: '0.4' },
    });

    expect(onJumpToStart).toHaveBeenCalledTimes(1);
    expect(onJumpToEnd).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenNthCalledWith(1, 7_000);
    expect(onSeek).toHaveBeenNthCalledWith(2, 17_000);
    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenNthCalledWith(3, 25_000);
    expect(onVolume).toHaveBeenCalledWith(0.4);
  });

  it('opens all hidden channel faders from the compact icon group', () => {
    const onMelodyToggle = jest.fn();
    const onBackingLevel = jest.fn();
    const { container } = render(
      <KaraokeTransport
        status="paused"
        playheadMs={12_000}
        durationMs={60_000}
        levels={[
          {
            id: 'melody',
            label: 'Melody tone',
            value: 0.5,
            channel: 'melody',
            pressed: true,
            onToggle: onMelodyToggle,
            onChange: () => {},
          },
          {
            id: 'backing',
            label: 'Backing',
            value: 0.7,
            channel: 'backing',
            onChange: onBackingLevel,
          },
          {
            id: 'vocal',
            label: 'Guide vocal',
            value: 0.3,
            channel: 'vocal',
            onChange: () => {},
          },
        ]}
        onTogglePlayback={() => {}}
        onJumpToStart={() => {}}
        onJumpToEnd={() => {}}
        onSeek={() => {}}
      />,
    );

    expect(container.querySelector('.karaoke-transport')).toHaveAttribute(
      'data-level-count',
      '3',
    );
    // One fader on the bar with a chevron beside it, not a row of three
    // icons: this strip is shared with the library's player and has a single
    // column to spend here. Backing is what shows until something else is
    // touched — it is the fader a singer actually moves.
    expect(screen.getByLabelText('Backing')).toBeVisible();
    expect(screen.queryByLabelText('Guide vocal')).not.toBeInTheDocument();

    const backingTrigger = screen.getByRole('button', { name: 'Mix settings' });
    fireEvent.click(backingTrigger);

    expect(backingTrigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Mix settings' });
    expect(within(dialog).getAllByRole('slider')).toHaveLength(3);
    fireEvent.change(within(dialog).getByRole('slider', { name: 'Backing' }), {
      target: { value: '0.42' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Melody tone' }),
    );

    expect(onBackingLevel).toHaveBeenCalledWith(0.42);
    expect(onMelodyToggle).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Mix settings' }),
    ).not.toBeInTheDocument();
    expect(backingTrigger).toHaveFocus();
  });

  /**
   * The guide-vocal fader, which exists only for a song that has been
   * separated into a backing track and an isolated voice.
   */
  describe('the guide vocal fader', () => {
    const transport = (vocalLevel?: number) => {
      const onVocalLevel = jest.fn();
      const levels = [
        {
          id: 'volume',
          label: 'Volume',
          value: 0.7,
          onChange: () => {},
        },
        ...(vocalLevel === undefined
          ? []
          : [
              {
                id: 'vocal',
                label: 'Guide vocal',
                value: vocalLevel,
                valueText:
                  vocalLevel === 0
                    ? 'Backing only'
                    : `${Math.round(vocalLevel * 100)}%`,
                onChange: onVocalLevel,
              },
            ]),
      ];
      render(
        <KaraokeTransport
          status="paused"
          playheadMs={0}
          durationMs={60_000}
          levels={levels}
          onTogglePlayback={() => {}}
          onJumpToStart={() => {}}
          onJumpToEnd={() => {}}
          onSeek={() => {}}
        />,
      );
      return { onVocalLevel };
    };

    /**
     * The bar carries one fader — the last one touched — and the rest are a
     * chevron away. Every assertion about a channel that is not the one on
     * show has to open that menu first, and read the fader inside it: the
     * shown fader and its copy in the menu share a label, and a query that
     * did not say which meant both.
     */
    const openMix = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mix settings' }));
      return screen.getByRole('dialog', { name: 'Mix settings' });
    };

    it('stays hidden for a song that was never separated', () => {
      // Nothing to blend, so the control would be a slider that does nothing.
      render(
        <KaraokeTransport
          status="paused"
          playheadMs={0}
          durationMs={60_000}
          levels={[
            {
              id: 'volume',
              label: 'Volume',
              value: 0.7,
              onChange: () => {},
            },
          ]}
          onTogglePlayback={() => {}}
          onJumpToStart={() => {}}
          onJumpToEnd={() => {}}
          onSeek={() => {}}
        />,
      );
      expect(screen.queryByLabelText('Guide vocal')).not.toBeInTheDocument();
    });

    it('appears once a song has an isolated voice to blend', () => {
      transport(0);
      expect(
        within(openMix()).getByLabelText('Guide vocal'),
      ).toBeInTheDocument();
    });

    it('reports the level as a fraction, like the volume beside it', () => {
      const { onVocalLevel } = transport(0.25);
      fireEvent.change(within(openMix()).getByLabelText('Guide vocal'), {
        target: { value: '0.6' },
      });
      expect(onVocalLevel).toHaveBeenCalledWith(0.6);
    });

    it('names silence rather than showing a bare zero', () => {
      // "0%" invites the reading that something is broken. The bottom of this
      // fader is a working state with a name: the backing track on its own.
      transport(0);
      expect(within(openMix()).getByLabelText('Guide vocal')).toHaveAttribute(
        'aria-valuetext',
        'Backing only',
      );
    });

    it('is a control separate from the song volume', () => {
      // Folding the two together would mean turning the guide vocal down also
      // quietened the backing track, which is not what anyone means by it.
      transport(0.5);
      const dialog = openMix();
      expect(within(dialog).getByLabelText('Guide vocal')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Volume')).toBeInTheDocument();
    });
  });
});
