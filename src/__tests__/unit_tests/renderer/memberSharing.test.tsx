/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PLUS_TERMS_VERSION } from '../../../common/plusTerms';
import { subscribeAccountPanelRequests } from '../../../renderer/account/accountPanel';
import SceneLikeButton from '../../../renderer/graph/SceneLikeButton';
import StudioShareDialog from '../../../renderer/studio/StudioShareDialog';
import useStudioSharing from '../../../renderer/studio/useStudioSharing';
import type { IUsableMemberScene } from '../../../renderer/utils/memberScenes';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const SOMEONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const theirs: IUsableMemberScene = {
  kind: 'member',
  lookId: `member:${SOMEONE}:neon-city`,
  authorId: SOMEONE,
  packId: 'neon-city',
  version: 1,
  names: { en: 'Neon City' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  own: false,
  authorName: 'Mei Tanaka',
};

const bridge = {
  memberSceneLikeStatus: jest.fn(),
  likeMemberScene: jest.fn(),
  studioTermsAgreed: jest.fn(),
  exportStudioScene: jest.fn(),
  importMemberScene: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('the heart on a member scene', () => {
  // The control: the count arrives, a press likes it, the server's answer
  // stands.
  it('likes another member’s scene and shows the count at once', async () => {
    bridge.memberSceneLikeStatus.mockResolvedValue({ likes: 12, liked: false });
    let settle: (value: unknown) => void = () => undefined;
    bridge.likeMemberScene.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    render(<SceneLikeButton scene={theirs} />);
    const heart = await screen.findByRole('button', {
      name: 'graph.member.like:Neon City',
    });
    await waitFor(() => expect(heart).toBeEnabled());
    expect(heart).toHaveTextContent('12');
    // Who made it, on hover.
    expect(heart).toHaveAttribute(
      'title',
      'Neon City · graph.member.by:Mei Tanaka',
    );

    await userEvent.click(heart);
    // Shown before the server answers.
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    expect(heart).toHaveTextContent('13');
    expect(bridge.likeMemberScene).toHaveBeenCalledWith(theirs.lookId, true);
    await act(async () => settle({ likes: 20, liked: true }));
    expect(heart).toHaveTextContent('20');
  });

  it('puts the count back when the like could not be sent', async () => {
    bridge.memberSceneLikeStatus.mockResolvedValue({ likes: 12, liked: false });
    bridge.likeMemberScene.mockResolvedValue(undefined);
    render(<SceneLikeButton scene={theirs} />);
    const heart = await screen.findByRole('button', {
      name: 'graph.member.like:Neon City',
    });
    await waitFor(() => expect(heart).toBeEnabled());
    await userEvent.click(heart);
    await waitFor(() => expect(heart).toHaveTextContent('12'));
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(heart).toHaveAttribute('title', 'graph.member.likeOffline');
  });

  it("shows a member's own scene its count and nothing to press", async () => {
    bridge.memberSceneLikeStatus.mockResolvedValue({ likes: 7, liked: false });
    render(<SceneLikeButton scene={{ ...theirs, own: true }} />);
    const count = await screen.findByRole('button', {
      name: 'graph.member.likes:7',
    });
    expect(count).toBeDisabled();
    await userEvent.click(count);
    expect(bridge.likeMemberScene).not.toHaveBeenCalled();
  });

  it('waits, pressed by nobody, while there is no connection', async () => {
    bridge.memberSceneLikeStatus.mockResolvedValue(undefined);
    render(<SceneLikeButton scene={theirs} />);
    const heart = screen.getByRole('button', {
      name: 'graph.member.like:Neon City',
    });
    await waitFor(() =>
      expect(heart).toHaveAttribute('title', 'graph.member.likeOffline'),
    );
    expect(heart).toBeDisabled();
    expect(heart).toHaveTextContent('–');
  });
});

describe('sharing from the Studio', () => {
  it('asks for the terms first, and exports once they are agreed', async () => {
    bridge.studioTermsAgreed.mockResolvedValue(PLUS_TERMS_VERSION - 1);
    bridge.exportStudioScene.mockResolvedValue({
      ok: true,
      fileName: 'neon-city.fluideq-scene.json',
    });
    const { result } = renderHook(() => useStudioSharing());
    await act(async () => result.current.startExport());
    await waitFor(() => expect(result.current.askTerms).toBe(true));
    expect(bridge.exportStudioScene).not.toHaveBeenCalled();

    await act(async () => result.current.agreeAndExport());
    await waitFor(() =>
      expect(result.current.notice).toEqual({
        ok: true,
        key: 'studio.notice.exported',
        vars: { file: 'neon-city.fluideq-scene.json' },
      }),
    );
    expect(bridge.exportStudioScene).toHaveBeenCalledWith(PLUS_TERMS_VERSION);
    expect(result.current.askTerms).toBe(false);
  });

  it('exports straight away once this computer has agreed', async () => {
    bridge.studioTermsAgreed.mockResolvedValue(PLUS_TERMS_VERSION);
    bridge.exportStudioScene.mockResolvedValue({
      ok: false,
      reason: 'offline',
    });
    const { result } = renderHook(() => useStudioSharing());
    await act(async () => result.current.startExport());
    await waitFor(() =>
      expect(result.current.notice).toEqual({
        ok: false,
        key: 'studio.export.offline',
      }),
    );
    expect(result.current.askTerms).toBe(false);
  });

  it('tells an out-of-date app to update instead of asking again', async () => {
    bridge.studioTermsAgreed.mockResolvedValue(PLUS_TERMS_VERSION);
    bridge.exportStudioScene.mockResolvedValue({ ok: false, reason: 'terms' });
    const { result } = renderHook(() => useStudioSharing());
    await act(async () => result.current.startExport());
    await waitFor(() =>
      expect(result.current.notice?.key).toBe('studio.export.outdated'),
    );
    expect(result.current.askTerms).toBe(false);
  });

  it('opens the Plus card when the account has no Plus', async () => {
    const requests = jest.fn();
    const unsubscribe = subscribeAccountPanelRequests(requests);
    bridge.studioTermsAgreed.mockResolvedValue(PLUS_TERMS_VERSION);
    bridge.exportStudioScene.mockResolvedValue({
      ok: false,
      reason: 'not-entitled',
    });
    const { result } = renderHook(() => useStudioSharing());
    await act(async () => result.current.startExport());
    await waitFor(() => expect(requests).toHaveBeenCalledWith('subscribe'));
    unsubscribe();
  });

  it('says whose scene arrived, in the reader’s language', async () => {
    bridge.importMemberScene.mockResolvedValue({
      ok: true,
      names: { en: 'Neon City', es: 'Ciudad de neón' },
      authorName: 'Mei Tanaka',
      own: false,
    });
    const { result } = renderHook(() => useStudioSharing());
    await act(async () => result.current.openFile());
    await waitFor(() =>
      expect(result.current.notice).toEqual({
        ok: true,
        key: 'studio.import.done',
        vars: { name: 'Neon City', author: 'Mei Tanaka' },
      }),
    );
  });

  it('names what went wrong with a file', async () => {
    bridge.importMemberScene.mockResolvedValue({
      ok: false,
      reason: 'changed',
    });
    const { result } = renderHook(() => useStudioSharing());
    await act(async () => result.current.openFile());
    await waitFor(() =>
      expect(result.current.notice).toEqual({
        ok: false,
        key: 'studio.import.changed',
      }),
    );
  });
});

describe('the sharing agreement', () => {
  it('makes agreeing the loud choice, and Escape the way out', async () => {
    const onAgree = jest.fn();
    const onCancel = jest.fn();
    render(
      <StudioShareDialog
        running={false}
        onAgree={onAgree}
        onCancel={onCancel}
      />,
    );
    const agree = screen.getByRole('button', { name: 'studio.share.agree' });
    const cancel = screen.getByRole('button', { name: 'studio.share.cancel' });
    expect(agree).toHaveClass('button', 'small');
    expect(agree).not.toHaveClass('subtle');
    expect(cancel).toHaveClass('subtle');
    await userEvent.click(agree);
    expect(onAgree).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('opens the full terms from the agreement', async () => {
    const requests = jest.fn();
    const unsubscribe = subscribeAccountPanelRequests(requests);
    const onCancel = jest.fn();
    render(
      <StudioShareDialog
        running={false}
        onAgree={jest.fn()}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.share.read' }),
    );
    expect(onCancel).toHaveBeenCalled();
    expect(requests).toHaveBeenCalledWith('terms');
    unsubscribe();
  });
});
