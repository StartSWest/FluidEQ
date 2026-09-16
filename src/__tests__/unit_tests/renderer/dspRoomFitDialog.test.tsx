/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import en from 'common/i18n/en';
import DspRoomFitDialog from 'renderer/dsp/DspRoomFitDialog';
import { readRoomHeadText } from 'renderer/utils/equalizerApi';
import { createFitPlayer, renderFitDemo } from 'renderer/dsp/roomFitAudio';

jest.mock('renderer/utils/equalizerApi', () => ({
  readRoomHeadText: jest.fn(),
}));
jest.mock('renderer/dsp/roomFitAudio', () => ({
  renderFitDemo: jest.fn(),
  createFitPlayer: jest.fn(),
}));

/** A head of two directions and four taps at the three rates. */
const headText = (name: string) => {
  const block = (rate: number) =>
    `rate ${rate} directions 24 taps 4\n${Array.from(
      { length: 24 },
      () => '1 0 0 0 0.5 0 0 0',
    ).join('\n')}\n`;
  return `# FluidEQ room head v1 ${name}\n${block(44100)}${block(48000)}${block(96000)}`;
};

const play = jest.fn();
const stop = jest.fn();
const close = jest.fn();

describe('the fit dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readRoomHeadText as jest.Mock).mockImplementation((head: string) =>
      Promise.resolve(headText(head)),
    );
    (renderFitDemo as jest.Mock).mockImplementation((block: { taps: number }) =>
      Promise.resolve({ demoTaps: block.taps }),
    );
    play.mockResolvedValue(undefined);
    (createFitPlayer as jest.Mock).mockReturnValue({ play, stop, close });
  });

  it('prepares the three heads, plays each side of a pair, and picks the winner after five', async () => {
    const onPick = jest.fn();
    render(<DspRoomFitDialog onPick={onPick} onClose={() => undefined} />);
    expect(screen.getByText(en['dsp.roomFit.loading'])).toBeInTheDocument();
    await waitFor(() => expect(renderFitDemo).toHaveBeenCalledTimes(3));
    expect(readRoomHeadText).toHaveBeenCalledWith('small');
    expect(readRoomHeadText).toHaveBeenCalledWith('large');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: en['dsp.roomFit.playA'] }),
      ).not.toBeDisabled(),
    );
    expect(screen.getByText('Pair 1 of 5')).toBeInTheDocument();

    const playA = screen.getByRole('button', { name: en['dsp.roomFit.playA'] });
    fireEvent.click(playA);
    expect(play).toHaveBeenCalledTimes(1);
    expect(playA).toHaveClass('is-running');
    // The mock ends the sound at once; the button rests again.
    await waitFor(() => expect(playA).not.toHaveClass('is-running'));

    // B every time: medium beats small, large beats medium, large beats
    // small, then the replays confirm large.
    for (let pair = 0; pair < 5; pair += 1) {
      fireEvent.click(
        screen.getByRole('button', { name: en['dsp.roomFit.chooseB'] }),
      );
    }
    expect(
      screen.getByText(
        en['dsp.roomFit.resultTitle'].replace(
          '{head}',
          en['dsp.room.head.large'],
        ),
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.roomFit.use'] }),
    );
    expect(onPick).toHaveBeenCalledWith('large');
  });

  it('says so when the heads cannot be loaded, and still closes', async () => {
    (readRoomHeadText as jest.Mock).mockRejectedValue(new Error('gone'));
    const onClose = jest.fn();
    render(<DspRoomFitDialog onPick={() => undefined} onClose={onClose} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      en['dsp.roomFit.error'],
    );
    expect(
      screen.getByRole('button', { name: en['dsp.roomFit.playA'] }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.roomFit.cancel'] }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('closes its player when it goes', async () => {
    const { unmount } = render(
      <DspRoomFitDialog onPick={() => undefined} onClose={() => undefined} />,
    );
    await waitFor(() => expect(renderFitDemo).toHaveBeenCalledTimes(3));
    unmount();
    expect(close).toHaveBeenCalled();
  });
});
