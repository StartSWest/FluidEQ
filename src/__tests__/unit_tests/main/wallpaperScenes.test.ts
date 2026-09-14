/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from '../../../common/scenePacks';
import { createWallpaperScenes } from '../../../main/wallpaper/scenes';

const MEMBER = 'member:4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30:neon-city';

const looks = () => {
  const pack = (id: string) => ({ id, source: `// ${id}` }) as IScenePack;
  const stopOfficial = jest.fn();
  const stopMember = jest.fn();
  const official = {
    store: { load: jest.fn((id: string) => pack(id)) },
    subscribeScenes: jest.fn(() => stopOfficial),
    isRefused: jest.fn((id: string) => id === 'aurora'),
    reportFailure: jest.fn(),
  };
  const member = {
    loadVisible: jest.fn((lookId: unknown) => pack(String(lookId))),
    subscribeScenes: jest.fn(() => stopMember),
    isRefused: jest.fn((lookId: string) => lookId === MEMBER),
    reportFailure: jest.fn(),
  };
  return { official, member, stopOfficial, stopMember };
};

describe('the looks a desktop background shows', () => {
  it('asks FluidEQ’s store for a premium look by its pack and the member store for a member’s', () => {
    const { official, member } = looks();
    const scenes = createWallpaperScenes(official, member);
    expect(scenes.loadScene('premium:alpine')).toEqual({
      pack: expect.objectContaining({ id: 'alpine' }),
      member: false,
    });
    expect(scenes.loadScene(MEMBER)).toEqual({
      pack: expect.objectContaining({ id: MEMBER }),
      member: true,
    });
    expect(official.store.load).toHaveBeenCalledWith('alpine');
    expect(member.loadVisible).toHaveBeenCalledWith(MEMBER);
  });

  it('asks and tells the store a look belongs to about its refusal', () => {
    const { official, member } = looks();
    const scenes = createWallpaperScenes(official, member);
    expect(scenes.isSceneRefused('premium:aurora')).toBe(true);
    expect(scenes.isSceneRefused('premium:alpine')).toBe(false);
    expect(scenes.isSceneRefused(MEMBER)).toBe(true);

    scenes.reportSceneFailure('premium:aurora', 'gpu-reset');
    scenes.reportSceneFailure(MEMBER, 'compile');
    expect(official.reportFailure).toHaveBeenCalledWith('aurora', 'gpu-reset');
    expect(member.reportFailure).toHaveBeenCalledWith(MEMBER, 'compile');
    expect(official.reportFailure).toHaveBeenCalledTimes(1);
    expect(member.reportFailure).toHaveBeenCalledTimes(1);
  });

  it('hears both stores change, and stops hearing both', () => {
    const { official, member, stopOfficial, stopMember } = looks();
    const listener = jest.fn();
    const stop = createWallpaperScenes(official, member).subscribeScenes(
      listener,
    );
    expect(official.subscribeScenes).toHaveBeenCalledWith(listener);
    expect(member.subscribeScenes).toHaveBeenCalledWith(listener);
    stop();
    expect(stopOfficial).toHaveBeenCalled();
    expect(stopMember).toHaveBeenCalled();
  });
});
