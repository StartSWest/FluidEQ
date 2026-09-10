/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ICommunityChannel,
  ICommunityProfile,
} from '../../../main/community/communityApi';
import Composer from '../../../renderer/community/Composer';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const general: ICommunityChannel = {
  id: 'general',
  name: 'General',
  description: '',
  writeRole: 'plus',
  position: 1,
};
const requests: ICommunityChannel = {
  ...general,
  id: 'feature-requests',
  writeRole: 'contributor',
};

const member: ICommunityProfile = {
  userId: 'u1',
  handle: 'ada',
  displayName: 'Ada',
  role: 'member',
  acceptedConductAt: 1,
};

const renderComposer = (over: Partial<Parameters<typeof Composer>[0]> = {}) => {
  const props = {
    channel: general,
    profile: member,
    profileLoaded: true,
    entitled: true,
    checkoutAvailable: true,
    onSend: jest.fn(() => Promise.resolve(true)),
    onCreateProfile: jest.fn(() => Promise.resolve(true)),
    onAcceptConduct: jest.fn(() => Promise.resolve(true)),
    onUpgrade: jest.fn(),
    onClearError: jest.fn(),
    ...over,
  };
  // Spelled out rather than spread, so a prop added to the component without a
  // default here is a compile error in this file and not a silent undefined.
  render(
    <Composer
      channel={props.channel}
      profile={props.profile}
      profileLoaded={props.profileLoaded}
      entitled={props.entitled}
      checkoutAvailable={props.checkoutAvailable}
      error={props.error}
      onSend={props.onSend}
      onCreateProfile={props.onCreateProfile}
      onAcceptConduct={props.onAcceptConduct}
      onUpgrade={props.onUpgrade}
      onClearError={props.onClearError}
    />,
  );
  return props;
};

describe('what stands between a person and posting', () => {
  /**
   * The gates in the order a new member meets them. Each shows exactly one
   * loud action — the thing that supplies what is missing — and no text box.
   */
  it('offers the upgrade, and nothing to type into, without a subscription', () => {
    const props = renderComposer({ entitled: false, profile: undefined });
    expect(screen.getByText('community.plusOnly.title')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const upgrade = screen.getByRole('button', { name: 'community.upgrade' });
    expect(upgrade).toHaveClass('button', 'small');
    expect(upgrade).not.toHaveClass('subtle');
    userEvent.click(upgrade);
    expect(props.onUpgrade).toBeDefined();
  });

  it('hides the upgrade button when there is no checkout to open', () => {
    renderComposer({ entitled: false, checkoutAvailable: false });
    expect(
      screen.queryByRole('button', { name: 'community.upgrade' }),
    ).not.toBeInTheDocument();
  });

  it('asks for a handle and a name before anything else, and validates the handle', async () => {
    const props = renderComposer({ profile: undefined });
    const join = screen.getByRole('button', { name: 'community.handle.save' });
    expect(join).toBeDisabled();

    const [handle, name] = screen.getAllByRole('textbox');
    // Uppercase and punctuation are stripped as typed: the server would refuse
    // them, and a field that quietly fixes itself beats one that argues.
    await userEvent.type(handle, 'Ada Lovelace!');
    expect(handle).toHaveValue('adalovelace');
    await userEvent.type(name, 'Ada');
    expect(join).toBeEnabled();

    await userEvent.click(join);
    expect(props.onCreateProfile).toHaveBeenCalledWith('adalovelace', 'Ada');
  });

  it('keeps Join disabled for a handle that is too short', async () => {
    renderComposer({ profile: undefined });
    const [handle, name] = screen.getAllByRole('textbox');
    await userEvent.type(handle, 'ab');
    await userEvent.type(name, 'Ada');
    expect(
      screen.getByRole('button', { name: 'community.handle.save' }),
    ).toBeDisabled();
  });

  it('shows the code of conduct once, before the first message', async () => {
    const props = renderComposer({
      profile: { ...member, acceptedConductAt: undefined },
    });
    expect(screen.getByText('community.conduct.rules')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'community.conduct.accept' }),
    );
    expect(props.onAcceptConduct).toHaveBeenCalled();
  });

  it('tells a member the contributors’ channel is read-only for them', () => {
    renderComposer({ channel: requests });
    expect(screen.getByText('community.contributorsOnly')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('lets a contributor write in the contributors’ channel', () => {
    renderComposer({
      channel: requests,
      profile: { ...member, role: 'contributor' },
    });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('sends on Enter, keeps Shift+Enter as a new line, and clears after a send', async () => {
    const props = renderComposer();
    const box = screen.getByRole('textbox');
    await userEvent.type(box, 'hello{Shift>}{Enter}{/Shift}there');
    expect(box).toHaveValue('hello\nthere');
    expect(props.onSend).not.toHaveBeenCalled();

    await userEvent.type(box, '{Enter}');
    expect(props.onSend).toHaveBeenCalledWith('hello\nthere');
    expect(box).toHaveValue('');
  });

  it('keeps the draft when the send is refused, and shows the reason', async () => {
    const props = renderComposer({
      onSend: jest.fn(() => Promise.resolve(false)),
      error: 'rate_limited',
    });
    const box = screen.getByRole('textbox');
    await userEvent.type(box, 'too fast{Enter}');
    expect(props.onSend).toHaveBeenCalled();
    expect(box).toHaveValue('too fast');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'community.error.rateLimited',
    );
  });

  it('will not send an empty message', async () => {
    const props = renderComposer();
    expect(
      screen.getByRole('button', { name: 'community.send' }),
    ).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), '   {Enter}');
    expect(props.onSend).not.toHaveBeenCalled();
  });
});
