/* FluidEQ — GPL-3.0-or-later */

/**
 * The Share Audio page: the link form until a computer is linked, then a
 * card per linked computer with its two directions, each on its own switch.
 *
 * What each card says is worked out from both ends of the link, so the cases
 * here are the ones where the two ends disagree or cannot do everything: a
 * direction switched off on the other computer, an older FluidEQ that never
 * says what it does, and a computer that cannot play while it sends.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import RemoteAudioPanel from '../../../renderer/remoteAudio/RemoteAudioPanel';
import type { IRemoteAudioValue } from '../../../renderer/remoteAudio/remoteAudioState';
import RemoteAudioContext from '../../../renderer/remoteAudio/remoteAudioValueContext';
import {
  remoteAudioLink,
  remoteAudioValue,
} from '../../utils/remoteAudioValue';

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

const card = () =>
  within(screen.getByRole('article', { name: 'remoteAudio.linked.cardLabel' }));

describe('the Share Audio page before a link', () => {
  it("opens on this computer's code, and asks for it only once", () => {
    const idle = remoteAudioValue({ role: undefined, phase: 'idle' });
    const { rerender } = renderPanel(idle);
    expect(idle.showCode).toHaveBeenCalledTimes(1);
    // Already showing its code: the page asks for nothing.
    const waiting = remoteAudioValue();
    rerender(
      <RemoteAudioContext.Provider value={waiting}>
        <RemoteAudioPanel />
      </RemoteAudioContext.Provider>,
    );
    expect(waiting.showCode).not.toHaveBeenCalled();
  });

  it("links with the other computer's code, trimmed, and not without one", () => {
    const remote = remoteAudioValue({
      lanOptions: [
        {
          address: '192.168.1.20',
          code: 'FLUIDEQ-LAN-2.mine',
          deviceName: 'X',
        },
      ],
    });
    renderPanel(remote);
    expect(screen.getByText('FLUIDEQ-LAN-2.mine')).toBeInTheDocument();
    const start = screen.getByRole('button', {
      name: 'remoteAudio.link.start',
    });
    expect(start).toBeDisabled();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'remoteAudio.link.codeLabel' }),
      { target: { value: '  FLUIDEQ-LAN-2.theirs  ' } },
    );
    fireEvent.click(start);
    expect(remote.link).toHaveBeenCalledWith('FLUIDEQ-LAN-2.theirs');
  });

  it('says why it could not show a code, and tries again on request', () => {
    const remote = remoteAudioValue({
      role: undefined,
      phase: 'error',
      error: 'lan',
    });
    renderPanel(remote);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('remoteAudio.error.lan');
    jest.mocked(remote.showCode).mockClear();
    fireEvent.click(
      within(alert).getByRole('button', { name: 'remoteAudio.retry' }),
    );
    expect(remote.showCode).toHaveBeenCalledTimes(1);
  });

  it('looks for the computer whose code was pasted, and can give up on it', () => {
    const remote = remoteAudioValue({
      role: 'sender',
      phase: 'connecting',
      deviceName: 'SWEST-YOGA',
    });
    renderPanel(remote);
    expect(screen.getByRole('status')).toHaveTextContent(
      'remoteAudio.linked.looking',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'remoteAudio.linked.unlink' }),
    );
    expect(remote.unlink).toHaveBeenCalledTimes(1);
  });
});

describe('a linked computer', () => {
  it('runs both ways with both switches on, each switching its own direction', () => {
    const remote = remoteAudioValue({
      phase: 'connected',
      links: [remoteAudioLink({ receiving: true })],
      sending: true,
    });
    renderPanel(remote);
    expect(card().getByText('remoteAudio.linked.bothWays')).toBeInTheDocument();

    fireEvent.click(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.playItHere' }),
    );
    expect(remote.setSwitches).toHaveBeenLastCalledWith('SWEST-YOGA', {
      send: true,
      play: false,
    });
    fireEvent.click(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.sendMySound' }),
    );
    expect(remote.setSwitches).toHaveBeenLastCalledWith('SWEST-YOGA', {
      send: false,
      play: true,
    });
  });

  it('runs one way when the other computer switched a direction off', () => {
    renderPanel(
      remoteAudioValue({
        phase: 'connected',
        links: [remoteAudioLink({ theirs: { sends: true, plays: false } })],
      }),
    );
    expect(
      card().getByText('remoteAudio.linked.incomingOnly'),
    ).toBeInTheDocument();
    expect(
      card().getByText('remoteAudio.lane.outNotPlayed'),
    ).toBeInTheDocument();
  });

  it('keeps sending to an older FluidEQ it joined, which sends nothing back', () => {
    renderPanel(
      remoteAudioValue({
        role: 'sender',
        phase: 'connected',
        links: [remoteAudioLink({ joined: true, theirs: undefined })],
        sending: true,
      }),
    );
    expect(
      card().getByText('remoteAudio.linked.outgoingOnly'),
    ).toBeInTheDocument();
    expect(card().getByText('remoteAudio.lane.inOld')).toBeInTheDocument();
  });

  it('cannot play while it sends where it cannot do both', () => {
    renderPanel(
      remoteAudioValue({
        bothWays: false,
        role: 'sender',
        phase: 'connected',
        links: [remoteAudioLink({ joined: true })],
      }),
    );
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.playItHere' }),
    ).toBeDisabled();
    expect(card().getByText('remoteAudio.lane.inOneWay')).toBeInTheDocument();
    expect(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.sendMySound' }),
    ).toBeEnabled();
  });

  it('says so when this computer could not capture its sound', () => {
    renderPanel(
      remoteAudioValue({
        phase: 'connected',
        links: [remoteAudioLink()],
        sendingFailed: true,
      }),
    );
    expect(card().getByText('remoteAudio.lane.outFailed')).toBeInTheDocument();
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
      phase: 'connected',
      links: [remoteAudioLink()],
    });
    renderPanel(remote);
    fireEvent.click(
      card().getByRole('button', { name: 'remoteAudio.linked.unlink' }),
    );
    expect(remote.unlink).toHaveBeenCalledTimes(1);
  });

  it("offers this computer's code for another computer only where it was used", () => {
    const { unmount } = renderPanel(
      remoteAudioValue({ phase: 'connected', links: [remoteAudioLink()] }),
    );
    expect(screen.getByText('remoteAudio.another.hub')).toBeInTheDocument();
    unmount();
    renderPanel(
      remoteAudioValue({
        role: 'sender',
        phase: 'connected',
        links: [remoteAudioLink({ joined: true })],
      }),
    );
    expect(screen.getByText('remoteAudio.another.spoke')).toBeInTheDocument();
  });
});
