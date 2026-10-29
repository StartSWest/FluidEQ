/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import { GRAPH_STYLES } from 'common/graphStyles';
import { memberLookId } from 'common/memberScenes';
import type { IMemberSceneSummary } from 'main/memberScenes/store';
import {
  resetSceneStore,
  useOwnsAnything,
} from '../../../renderer/plus/sceneStore';
import {
  adoptMemberSceneListingForTesting,
  resetMemberSceneStore,
} from '../../../renderer/utils/memberScenes';

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const ADA = '0b6e3f2a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';

jest.mock('../../../renderer/account/accountStore', () => ({
  getAccountSnapshot: () => ({
    status: 'signed-in',
    identity: { id: '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30' },
  }),
  subscribeAccount: () => () => undefined,
}));
jest.mock('../../../renderer/account/entitlementStore', () => ({
  getEntitlementSnapshot: () => ({ state: 'none' }),
  subscribeEntitlement: () => () => undefined,
}));

const summary = (
  authorId: string,
  packId: string,
  own: boolean,
): IMemberSceneSummary => ({
  lookId: memberLookId(authorId, packId),
  authorId,
  packId,
  version: 1,
  names: { en: 'Scene' },
  fallbackStyle: GRAPH_STYLES[0],
  swatch: ['#112233', '#445566'],
  own,
});

afterEach(() => {
  resetSceneStore();
  resetMemberSceneStore();
});

// Ivan, 2026-10-27: a creator publishes and uses the scene at once, before the
// admin approves it. The switch counted only the store, which lists approved
// scenes alone, so it refused a creator who owned nothing else.
describe('the lighting switch on the window', () => {
  it('is on for a creator whose only scene is their own, unapproved', () => {
    const { result } = renderHook(() => useOwnsAnything());
    expect(result.current).toBe(false);
    act(() =>
      adoptMemberSceneListingForTesting({
        scenes: [summary(ME, 'in-review', true)],
        locked: [],
      }),
    );
    expect(result.current).toBe(true);
  });

  it('stays off for a scene another member made that this account cannot play', () => {
    const { result } = renderHook(() => useOwnsAnything());
    act(() =>
      adoptMemberSceneListingForTesting({
        scenes: [],
        locked: [summary(ADA, 'not-bought', false)],
      }),
    );
    expect(result.current).toBe(false);
  });
});
