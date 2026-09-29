/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE SOUND'S PATH ON THE STAGE (`PlayerPath.tsx`; Ivan, 2026-09-28, "C
 * ok"): where the sound comes from, FluidEQ, and the output it reaches, with
 * Game mode beside them. Each node does what it names: the source opens its
 * page, FluidEQ the equalizer, and Game mode switches. The output reads the
 * engine's report, so it says a rate and a layout only under the FluidEQ
 * Engine.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
import type { ITransportSource } from 'renderer/audio/transportSource';

const mockState = {
  engine: 'fluid' as 'fluid' | 'apo',
  isEnabled: true,
  gameMode: false,
  gameSupported: true,
  channels: 2,
  latency: { rate: 48_000, frames: 480 } as
    { rate: number; frames: number } | undefined,
};
const mockSetSheet = jest.fn();
const mockSetGameMode = jest.fn();

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      Object.entries(vars ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, value),
        (
          jest.requireActual('common/i18n/en').default as Record<string, string>
        )[key] ?? key,
      ),
  }),
}));
jest.mock('renderer/player/playerLayout', () => ({
  usePlayerSheet: () => ({ setSheet: mockSetSheet }),
}));
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => ({
    engine: mockState.engine,
    fluid: { dllVersion: '1.16.0.0' },
  }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqShell: () => ({
    isEnabled: mockState.isEnabled,
    isBlockingError: false,
  }),
}));
jest.mock('renderer/utils/useListenedOutput', () => ({
  useListenedOutput: (isFluid: boolean) => ({
    output: isFluid
      ? { channels: mockState.channels, gameMode: true }
      : undefined,
  }),
  useListenedDelay: (listened: { output?: object }) =>
    listened.output ? { latency: mockState.latency } : undefined,
}));
jest.mock('renderer/dsp/store', () => ({
  useDspSettings: () => ({ gameMode: mockState.gameMode }),
  setGameMode: (on: boolean) => mockSetGameMode(on),
}));
jest.mock('common/engineHealth', () => ({
  ...jest.requireActual('common/engineHealth'),
  engineSupportsGameMode: () => mockState.gameSupported,
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ isActive: false, readFrame: () => undefined }),
}));
jest.mock('renderer/utils/useSmoothFrames', () => () => () => undefined);
jest.mock('renderer/utils/equalizerApi', () => ({
  readKnownAudioDevices: () =>
    Promise.resolve([
      { name: 'Speakers (USB DAC)', isDefault: true },
      { name: 'Headset', isDefault: false },
    ]),
}));

// eslint-disable-next-line import/first
import PlayerPath from 'renderer/player/PlayerPath';

const onOpenPage = jest.fn();

const show = async (
  source: Pick<ITransportSource, 'owner' | 'origin'> | undefined,
  codec?: string,
) => {
  render(<PlayerPath source={source} codec={codec} onOpenPage={onOpenPage} />);
  // The output's name, asked for on mount, has answered.
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  Object.assign(mockState, {
    engine: 'fluid',
    isEnabled: true,
    gameMode: false,
    gameSupported: true,
    channels: 2,
    latency: { rate: 48_000, frames: 480 },
  });
  mockSetSheet.mockReset();
  mockSetGameMode.mockReset();
  onOpenPage.mockReset();
});

describe('where the sound comes from', () => {
  it('opens the Library from a Library song, its format beside it', async () => {
    await show({ owner: 'library' }, 'flac');
    const node = screen.getByRole('button', { name: /Library\s*FLAC/ });
    expect(node).toHaveAttribute('title', 'Open Library');
    fireEvent.click(node);
    expect(onOpenPage).toHaveBeenCalledWith('library');
  });

  it('is only a name for the machine’s own audio, which has no page', async () => {
    await show({ owner: 'system' });
    const path = screen.getByRole('group', { name: en['player.path.aria'] });
    expect(path).toHaveTextContent(en['library.systemAudio']);
    // Only FluidEQ is a button in the path: the source opens nothing.
    expect(
      screen.getAllByRole('button').filter((button) => path.contains(button)),
    ).toHaveLength(1);
  });

  it('shows no source before anything has played', async () => {
    await show(undefined);
    expect(
      screen.queryByRole('button', { name: /Library/ }),
    ).not.toBeInTheDocument();
    // POSITIVE CONTROL: the rest of the path is there.
    expect(
      screen.getByRole('button', { name: en['player.path.eqOn'] }),
    ).toBeInTheDocument();
  });
});

describe('FluidEQ on the path', () => {
  it('opens the equalizer, and says whether it is shaping the sound', async () => {
    await show({ owner: 'library' });
    fireEvent.click(
      screen.getByRole('button', { name: en['player.path.eqOn'] }),
    );
    expect(mockSetSheet).toHaveBeenCalledWith({ tab: 'eq', isOpen: true });
  });

  it('says it is off while it is', async () => {
    mockState.isEnabled = false;
    await show({ owner: 'library' });
    expect(
      screen.getByRole('button', { name: en['player.path.eqOff'] }),
    ).toHaveClass('is-off');
  });
});

describe('the output it reaches', () => {
  it('names the output, its rate and a stereo layout under the engine', async () => {
    await show({ owner: 'library' });
    const output = screen.getByLabelText(
      'Speakers (USB DAC) · 48 kHz · Stereo',
    );
    expect(output).toHaveTextContent('48k');
    expect(output).toHaveTextContent('Stereo');
  });

  it('calls six channels 5.1', async () => {
    mockState.channels = 6;
    await show({ owner: 'library' });
    expect(
      screen.getByLabelText('Speakers (USB DAC) · 48 kHz · 5.1'),
    ).toHaveTextContent('5.1');
  });

  it('is the output’s name alone under Equalizer APO', async () => {
    mockState.engine = 'apo';
    await show({ owner: 'library' });
    const output = screen.getByLabelText('Speakers (USB DAC)');
    expect(output).not.toHaveTextContent('48k');
  });
});

describe('Game mode beside the path', () => {
  it('switches Game mode and carries the delay it cuts', async () => {
    await show({ owner: 'library' });
    const game = screen.getByRole('button', { name: /Game/ });
    expect(game).toHaveAttribute('aria-pressed', 'false');
    expect(game).toHaveTextContent('10 ms');
    fireEvent.click(game);
    expect(mockSetGameMode).toHaveBeenCalledWith(true);
  });

  it('shows pressed while it is on, and turns it off', async () => {
    mockState.gameMode = true;
    await show({ owner: 'library' });
    const game = screen.getByRole('button', { name: /Game/ });
    expect(game).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(game);
    expect(mockSetGameMode).toHaveBeenCalledWith(false);
  });

  it('cannot be switched while FluidEQ is off', async () => {
    mockState.isEnabled = false;
    await show({ owner: 'library' });
    expect(screen.getByRole('button', { name: /Game/ })).toBeDisabled();
  });

  it('is not offered where the engine cannot do it', async () => {
    mockState.gameSupported = false;
    await show({ owner: 'library' });
    expect(
      screen.queryByRole('button', { name: /Game/ }),
    ).not.toBeInTheDocument();
  });
});
