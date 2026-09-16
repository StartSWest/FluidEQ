/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IAudioDevice } from 'common/constants';
import en from 'common/i18n/en';
import RoomOutputNotice from 'renderer/components/RoomOutputNotice';
import {
  readOutputFormat,
  restoreOutputFormat,
  setOutputSevenOne,
} from 'renderer/utils/equalizerApi';
import type { IRoomLive } from 'renderer/dsp/useRoomLive';

jest.mock('renderer/utils/equalizerApi', () => ({
  readOutputFormat: jest.fn(),
  setOutputSevenOne: jest.fn(),
  restoreOutputFormat: jest.fn(),
}));

let live: IRoomLive = { state: 'front-stage', channels: 2 };
jest.mock('renderer/dsp/useRoomLive', () => ({
  useRoomLive: () => live,
}));

const headset: IAudioDevice = {
  id: '{0.0.0.00000000}.{AAAA}',
  name: 'Headset',
  guid: '{AAAA}',
  isDefault: true,
  isActive: true,
  isFluidEngineAttached: true,
  canHostEffects: true,
};

const format = (takesEightChannels: boolean | null, channels = 2) => ({
  channels,
  sampleRate: 48000,
  bitsPerSample: 24,
  takesEightChannels,
  restorable: false,
});

const title = (key: 'output.roomStereoTitle' | 'output.roomSevenOneTitle') =>
  en[key].replace('{device}', headset.name);

describe('the Room’s one press to 7.1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    live = { state: 'front-stage', channels: 2 };
    (readOutputFormat as jest.Mock).mockResolvedValue(format(true));
    (setOutputSevenOne as jest.Mock).mockResolvedValue({
      ok: true,
      channels: 8,
    });
    (restoreOutputFormat as jest.Mock).mockResolvedValue({
      ok: true,
      channels: 2,
    });
  });

  it('offers 7.1 where the room folds a stereo output whose driver takes it', async () => {
    render(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    expect(
      await screen.findByText(title('output.roomStereoTitle')),
    ).toBeInTheDocument();
    expect(readOutputFormat).toHaveBeenCalledWith(headset.id);
    expect(
      screen.getByRole('button', { name: en['output.setSevenOne'] }),
    ).toHaveClass('small');
  });

  it('offers nothing where the driver takes stereo only, and says so nowhere', async () => {
    (readOutputFormat as jest.Mock).mockResolvedValue(format(false));
    render(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    await waitFor(() => expect(readOutputFormat).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks nothing while the room is off, idle, or already on every channel', () => {
    live = { state: '7.1', channels: 8 };
    const { rerender } = render(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    expect(readOutputFormat).not.toHaveBeenCalled();
    live = { state: 'off', channels: 2 };
    rerender(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    live = { state: 'idle', channels: undefined };
    rerender(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    expect(readOutputFormat).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sets 7.1 on the press, then offers Undo, and puts it back', async () => {
    render(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: en['output.setSevenOne'] }),
    );
    expect(setOutputSevenOne).toHaveBeenCalledWith(headset.id);
    expect(
      await screen.findByText(title('output.roomSevenOneTitle')),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: en['output.undoSevenOne'] }),
    );
    expect(restoreOutputFormat).toHaveBeenCalledWith(headset.id);
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
  });

  it('keeps the offer with the reason when Windows refuses', async () => {
    (setOutputSevenOne as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'the driver takes no 7.1 format',
    });
    render(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: en['output.setSevenOne'] }),
    );
    expect(
      await screen.findByText(en['output.sevenOneFailed']),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: en['output.setSevenOne'] }),
    ).toBeInTheDocument();
  });

  it('goes away for this output on Not now, and steps aside when hidden', async () => {
    const { rerender } = render(
      <RoomOutputNotice engine="fluid" device={headset} isHidden={false} />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: en['output.notNow'] }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const other = {
      ...headset,
      id: '{0.0.0.00000000}.{BBBB}',
      name: 'Speakers',
    };
    rerender(<RoomOutputNotice engine="fluid" device={other} isHidden />);
    await waitFor(() =>
      expect(readOutputFormat).toHaveBeenCalledWith(other.id),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
