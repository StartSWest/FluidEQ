/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RemoteAudioMix from '../../../renderer/remoteAudio/RemoteAudioMix';
import {
  remoteAudioLink,
  remoteAudioValue,
} from '../../utils/remoteAudioValue';

const system = {
  level: 0.64,
  isMuted: false,
  isAvailable: true,
  setLevel: jest.fn(),
  toggleMute: jest.fn(),
};

it('disables an unavailable incoming mix without losing its level or mute preference', () => {
  const link = remoteAudioLink({
    switches: {
      send: true,
      play: true,
      paused: false,
      volume: 0.4,
      muted: true,
    },
  });
  const remote = remoteAudioValue({ links: [link] });
  const view = render(<RemoteAudioMix remote={remote} system={system} />);
  const slider = () => screen.getByRole('slider', { name: 'SWEST-YOGA' });
  const mute = () => screen.getByRole('button', { name: /SWEST-YOGA:/ });
  expect(slider()).toBeEnabled();
  expect(mute()).toHaveAttribute('aria-pressed', 'true');
  view.rerender(
    <RemoteAudioMix
      remote={{
        ...remote,
        links: [{ ...link, theirs: { sends: false, plays: true } }],
      }}
      system={system}
    />,
  );
  expect(slider()).toBeDisabled();
  expect(mute()).toBeDisabled();
  expect(screen.getByRole('slider', { name: 'This PC' })).toBeEnabled();
  fireEvent.click(mute());
  fireEvent.change(slider(), { target: { value: '80' } });
  expect(remote.setSwitches).not.toHaveBeenCalled();
  view.rerender(<RemoteAudioMix remote={remote} system={system} />);
  expect(slider()).toBeEnabled();
  expect(mute()).toBeEnabled();
  expect(mute()).toHaveAttribute('aria-pressed', 'true');
  expect(slider()).toHaveValue('0');
  fireEvent.click(mute());
  expect(remote.setSwitches).toHaveBeenLastCalledWith(
    'SWEST-YOGA',
    expect.objectContaining({ volume: 0.4, muted: false }),
  );
});

it('keeps receiving and system volume available when local sharing is off', () => {
  render(
    <RemoteAudioMix
      remote={remoteAudioValue({ sharing: false, links: [remoteAudioLink()] })}
      system={system}
    />,
  );
  screen
    .getAllByRole('slider')
    .forEach((slider) => expect(slider).toBeEnabled());
});

it.each(['receive off', 'paused here', 'paused there'])(
  'disables incoming volume and mute when %s',
  (state) => {
    render(
      <RemoteAudioMix
        remote={remoteAudioValue({
          links: [
            remoteAudioLink({
              switches: {
                send: true,
                play: state !== 'receive off',
                paused: state === 'paused here',
                volume: 0.4,
              },
              theirs: {
                sends: true,
                plays: true,
                paused: state === 'paused there',
              },
            }),
          ],
        })}
        system={system}
      />,
    );
    expect(screen.getByRole('slider', { name: 'SWEST-YOGA' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /SWEST-YOGA:/ })).toBeDisabled();
  },
);

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
