/* FluidEQ — GPL-3.0-or-later */

import isGameProgramEligible from '../../../common/gamePrograms';
import { gameProfileFor } from '../../../common/games';
import {
  addGameProfile,
  readGameProfiles,
} from '../../../renderer/games/gameProfiles';

it.each([
  'FluidEQ.exe',
  'FluidEQ-Dev.exe',
  'FluidEQ-Games.exe',
  'explorer.EXE',
  'svchost.exe',
  'ShellExperienceHost.exe',
  'ApplicationFrameHost.exe',
  'powershell.exe',
  'steam.exe',
  'EpicGamesLauncher.exe',
  'EABackgroundService.exe',
  'UnityCrashHandler64.exe',
  'EasyAntiCheat_EOS.exe',
])('does not offer %s as a game', (file) => {
  expect(
    isGameProgramEligible({ name: 'A window', path: `C:\\Programs\\${file}` }),
  ).toBe(false);
});

it.each([
  'D:\\SteamLibrary\\steamapps\\common\\dota 2 beta\\game\\dota2.exe',
  'D:/Games/Overwatch/_retail_/Overwatch.exe',
  'C:\\Program Files\\WindowsApps\\Game\\ForzaHorizon5.exe',
  'C:\\Program Files\\Google\\Chrome\\chrome.exe',
])('keeps legitimate game targets available at %s', (path) => {
  expect(isGameProgramEligible({ name: 'A game', path })).toBe(true);
});

it('ignores non-game targets in older saved lists and blocks direct additions', () => {
  const game = {
    id: 'real',
    name: 'Overwatch',
    path: 'D:\\Games\\Overwatch.exe',
    source: 'file' as const,
    presetId: '',
  };
  const explorer = {
    ...game,
    id: 'shell',
    name: 'Windows Explorer',
    path: 'C:\\Windows\\explorer.exe',
  };
  localStorage.setItem(
    'fluideq.games.profiles.v1',
    JSON.stringify([game, explorer]),
  );
  expect(readGameProfiles()).toEqual([game]);
  expect(addGameProfile(explorer)).toEqual([game]);
  expect(
    gameProfileFor([{ ...game, path: 'C:\\Windows' }], explorer.path),
  ).toBeUndefined();
  expect(gameProfileFor([game], game.path)?.id).toBe('real');
  localStorage.removeItem('fluideq.games.profiles.v1');
});

it('does not mistake Steam shared redistributables for an installed game', () => {
  expect(
    isGameProgramEligible({
      name: 'Steamworks Common Redistributables',
      path: 'D:\\SteamLibrary\\steamapps\\common\\Steamworks Shared',
    }),
  ).toBe(false);
  expect(
    isGameProgramEligible({
      name: 'SteamWorld Dig',
      path: 'D:\\SteamLibrary\\steamapps\\common\\SteamWorld Dig',
    }),
  ).toBe(true);
});
