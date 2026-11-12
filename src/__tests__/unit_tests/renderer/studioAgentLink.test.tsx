/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { IStudioAgentDoor } from '../../../common/studioAgent';
import StudioAgentLink from '../../../renderer/studio/StudioAgentLink';
import {
  openStudioAgentDoorForPrompt,
  resetStudioAgentDoorStore,
} from '../../../renderer/studio/studioAgentDoorStore';
import { agentSetup } from '../../../renderer/studio/studioAgentSetup';

/**
 * "Let your AI see the stage": shut until the member opens it — by the
 * switch, or by copying the AI prompt, which carries the connection — and,
 * behind a quiet button, the setup for connecting an assistant by hand: the
 * key whole on the clipboard and never whole on screen, unless the clipboard
 * refuses, when it is shown whole and selected so Ctrl+C can do what the
 * button could not.
 */

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  // No capture running: nothing is heard for the member's AI.
  useLiveAudioControl: () => ({ claim: () => undefined, capture: undefined }),
}));

const URL = 'http://127.0.0.1:47391/mcp';
const KEY_ONE = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd';
const KEY_TWO = 'ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210_-ZyXw';

let door: IStudioAgentDoor;
let clipboard: string | undefined;
let refuse = false;
const setDoor = jest.fn(async (open: boolean) => {
  door = open ? { open: true, url: URL, key: KEY_ONE } : { open: false };
  return door;
});
const newKey = jest.fn(async () => {
  door = { open: true, url: URL, key: KEY_TWO };
  return door;
});

beforeEach(() => {
  resetStudioAgentDoorStore();
  door = { open: false };
  clipboard = undefined;
  refuse = false;
  setDoor.mockClear();
  newKey.mockClear();
  localStorage.clear();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        getStudioAgentDoor: async () => door,
        setStudioAgentDoor: setDoor,
        newStudioAgentKey: newKey,
        openStudioAgentDoorForPrompt: async () => {
          door = { open: true, url: URL, key: KEY_ONE };
          return door;
        },
      },
    },
  });
  Object.assign(navigator, {
    clipboard: {
      writeText: async (text: string) => {
        if (refuse) {
          throw new Error('refused');
        }
        clipboard = text;
      },
    },
  });
});

const theSwitch = () =>
  screen.getByRole('checkbox', { name: 'studio.agent.title' });

const byHand = () =>
  screen.getByRole('button', { name: 'studio.agent.byHand' });

/** Switched on, and the by-hand setup opened. */
const opened = async () => {
  render(<StudioAgentLink />);
  await waitFor(() => expect(theSwitch()).toBeEnabled());
  fireEvent.click(theSwitch());
  await waitFor(() => expect(byHand()).toBeInTheDocument());
  fireEvent.click(byHand());
  expect(
    screen.getByRole('region', { name: 'studio.agent.setupTitle' }),
  ).toBeInTheDocument();
};

test('it is shut, with no setup on screen, until the member opens it', async () => {
  render(<StudioAgentLink />);
  await waitFor(() => expect(theSwitch()).toBeEnabled());
  expect(theSwitch()).not.toBeChecked();
  expect(
    screen.queryByRole('region', { name: 'studio.agent.setupTitle' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'studio.agent.byHand' }),
  ).not.toBeInTheDocument();
  expect(setDoor).not.toHaveBeenCalled();
});

test('open, nothing asks for a command: the setup waits behind "by hand"', async () => {
  // The prompt the member copies connects their AI by itself (Ivan,
  // 2026-09-24); typing a command is for an AI the prompt never reached.
  render(<StudioAgentLink />);
  await waitFor(() => expect(theSwitch()).toBeEnabled());
  fireEvent.click(theSwitch());
  await waitFor(() =>
    expect(byHand()).toHaveAttribute('aria-expanded', 'false'),
  );
  expect(
    screen.queryByRole('region', { name: 'studio.agent.setupTitle' }),
  ).not.toBeInTheDocument();
  // A new key stays in reach, to lock out every AI given the old one.
  expect(
    screen.getByRole('button', { name: 'studio.agent.newKey' }),
  ).toBeInTheDocument();
  fireEvent.click(byHand());
  expect(byHand()).toHaveAttribute('aria-expanded', 'true');
  expect(
    screen.getByRole('region', { name: 'studio.agent.setupTitle' }),
  ).toBeInTheDocument();
});

test('the card follows a door the copied prompt opened', async () => {
  // Two copies of the door, one in the card and one in the copy button,
  // left the card saying off over a door the copy had just opened.
  render(<StudioAgentLink />);
  await waitFor(() => expect(theSwitch()).toBeEnabled());
  expect(theSwitch()).not.toBeChecked();
  await act(async () => {
    await openStudioAgentDoorForPrompt();
  });
  expect(theSwitch()).toBeChecked();
  expect(byHand()).toBeInTheDocument();
});

test('opened, the setup shows the key cut short and copies it whole', async () => {
  await opened();
  expect(setDoor).toHaveBeenCalledWith(true);
  const shown = screen.getByRole('region', {
    name: 'studio.agent.setupTitle',
  }).textContent;
  expect(shown).toContain(URL);
  expect(shown).toContain('AbCd…');
  expect(shown).not.toContain(KEY_ONE);

  fireEvent.click(screen.getByRole('button', { name: 'studio.agent.copy' }));
  await waitFor(() =>
    expect(clipboard).toBe(agentSetup('claude', URL, KEY_ONE)),
  );
  expect(
    await screen.findByRole('button', { name: 'studio.maker.copied' }),
  ).toBeInTheDocument();
});

test('each assistant gets its own setup, and the choice is kept', async () => {
  await opened();
  fireEvent.click(screen.getByRole('button', { name: 'studio.agent.codex' }));
  expect(
    screen.getByRole('region', { name: 'studio.agent.setupTitle' }).textContent,
  ).toContain('[mcp_servers.fluideq]');
  expect(screen.getByText('studio.agent.codexHint')).toBeInTheDocument();
  expect(localStorage.getItem('fluideq.studio.agentAssistant')).toBe('codex');
});

test('a new key replaces the one in the setup', async () => {
  await opened();
  fireEvent.click(screen.getByRole('button', { name: 'studio.agent.newKey' }));
  await waitFor(() =>
    expect(
      screen.getByRole('region', { name: 'studio.agent.setupTitle' })
        .textContent,
    ).toContain('ZyXw…'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'studio.agent.copy' }));
  await waitFor(() =>
    expect(clipboard).toBe(agentSetup('claude', URL, KEY_TWO)),
  );
});

test('a refused clipboard shows the whole setup, to copy by hand', async () => {
  await opened();
  refuse = true;
  fireEvent.click(screen.getByRole('button', { name: 'studio.agent.copy' }));
  await waitFor(() =>
    expect(screen.getByText('studio.agent.copyFailed')).toBeInTheDocument(),
  );
  expect(
    screen.getByRole('region', { name: 'studio.agent.setupTitle' }).textContent,
  ).toContain(KEY_ONE);
});

test('a door that would not open says so', async () => {
  door = { open: false, failed: true };
  render(<StudioAgentLink />);
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('studio.agent.failed'),
  );
});
