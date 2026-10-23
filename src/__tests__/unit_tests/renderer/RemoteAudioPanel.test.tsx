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
    expect(screen.getAllByText('FLUIDEQ-LAN-2.mine')).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'remoteAudio.code.copy' }),
    ).toHaveLength(1);
  });

  it("links with the other computer's code, trimmed, and not without one", async () => {
    const remote = remoteAudioValue();
    renderPanel(remote);
    const start = screen.getByRole('button', {
      name: 'remoteAudio.link.start',
    });
    expect(start).toBeDisabled();
    const paste = screen.getByRole('textbox', {
      name: 'remoteAudio.link.codeLabel',
    });
    fireEvent.change(paste, { target: { value: '  FLUIDEQ-LAN-2.theirs  ' } });
    await act(async () => {
      fireEvent.click(start);
    });
    expect(remote.link).toHaveBeenCalledWith('FLUIDEQ-LAN-2.theirs');
    // Linked: the field is ready for the next computer's code.
    expect(paste).toHaveValue('');
  });

  it('says why a pasted code did not link, beside the paste', () => {
    renderPanel(remoteAudioValue({ error: 'code' }));
    expect(screen.getByText('remoteAudio.error.code')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
      .getByText('remoteAudio.linked.looking')
      .closest('article');
    if (!away) {
      throw new Error('No card for the computer being looked for.');
    }
    fireEvent.click(
      within(away).getByRole('button', { name: 'remoteAudio.linked.unlink' }),
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
    expect(card().getByText('remoteAudio.linked.bothWays')).toBeInTheDocument();

    fireEvent.click(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.playItHere' }),
    );
    expect(remote.setSwitches).toHaveBeenLastCalledWith('SWEST-YOGA', {
      send: true,
      play: false,
      paused: false,
      volume: 1,
    });
    fireEvent.click(
      card().getByRole('checkbox', { name: 'remoteAudio.lane.sendMySound' }),
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
    // What the figure says, not the widest texts it keeps room for.
    const figureOf = (caption: string) =>
      card()
        .getByText(caption)
        .closest('.remote-audio__lane-figure')
        ?.querySelector('.live-figure__text');
    expect(figureOf('remoteAudio.lane.received')).toHaveTextContent(
      'remoteAudio.lane.megabits',
    );
    expect(figureOf('remoteAudio.lane.sent')).toHaveTextContent(
      'remoteAudio.lane.megabits',
    );
    // Each line has its rate; the head adds none of its own.
    expect(
      card().getByText('remoteAudio.linked.lossless', { exact: false }),
    ).not.toHaveTextContent('remoteAudio.lane.megabits');
  });

  it('runs one way when the other computer switched a direction off', () => {
    renderPanel(
      remoteAudioValue({
        phase: 'ready',
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
        phase: 'ready',
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
        phase: 'ready',
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
        phase: 'ready',
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
      phase: 'ready',
      links: [remoteAudioLink()],
    });
    renderPanel(remote);
    fireEvent.click(
      card().getByRole('button', { name: 'remoteAudio.linked.unlink' }),
    );
    expect(remote.unlink).toHaveBeenCalledWith({ peerId: 'peer-1' });
  });

  it("offers this computer's code for another computer, whichever side pasted", () => {
    renderPanel(
      remoteAudioValue({ links: [remoteAudioLink({ joined: true })] }),
    );
    expect(screen.getByText('remoteAudio.another.section')).toBeInTheDocument();
    expect(screen.getByText('FLUIDEQ-LAN-2.mine')).toBeInTheDocument();
  });
});
