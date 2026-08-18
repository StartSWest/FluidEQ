/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import KaraokeMakerStems from 'renderer/karaoke/KaraokeMakerStems';
import { I18nProvider } from 'renderer/utils/I18nContext';

const show = (node: ReactElement) =>
  render(<I18nProvider>{node}</I18nProvider>);

const audio = (name: string) => new File([new Uint8Array(4)], name);

/**
 * The two tracks a split produces.
 *
 * Separation is otherwise invisible work — the detectors quietly begin reading
 * a different file and nothing on screen says so. These assertions are about
 * the result being visible, keepable, and audible.
 */
describe('the Maker separated tracks panel', () => {
  it('shows nothing at all before a song has been split', () => {
    // Not an empty panel with a heading: a section announcing that there are
    // no tracks is worse than no section.
    const { container } = show(
      <KaraokeMakerStems
        vocalLevel={0}
        onVocalLevel={() => {}}
        onSave={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists both tracks once the split has produced them', () => {
    show(
      <KaraokeMakerStems
        instrumental={audio('song (instrumental).wav')}
        vocals={audio('song (vocals).wav')}
        vocalLevel={0.5}
        onVocalLevel={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByText('Backing track')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
  });

  it('hands back the track and the format whose button was pressed', () => {
    // Four buttons now, across two rows, and both halves of each one matter.
    // Getting the track wrong saves the backing track as the voice, and the
    // file is named so the mistake is only obvious after opening it. Getting
    // the format wrong spends several seconds encoding an MP3 for somebody who
    // asked for the lossless file, or hands a DAW a lossy one.
    const onSave = jest.fn();
    const instrumental = audio('song (instrumental).wav');
    const vocals = audio('song (vocals).wav');
    show(
      <KaraokeMakerStems
        instrumental={instrumental}
        vocals={vocals}
        vocalLevel={0.5}
        onVocalLevel={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Backing track as WAV' }),
    );
    expect(onSave).toHaveBeenLastCalledWith(instrumental, 'wav');
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Backing track as MP3' }),
    );
    expect(onSave).toHaveBeenLastCalledWith(instrumental, 'mp3');
    fireEvent.click(screen.getByRole('button', { name: 'Save Voice as WAV' }));
    expect(onSave).toHaveBeenLastCalledWith(vocals, 'wav');
    fireEvent.click(screen.getByRole('button', { name: 'Save Voice as MP3' }));
    expect(onSave).toHaveBeenLastCalledWith(vocals, 'mp3');
  });

  it('reports the guide vocal level as a fraction', () => {
    const onVocalLevel = jest.fn();
    show(
      <KaraokeMakerStems
        instrumental={audio('a.wav')}
        vocals={audio('b.wav')}
        vocalLevel={0.5}
        onVocalLevel={onVocalLevel}
        onSave={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText('Guide vocal'), {
      target: { value: '0.8' },
    });
    expect(onVocalLevel).toHaveBeenCalledWith(0.8);
  });

  it('hides the level when the player has no stem to blend', () => {
    // The Maker previews through the player's audio element, so without a
    // stem loaded there this slider would move nothing. A control that does
    // nothing is the bug it looks like.
    show(
      <KaraokeMakerStems
        instrumental={audio('a.wav')}
        vocals={audio('b.wav')}
        onSave={() => {}}
      />,
    );
    expect(screen.getByText('Backing track')).toBeInTheDocument();
    expect(screen.queryByLabelText('Guide vocal')).not.toBeInTheDocument();
  });

  it('names silence rather than showing a bare zero', () => {
    show(
      <KaraokeMakerStems
        instrumental={audio('a.wav')}
        vocals={audio('b.wav')}
        vocalLevel={0}
        onVocalLevel={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByLabelText('Guide vocal')).toHaveAttribute(
      'aria-valuetext',
      'Backing only',
    );
  });
});
