/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import KaraokeMakerHeader from 'renderer/karaoke/KaraokeMakerHeader';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { createKaraokeMakerProject } from 'common/karaoke/makerProject';
import { IKaraokeSong } from 'common/karaoke/types';

const audioFile = new File(['audio'], 'Artist - Song.mp3', {
  type: 'audio/mpeg',
  lastModified: 42,
});

const song = (): IKaraokeSong => ({
  id: 'song-1',
  title: 'Song',
  artist: 'Artist',
  durationMs: 8_000,
  assets: [{ id: 'audio', role: 'audio', extension: 'mp3', file: audioFile }],
  timingPrecision: 'syllable',
  lines: [
    {
      id: 'line-1',
      startMs: 1_000,
      endMs: 2_000,
      tokens: [
        {
          text: 'Hello',
          startsWord: true,
          startMs: 1_000,
          endMs: 2_000,
          targetMidi: 60,
        },
      ],
    },
  ],
  pitch: {
    kind: 'notes',
    source: 'fixture',
    coordinateSystem: 'midi-semitones',
    octavePolicy: 'absolute',
    notes: [{ text: 'Hello', startMs: 1_000, endMs: 2_000, targetMidi: 60 }],
  },
  meta: { sourceFormat: 'ultrastar', gapMs: 100, bpm: 120 },
});

const header = (isModelWorking: boolean) => {
  const onApply = jest.fn();
  const onClose = jest.fn();
  render(
    <I18nProvider>
      <KaraokeMakerHeader
        project={createKaraokeMakerProject(song())}
        commit={jest.fn()}
        undo={jest.fn()}
        redo={jest.fn()}
        canUndo={false}
        canRedo={false}
        onApply={onApply}
        onClose={onClose}
        isModelWorking={isModelWorking}
        isFullScreen={false}
        onToggleFullScreen={jest.fn()}
        tools={null}
        issues={[]}
        setDestructiveAction={jest.fn()}
        setNotice={jest.fn()}
      />
    </I18nProvider>,
  );
  return { onApply, onClose };
};

/** Both exits carry the same explanation while a model runs. */
const BUSY = /A local model is still running/;

/**
 * Leaving the editor while a local model is running.
 *
 * The models outlive the component that starts them, and separation's result
 * is written onto the song the editor was opened for — so an exit taken
 * mid-run finished a split into a song nobody was looking at any more. Both
 * ways out are shut for the duration, and each says why rather than going
 * quiet: a button that ignores a click is the failure this replaced.
 */
describe('the Maker header while a model is working', () => {
  it('offers both exits when nothing is running', () => {
    const { onApply, onClose } = header(false);
    const close = screen.getByRole('button', { name: 'Close maker' });
    expect(close).toBeEnabled();
    expect(screen.queryAllByRole('button', { name: BUSY })).toHaveLength(0);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('shuts the back arrow and Apply, and says why on each', () => {
    const { onApply, onClose } = header(true);
    const exits = screen.getAllByRole('button', { name: BUSY });
    // The back arrow and Apply. Apply closes the editor after handing the
    // project over, so it is an exit as much as the arrow is.
    expect(exits).toHaveLength(2);
    exits.forEach((exit) => {
      expect(exit).toBeDisabled();
      // Read on hover, and the reason the block is not silent.
      expect(exit).toHaveAttribute('data-tooltip', expect.stringMatching(BUSY));
      fireEvent.click(exit);
    });
    expect(screen.queryByRole('button', { name: 'Close maker' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
