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
import { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { IKaraokeWhisperSessionSnapshot } from 'renderer/karaoke/makerAi';
import KaraokeMakerToolbarButton from 'renderer/karaoke/KaraokeMakerToolbarButton';
import KaraokeMakerTimingPopover from 'renderer/karaoke/KaraokeMakerTimingPopover';
import KaraokeMakerEditTools from 'renderer/karaoke/KaraokeMakerEditTools';
import KaraokeMakerAnalysisTools from 'renderer/karaoke/KaraokeMakerAnalysisTools';
import KaraokeMakerSpeechMemoryPanel from 'renderer/karaoke/KaraokeMakerSpeechMemoryPanel';

const show = (node: ReactElement) =>
  render(<I18nProvider>{node}</I18nProvider>);

const session = (
  over: Partial<IKaraokeWhisperSessionSnapshot> = {},
): IKaraokeWhisperSessionSnapshot => ({
  status: 'unloaded',
  downloaded: true,
  inMemory: false,
  busy: false,
  releasePrompt: false,
  settings: { policy: 'ask', idleMinutes: 10 },
  ...over,
});

describe('the Maker toolbar button', () => {
  it('uses one label as its text, its name and its tooltip', () => {
    // Three uses of one string, so a button cannot say one thing to the eye and
    // another to a screen reader.
    show(
      <KaraokeMakerToolbarButton
        icon="lyrics"
        label="Lyrics"
        onClick={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: 'Lyrics' });
    expect(button).toHaveAttribute('data-tooltip', 'Lyrics');
    expect(button).toHaveTextContent('Lyrics');
  });

  it('reports pressed only when it is a toggle that is on', () => {
    // `aria-pressed` on a button that is not a toggle would announce every
    // ordinary action as an unpressed switch.
    const { rerender } = show(
      <KaraokeMakerToolbarButton icon="hand" label="Pan" onClick={() => {}} />,
    );
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');

    rerender(
      <I18nProvider>
        <KaraokeMakerToolbarButton
          icon="hand"
          label="Pan"
          active
          onClick={() => {}}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not fire while disabled', () => {
    const onClick = jest.fn();
    show(
      <KaraokeMakerToolbarButton
        icon="remove"
        label="Delete"
        disabled
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

/**
 * The shift is one number, resolved by the caller.
 *
 * It used to be `scope === 'all' ? project.meta.gapMs : wordShiftMs` written
 * out five times inside this one popover — the readout, the slider's min, max
 * and value, and the baseline its onChange subtracted from. Five chances for
 * two branches to drift apart while describing the same thing.
 */
describe('the Maker timing popover', () => {
  const open = (over: Record<string, unknown> = {}) => {
    const props = {
      scope: 'all' as const,
      onScopeChange: jest.fn(),
      canShiftFromWord: true,
      shiftMs: 250,
      selectedWord: undefined,
      onShift: jest.fn(),
      onClose: jest.fn(),
      ...over,
    };
    show(
      <KaraokeMakerTimingPopover
        scope={props.scope}
        onScopeChange={props.onScopeChange}
        canShiftFromWord={props.canShiftFromWord}
        shiftMs={props.shiftMs}
        selectedWord={props.selectedWord}
        onShift={props.onShift}
        onClose={props.onClose}
      />,
    );
    return props;
  };

  it('shows the shift once, and puts the same number on the slider', () => {
    open();
    expect(screen.getByText('250 ms')).toBeVisible();
    expect(screen.getByRole('slider')).toHaveValue('250');
  });

  it('reports a nudge as a delta, not as a destination', () => {
    // The caller knows what the shift means; this only says which way to move.
    const props = open();
    fireEvent.click(
      screen.getByRole('button', { name: 'Move all lyrics earlier' }),
    );
    expect(props.onShift).toHaveBeenCalledWith(-100);
    fireEvent.click(
      screen.getByRole('button', { name: 'Move all lyrics later' }),
    );
    expect(props.onShift).toHaveBeenCalledWith(100);
  });

  it('turns a slider position into the same kind of delta', () => {
    const props = open();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '600' } });
    expect(props.onShift).toHaveBeenCalledWith(350);
  });

  it('widens the slider to reach a shift already past its usual range', () => {
    // Otherwise a shift set beyond the range would pin the thumb at the end and
    // could never be dragged back.
    open({ shiftMs: 90_000 });
    expect(screen.getByRole('slider')).toHaveAttribute('max', '90000');
  });

  it('refuses the from-word scope when no word is selected', () => {
    open({ canShiftFromWord: false });
    expect(
      screen.getByRole('button', { name: 'From selected word' }),
    ).toBeDisabled();
  });
});

describe('the Maker editing tools', () => {
  const tools = (over: Record<string, unknown> = {}) => {
    const props = {
      isRecordingLines: false,
      onToggleRecordLines: jest.fn(),
      noteEditMode: undefined,
      onToggleNoteEditMode: jest.fn(),
      canCopyNotes: false,
      onCopyNotes: jest.fn(),
      canPasteNotes: false,
      onPasteNotes: jest.fn(),
      canSplitNote: false,
      onSplitNote: jest.fn(),
      canDelete: false,
      onDelete: jest.fn(),
      ...over,
    };
    show(
      <KaraokeMakerEditTools
        isRecordingLines={props.isRecordingLines}
        onToggleRecordLines={props.onToggleRecordLines}
        noteEditMode={props.noteEditMode}
        onToggleNoteEditMode={props.onToggleNoteEditMode}
        canCopyNotes={props.canCopyNotes}
        onCopyNotes={props.onCopyNotes}
        canPasteNotes={props.canPasteNotes}
        onPasteNotes={props.onPasteNotes}
        canSplitNote={props.canSplitNote}
        onSplitNote={props.onSplitNote}
        canDelete={props.canDelete}
        onDelete={props.onDelete}
      />,
    );
    return props;
  };

  it('offers every editing tool as its own button', () => {
    tools();
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('disables what there is nothing to do it to', () => {
    // Nothing selected and nothing copied: copy, paste, split and delete all
    // have no subject.
    tools();
    [
      'Copy selected notes',
      'Paste notes at playhead',
      'Split',
      'Delete',
    ].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    });
  });

  it('marks the active paint mode rather than both note modes', () => {
    tools({ noteEditMode: 'paint' });
    expect(screen.getByRole('button', { name: 'Paint notes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Select notes' }),
    ).not.toHaveAttribute('aria-pressed');
  });
});

describe('the Maker analysis tools', () => {
  const analysis = (over: Record<string, unknown> = {}) => {
    const props = {
      isAnalysing: false,
      onDetectLyrics: jest.fn(),
      onDetectMelody: jest.fn(),
      onRebuild: jest.fn(),
      isUsingSongAudio: true,
      onChooseVocalStem: jest.fn(),
      ...over,
    };
    show(
      <KaraokeMakerAnalysisTools
        isAnalysing={props.isAnalysing}
        onDetectLyrics={props.onDetectLyrics}
        onDetectMelody={props.onDetectMelody}
        onRebuild={props.onRebuild}
        isUsingSongAudio={props.isUsingSongAudio}
        onChooseVocalStem={props.onChooseVocalStem}
      />,
    );
    return props;
  };

  it('blocks every re-run while one is already going', () => {
    // Three detections against one audio file at once would be three answers
    // for the same question.
    analysis({ isAnalysing: true });
    ['Re-detect lyric timing', 'Re-detect melody notes'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    });
  });

  it('leaves the vocal stem reachable while analysis runs', () => {
    // Choosing a cleaner recording is preparation for the next run, not a
    // fourth run competing with this one.
    analysis({ isAnalysing: true });
    expect(screen.getByRole('button', { name: /vocal/i })).toBeEnabled();
  });

  it('says whether a separate stem is already loaded', () => {
    const { unmount } = show(
      <KaraokeMakerAnalysisTools
        isAnalysing={false}
        onDetectLyrics={() => {}}
        onDetectMelody={() => {}}
        onRebuild={() => {}}
        isUsingSongAudio
        onChooseVocalStem={() => {}}
      />,
    );
    const usingSong = screen.getByRole('button', {
      name: /vocal/i,
    }).textContent;
    unmount();

    analysis({ isUsingSongAudio: false });
    expect(screen.getByRole('button', { name: /vocal/i }).textContent).not.toBe(
      usingSong,
    );
  });
});

describe('the Maker speech memory panel', () => {
  it('offers to free the model only when something is loaded', () => {
    const { rerender } = show(
      <KaraokeMakerSpeechMemoryPanel
        session={session({ inMemory: false })}
        statusKey="karaoke.maker.speechMemoryCached"
        onRelease={() => {}}
        onSettingsChange={() => {}}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Free RAM now' }),
    ).not.toBeInTheDocument();

    rerender(
      <I18nProvider>
        <KaraokeMakerSpeechMemoryPanel
          session={session({ inMemory: true })}
          statusKey="karaoke.maker.speechMemoryReady"
          onRelease={() => {}}
          onSettingsChange={() => {}}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Free RAM now' })).toBeVisible();
  });

  it('will not free a model that is busy', () => {
    show(
      <KaraokeMakerSpeechMemoryPanel
        session={session({ inMemory: true, busy: true })}
        statusKey="karaoke.maker.speechMemoryReady"
        onRelease={() => {}}
        onSettingsChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Free RAM now' })).toBeDisabled();
  });

  it('changes one setting without disturbing the other', () => {
    const onSettingsChange = jest.fn();
    show(
      <KaraokeMakerSpeechMemoryPanel
        session={session({ settings: { policy: 'ask', idleMinutes: 30 } })}
        statusKey="karaoke.maker.speechMemoryCached"
        onRelease={() => {}}
        onSettingsChange={onSettingsChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Release automatically' }),
    );
    // The idle delay is carried through rather than reset to a default.
    expect(onSettingsChange).toHaveBeenCalledWith({
      policy: 'auto',
      idleMinutes: 30,
    });
  });

  it('hides the delay when the answer is never to release', () => {
    show(
      <KaraokeMakerSpeechMemoryPanel
        session={session({ settings: { policy: 'keep', idleMinutes: 10 } })}
        statusKey="karaoke.maker.speechMemoryReady"
        onRelease={() => {}}
        onSettingsChange={() => {}}
      />,
    );
    // There is nothing to delay when the model is never let go.
    expect(screen.queryByText('After')).not.toBeInTheDocument();
  });
});
