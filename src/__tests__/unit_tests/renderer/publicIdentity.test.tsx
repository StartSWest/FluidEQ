/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  checkHandleAvailability,
  createProfile,
  resetProfileStore,
  usePublicIdentity,
} from '../../../renderer/plus/profileStore';

// What the publish dialog asks of the account (Ivan, 2026-11-12: a scene is
// published under a name and an @handle). It asks for a name only once the
// server has said there is none, never before it has answered; once one is
// saved it never asks again. And whether a handle can be had, ahead of the
// save.

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const PROFILE = {
  userId: ME,
  handle: 'lake',
  displayName: 'Lake',
  role: 'member',
};

const bridge = {
  plusProfile: jest.fn(),
  plusCreateProfile: jest.fn(),
  plusHandleAvailability: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  resetProfileStore();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('what a publication needs of the account', () => {
  it('is missing only once the server has said there is no name', async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.plusProfile.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = renderHook(() => usePublicIdentity(ME));
    // Asked, not yet answered: nothing is missing yet.
    expect(bridge.plusProfile).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ loaded: false, missing: false });
    await act(async () => {
      answer({ ok: true, value: null });
    });
    expect(result.current).toEqual({ loaded: true, missing: true });
  });

  it('is not missing for an account that has a name, and asks nothing more once saved', async () => {
    bridge.plusProfile.mockResolvedValue({ ok: true, value: null });
    bridge.plusCreateProfile.mockResolvedValue({ ok: true, value: PROFILE });
    const { result } = renderHook(() => usePublicIdentity(ME));
    await waitFor(() => expect(result.current.missing).toBe(true));
    await act(async () => {
      await createProfile('lake', 'Lake');
    });
    expect(result.current).toEqual({
      loaded: true,
      missing: false,
      profile: PROFILE,
    });
    expect(bridge.plusProfile).toHaveBeenCalledTimes(1);
  });

  it('asks nothing for an account signed out', () => {
    const { result } = renderHook(() => usePublicIdentity(undefined));
    expect(bridge.plusProfile).not.toHaveBeenCalled();
    expect(result.current).toEqual({ loaded: false, missing: false });
  });
});

describe('whether a handle can be had', () => {
  it('answers invalid for a handle off the pattern without asking', async () => {
    await expect(checkHandleAvailability('Ab')).resolves.toBe('invalid');
    expect(bridge.plusHandleAvailability).not.toHaveBeenCalled();
  });

  it("carries the server's answer, and nothing when it could not be asked", async () => {
    bridge.plusHandleAvailability.mockResolvedValueOnce({
      ok: true,
      value: 'taken',
    });
    await expect(checkHandleAvailability('river')).resolves.toBe('taken');
    bridge.plusHandleAvailability.mockResolvedValueOnce({
      ok: false,
      failure: 'network',
    });
    await expect(checkHandleAvailability('river')).resolves.toBeUndefined();
  });
});
