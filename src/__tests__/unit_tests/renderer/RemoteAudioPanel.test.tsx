/* FluidEQ — GPL-3.0-or-later */

/**
 * The Share Audio page: a card per linked computer with its two directions,
 * each on its own switch, a card per pasted computer still being looked for,
 * and the link form under them — this computer's one code and room to paste
 * another's.
 *
 * What each card says is worked out from both ends of the link, so the cases
 * here are the ones where the two ends disagree or cannot do everything: a
 * direction switched off on the other computer, an older FluidEQ that never
 * says what it does, and a computer that cannot play while it sends.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { IRemoteAudioMeter } from '../../../renderer/remoteAudio/meter';
import RemoteAudioPanel from '../../../renderer/remoteAudio/RemoteAudioPanel';
import type { IRemoteAudioValue } from '../../../renderer/remoteAudio/remoteAudioState';
import RemoteAudioContext from '../../../renderer/remoteAudio/remoteAudioValueContext';
import {
  remoteAudioLink,
  remoteAudioValue,
} from '../../utils/remoteAudioValue';

jest.mock('../../../renderer/remoteAudio/RemoteAudioOutput', () => () => null);

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const renderPanel = (remote: IRemoteAudioValue) =>
  render(
    <RemoteAudioContext.Provider value={remote}>
      <RemoteAudioPanel />
    </RemoteAudioContext.Provider>,
  );

const card = () => within(screen.getByRole('article', { name: 'SWEST-YOGA' }));

// Pairing lives in its own dialog, opened from the page's header.
const openAdd = () => {
  fireEvent.click(
    screen.getByRole('button', { name: 'remoteAudio.group.add' }),
  );
  return within(screen.getByRole('dialog', { name: 'remoteAudio.group.add' }));
};

describe('the Share Audio page before a link', () => {
  it("opens on this computer's code, and asks for it only once", () => {
    const idle = remoteAudioValue({ phase: 'idle', code: undefined });
    const { rerender } = renderPanel(idle);
    expect(idle.start).toHaveBeenCalledTimes(1);
    // Already showing its code: the page asks for nothing.
    const ready = remoteAudioValue();
    rerender(
      <RemoteAudioContext.Provider value={ready}>
        <RemoteAudioPanel />
      </RemoteAudioContext.Provider>,
    );
    expect(ready.start).not.toHaveBeenCalled();
  });

  it('shows one code, however many networks this computer is on', () => {
    renderPanel(remoteAudioValue());
    const dialog = openAdd();
    expect(dialog.getAllByText('FLUIDEQ-LAN-2.mine')).toHaveLength(1);
    expect(
      dialog.getAllByRole('button', { name: 'remoteAudio.code.copy' }),
    ).toHaveLength(1);
  });

  it("links with the other computer's code, trimmed, and not without one", async () => {
    const remote = remoteAudioValue();
    renderPanel(remote);
    const dialog = openAdd();
    const start = dialog.getByRole('button', {
      name: 'remoteAudio.link.start',
    });
    expect(start).toBeDisabled();
    fireEvent.change(
      dialog.getByRole('textbox', { name: 'remoteAudio.link.codeLabel' }),
      { target: { value: '  FLUIDEQ-LAN-2.theirs  ' } },
    );
    await act(async () => {
      fireEvent.click(start);
    });
    expect(remote.link).toHaveBeenCalledWith('FLUIDEQ-LAN-2.theirs');
    // Linked: the dialog has done its job and goes.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps Add computer open on a code that did not link, and says why beside the paste', async () => {
    const remote = remoteAudioValue({ error: 'code' });
    jest.mocked(remote.link).mockResolvedValueOnce(false);
    renderPanel(remote);
    const dialog = openAdd();
    expect(dialog.getByText('remoteAudio.error.code')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(
      dialog.getByRole('textbox', { name: 'remoteAudio.link.codeLabel' }),
      { target: { value: 'FLUIDEQ-LAN-2.wrong' } },
    );
    await act(async () => {
      fireEvent.click(
        dialog.getByRole('button', { name: 'remoteAudio.link.start' }),
      );
    });
    expect(
      screen.getByRole('dialog', { name: 'remoteAudio.group.add' }),
    ).toBeInTheDocument();
  });

  it('says why it could not show a code, and tries again on request', () => {
    const remote = remoteAudioValue({
      phase: 'error',
      error: 'lan',
      code: undefined,
    });
    renderPanel(remote);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('remoteAudio.error.lan');
    jest.mocked(remote.start).mockClear();
    fireEvent.click(
      within(alert).getByRole('button', { name: 'remoteAudio.retry' }),
    );
    expect(remote.start).toHaveBeenCalledTimes(1);
  });

  it('looks for a pasted computer that is away, and can give up on it alone', () => {
    const remote = remoteAudioValue({
      links: [remoteAudioLink({ computerId: 'here' })],
      looking: [{ computerId: 'away', deviceName: 'SWEST-DESK' }],
    });
    renderPanel(remote);
    const away = screen
      .getByText('remoteAudio.group.offline', {
        selector: '.remote-audio__lane-song',
      })
      .closest('article');
    if (!away) {
      throw new Error('No card for the computer being looked for.');
    }
    fireEvent.click(
      within(away).getByRole('button', { name: 'remoteAudio.group.options' }),
    );
    expect(
      screen.getByRole('menuitem', { name: 'remoteAudio.linked.unlink' }),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'remoteAudio.linked.unlink' }),
    );
    expect(remote.unlink).toHaveBeenCalledWith({ computerId: 'away' });
  });
});

describe('a linked computer', () => {
  it('runs both ways with both switches on, each switching its own direction', () => {
    const remote = remoteAudioValue({
      phase: 'ready',
      links: [remoteAudioLink({ receiving: true })],
      sending: true,
    });
    renderPanel(remote);
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.group.receive' }),
    ).toBeChecked();
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.to' }),
    ).toBeChecked();

    fireEvent.click(
      card().getByRole('checkbox', { name: 'remoteAudio.group.receive' }),
    );
    expect(remote.setSwitches).toHaveBeenLastCalledWith('SWEST-YOGA', {
      send: true,
      play: false,
      paused: false,
      volume: 1,
    });
    fireEvent.click(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.to' }),
    );
    expect(remote.setSwitches).toHaveBeenLastCalledWith('SWEST-YOGA', {
      send: false,
      play: true,
      paused: false,
      volume: 1,
    });
  });

  it('shows what arrives on the incoming line and what leaves on the outgoing one', () => {
    const stats = (direction: 'receive' | 'send') => ({
      peerId: 'peer-1',
      direction,
      bytesPerSecond: 400_000,
      queuedBytes: 0,
      queuedMilliseconds: 0,
    });
    const remote = remoteAudioValue({
      phase: 'ready',
      links: [remoteAudioLink({ receiving: true })],
      sending: true,
      networkStats: [stats('receive'), stats('send')],
    });
    renderPanel(remote);
    // The simplified group presents one source waveform per PC. The network
    // counters remain transport state and no longer take space on this page.
    expect(card().getByText('remoteAudio.lane.receiving')).toBeInTheDocument();
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.to' }),
    ).toBeChecked();
    expect(
      screen.getByRole('region', { name: 'remoteAudio.group.mix' }),
    ).toBeInTheDocument();
  });

  it('runs one way when the other computer switched a direction off', () => {
    renderPanel(
      remoteAudioValue({
        phase: 'ready',
        links: [remoteAudioLink({ theirs: { sends: true, plays: false } })],
      }),
    );
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.group.receive' }),
    ).toBeChecked();
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.to' }),
    ).toBeChecked();
  });

  it('disables Receive while the peer stops sharing and restores the saved choice when it resumes', () => {
    const link = remoteAudioLink();
    const remote = remoteAudioValue({ links: [link] });
    const view = renderPanel(remote);
    const receive = () =>
      card().getByRole('checkbox', { name: 'remoteAudio.group.receive' });
    const send = () =>
      card().getByRole('checkbox', { name: 'remoteAudio.lane.to' });
    expect(receive()).toBeEnabled();
    expect(receive()).toBeChecked();
    view.rerender(
      <RemoteAudioContext.Provider
        value={{
          ...remote,
          links: [{ ...link, theirs: { sends: false, plays: true } }],
        }}
      >
        <RemoteAudioPanel />
      </RemoteAudioContext.Provider>,
    );
    expect(receive()).toBeDisabled();
    expect(receive()).not.toBeChecked();
    // A peer with its source off can still listen to this computer.
    expect(send()).toBeEnabled();
    expect(send()).toBeChecked();
    fireEvent.click(receive());
    expect(remote.setSwitches).not.toHaveBeenCalled();
    view.rerender(
      <RemoteAudioContext.Provider value={remote}>
        <RemoteAudioPanel />
      </RemoteAudioContext.Provider>,
    );
    expect(receive()).toBeEnabled();
    expect(receive()).toBeChecked();
    expect(remote.setSwitches).not.toHaveBeenCalled();
  });

  it('disables Send when this computer stops sharing while Receive stays available', () => {
    const remote = remoteAudioValue({
      sharing: false,
      links: [remoteAudioLink()],
    });
    renderPanel(remote);
    const send = card().getByRole('checkbox', {
      name: 'remoteAudio.lane.to',
    });
    expect(send).toBeDisabled();
    expect(send).not.toBeChecked();
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.group.receive' }),
    ).toBeEnabled();
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.group.receive' }),
    ).toBeChecked();
    fireEvent.click(send);
    expect(remote.setSwitches).not.toHaveBeenCalled();
  });

  it.each(['here', 'there'])(
    'disables both directions while paused %s',
    (side) => {
      const remote = remoteAudioValue({
        links: [
          remoteAudioLink({
            switches: {
              send: true,
              play: true,
              paused: side === 'here',
              volume: 1,
            },
            theirs: { sends: true, plays: true, paused: side === 'there' },
          }),
        ],
      });
      renderPanel(remote);
      card()
        .getAllByRole('checkbox')
        .forEach((control) => {
          expect(control).toBeDisabled();
          expect(control).not.toBeChecked();
          fireEvent.click(control);
        });
      expect(remote.setSwitches).not.toHaveBeenCalled();
      expect(
        card().getByRole('button', { name: 'remoteAudio.group.options' }),
      ).toBeEnabled();
    },
  );

  it('keeps sending to an older FluidEQ it joined, which sends nothing back', () => {
    renderPanel(
      remoteAudioValue({
        phase: 'ready',
        links: [remoteAudioLink({ joined: true, theirs: undefined })],
        sending: true,
      }),
    );
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.to' }),
    ).toBeChecked();
    expect(card().getByText('remoteAudio.lane.inOld')).toBeInTheDocument();
  });

  it('cannot play while it sends where it cannot do both', () => {
    renderPanel(
      remoteAudioValue({
        bothWays: false,
        phase: 'ready',
        links: [remoteAudioLink({ joined: true })],
      }),
    );
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.group.receive' }),
    ).toBeDisabled();
    expect(card().getByText('remoteAudio.lane.inOneWay')).toBeInTheDocument();
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.to' }),
    ).toBeEnabled();
  });

  it('says so when this computer could not capture its sound', () => {
    renderPanel(
      remoteAudioValue({
        phase: 'ready',
        links: [remoteAudioLink()],
        sendingFailed: true,
      }),
    );
    expect(screen.getByText('remoteAudio.lane.outFailed')).toBeInTheDocument();
  });

  it('says sound is playing here when the wave moves and no player has said what', () => {
    const meters: Array<(meter: IRemoteAudioMeter) => void> = [];
    renderPanel(
      remoteAudioValue({
        phase: 'ready',
        links: [remoteAudioLink()],
        sending: true,
        subscribeMeter: jest.fn((listener) => {
          meters.push(listener);
          return jest.fn();
        }),
      }),
    );
    expect(screen.getByText('remoteAudio.lane.outQuiet')).toBeInTheDocument();
    // This computer's own sound on its way out carries no source.
    act(() =>
      meters.forEach((listener) =>
        listener({ peak: 0.2, rms: 0.1, waveform: new Float32Array(64) }),
      ),
    );
    expect(
      screen.getByText('remoteAudio.lane.outSounding'),
    ).toBeInTheDocument();
    expect(screen.queryByText('remoteAudio.lane.outQuiet')).toBeNull();
  });

  it('asks for a press when the window may not play sound yet', () => {
    const remote = remoteAudioValue({
      phase: 'playback-blocked',
      links: [remoteAudioLink({ receiving: true })],
    });
    renderPanel(remote);
    fireEvent.click(screen.getByRole('button', { name: 'remoteAudio.resume' }));
    expect(remote.resumePlayback).toHaveBeenCalledTimes(1);
  });

  it('ends the link from its card', () => {
    const remote = remoteAudioValue({
      phase: 'ready',
      links: [remoteAudioLink()],
    });
    renderPanel(remote);
    fireEvent.click(
      card().getByRole('button', { name: 'remoteAudio.group.options' }),
    );
    const pause = screen.getByRole('menuitem', {
      name: 'remoteAudio.linked.pause',
    });
    expect(pause).toHaveFocus();
    fireEvent.keyDown(pause, { key: 'ArrowDown' });
    expect(
      screen.getByRole('menuitem', { name: 'remoteAudio.linked.unlink' }),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'remoteAudio.linked.unlink' }),
    );
    expect(remote.unlink).toHaveBeenCalledWith({ peerId: 'peer-1' });
  });

  it("offers this computer's code from Add computer, whichever side pasted", () => {
    renderPanel(
      remoteAudioValue({ links: [remoteAudioLink({ joined: true })] }),
    );
    // Pairing lives in the dialog, so a long group never pushes it out of reach.
    expect(screen.queryByText('FLUIDEQ-LAN-2.mine')).not.toBeInTheDocument();
    expect(openAdd().getByText('FLUIDEQ-LAN-2.mine')).toBeInTheDocument();
  });
});
