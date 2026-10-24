/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RemoteAudioMix from '../../../renderer/remoteAudio/RemoteAudioMix';
import {
  remoteAudioLink,
  remoteAudioValue,
} from '../../utils/remoteAudioValue';

it('puts a speaker mute beside every mix, shows zero while muted and restores each remembered level', () => {
  const setSystemLevel = jest.fn();
  const setSwitches = jest.fn();
  const Harness = () => {
    const [muted, setMuted] = useState(false);
    const [level, setLevel] = useState(0.64);
    const [link, setLink] = useState(
      remoteAudioLink({
        computerId: 'desk',
        switches: { send: true, play: true, paused: false, volume: 0.4 },
      }),
    );
    return (
      <RemoteAudioMix
        remote={remoteAudioValue({
          links: [link],
          setSwitches: async (key, switches) => {
            setSwitches(key, switches);
            setLink((previous) => ({ ...previous, switches }));
          },
        })}
        system={{
          level,
          isMuted: muted,
          isAvailable: true,
          setLevel: (value) => {
            setSystemLevel(value);
            setLevel(value);
          },
          toggleMute: () => setMuted((value) => !value),
        }}
      />
    );
  };
  render(<Harness />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Mute this PC' }));
  expect(screen.getByRole('slider', { name: 'This PC' })).toHaveValue('0');
  expect(screen.getByRole('slider', { name: 'SWEST-YOGA' })).toHaveValue('40');
  expect(setSystemLevel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Unmute this PC' }));
  expect(screen.getByRole('slider', { name: 'This PC' })).toHaveValue('64');
  fireEvent.click(screen.getByRole('button', { name: /SWEST-YOGA:/ }));
  expect(screen.getByRole('slider', { name: 'SWEST-YOGA' })).toHaveValue('0');
  expect(setSwitches).toHaveBeenLastCalledWith(
    'id:desk',
    expect.objectContaining({
      muted: true,
      volume: 0.4,
      send: true,
      play: true,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /SWEST-YOGA:/ }));
  expect(screen.getByRole('slider', { name: 'SWEST-YOGA' })).toHaveValue('40');
  fireEvent.click(screen.getByRole('button', { name: 'Mute this PC' }));
  fireEvent.change(screen.getByRole('slider', { name: 'This PC' }), {
    target: { value: '30' },
  });
  expect(screen.getByRole('button', { name: 'Mute this PC' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(setSystemLevel).toHaveBeenLastCalledWith(0.3);
});
