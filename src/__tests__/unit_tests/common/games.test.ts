/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IGameProfile,
  gamePathHolds,
  gameProfileFor,
  gameSoundEndStep,
  gameSoundStep,
} from '../../../common/games';
import {
  epicGame,
  mergeGamePrograms,
  parseValve,
  steamGame,
  steamLibraries,
} from '../../../common/gameLibraries';

const profile = (path: string, presetId: string, id = path): IGameProfile => ({
  id,
  name: id,
  path,
  presetId,
  source: 'steam',
});

describe('which profile a running program belongs to', () => {
  it('matches a folder by anything run from inside it, and a file exactly', () => {
    expect(
      gamePathHolds(
        'D:\\GAMES\\Overwatch',
        'D:\\GAMES\\Overwatch\\_retail_\\ow.exe',
      ),
    ).toBe(true);
    expect(gamePathHolds('D:\\GAMES\\Overwatch', 'D:\\GAMES\\Overwatch')).toBe(
      true,
    );
    // The next folder along, whose name merely starts the same way.
    expect(
      gamePathHolds('D:\\GAMES\\Over', 'D:\\GAMES\\Overwatch\\ow.exe'),
    ).toBe(false);
    expect(gamePathHolds('', 'D:\\GAMES\\Overwatch\\ow.exe')).toBe(false);
  });

  it('is the same path however Windows spells it', () => {
    expect(
      gamePathHolds('d:/games/overwatch/', 'D:\\GAMES\\Overwatch\\ow.exe'),
    ).toBe(true);
  });

  /** A game named exactly beats the library folder somebody covered. */
  it('takes the longest match, so one game beats the whole library', () => {
    const profiles = [
      profile('D:\\SteamLibrary\\steamapps\\common', 'music', 'library'),
      profile(
        'D:\\SteamLibrary\\steamapps\\common\\dota 2 beta',
        'gaming',
        'dota',
      ),
    ];
    expect(
      gameProfileFor(
        profiles,
        'D:\\SteamLibrary\\steamapps\\common\\dota 2 beta\\game\\dota2.exe',
      )?.id,
    ).toBe('dota');
    expect(
      gameProfileFor(
        profiles,
        'D:\\SteamLibrary\\steamapps\\common\\other\\a.exe',
      )?.id,
    ).toBe('library');
    expect(
      gameProfileFor(profiles, 'C:\\Windows\\explorer.exe'),
    ).toBeUndefined();
  });
});

describe('what the sound does as games come and go', () => {
  it('puts the game’s sound on and remembers what was playing', () => {
    const step = gameSoundStep({}, 'gaming', 'music');
    expect(step).toEqual({
      memory: { before: 'music', applied: 'gaming' },
      select: 'gaming',
    });
  });

  /**
   * The rule this whole file turns on: leaving the game's window is not
   * leaving the game. Somebody alt-tabs to a browser, to Discord, to FluidEQ
   * itself a dozen times a match, and every one of those used to take the
   * game's sound away. Nothing happens now, and nothing is forgotten either —
   * what puts the sound back is the game ending.
   */
  it('changes nothing, and forgets nothing, when anything else comes forward', () => {
    const memory = { before: 'music', applied: 'gaming' };
    expect(gameSoundStep(memory, undefined, 'gaming')).toEqual({ memory });
    expect(gameSoundStep(memory, '', 'gaming')).toEqual({ memory });
  });

  it('puts back what was playing once the game has ended', () => {
    expect(
      gameSoundEndStep({ before: 'music', applied: 'gaming' }, 'gaming'),
    ).toEqual({ memory: {}, select: 'music' });
  });

  /**
   * The rule this exists for: a chain chosen during the game is the
   * listener's, and taking it away when the game closes is the app arguing
   * with them.
   */
  it('keeps a chain the listener chose while playing', () => {
    expect(
      gameSoundEndStep({ before: 'music', applied: 'gaming' }, 'late-night'),
    ).toEqual({ memory: {} });
  });

  it('goes from one game to another and still remembers the first sound', () => {
    const first = gameSoundStep({}, 'gaming', 'music');
    const second = gameSoundStep(first.memory, 'movie', 'gaming');
    expect(second).toEqual({
      memory: { before: 'music', applied: 'movie' },
      select: 'movie',
    });
    expect(gameSoundEndStep(second.memory, 'movie')).toEqual({
      memory: {},
      select: 'music',
    });
  });

  it('changes nothing for a game whose sound is already on, and still steps back', () => {
    const step = gameSoundStep({}, 'gaming', 'gaming');
    expect(step).toEqual({ memory: { before: 'gaming', applied: 'gaming' } });
    expect(gameSoundEndStep(step.memory, 'gaming')).toEqual({
      memory: {},
    });
  });

  it('leaves everything alone for a game with no sound of its own', () => {
    expect(gameSoundStep({}, '', 'music')).toEqual({ memory: {} });
    expect(gameSoundStep({}, undefined, 'music')).toEqual({ memory: {} });
  });

  it('has nothing to put back when no game put anything on', () => {
    expect(gameSoundEndStep({}, 'music')).toEqual({ memory: {} });
    expect(gameSoundEndStep({ applied: 'gaming' }, 'gaming')).toEqual({
      memory: {},
    });
  });
});

describe('reading the launchers’ own lists', () => {
  /** A real manifest, as Steam writes it. */
  const manifest = [
    '"AppState"',
    '{',
    '\t"appid"\t\t"570"',
    '\t"LauncherPath"\t\t"C:\\\\Program Files (x86)\\\\Steam\\\\steam.exe"',
    '\t"name"\t\t"Dota 2"',
    '\t"installdir"\t\t"dota 2 beta"',
    '}',
  ].join('\n');

  it('reads a game out of a Steam manifest, into the folder it installs to', () => {
    expect(steamGame(manifest, 'D:\\SteamLibrary')).toEqual({
      name: 'Dota 2',
      path: 'D:\\SteamLibrary\\steamapps\\common\\dota 2 beta',
      source: 'steam',
    });
    expect(parseValve(manifest).get('appstate/launcherpath')).toBe(
      'C:\\Program Files (x86)\\Steam\\steam.exe',
    );
  });

  it('answers nothing for a manifest that names no folder', () => {
    expect(
      steamGame('"AppState"\n{\n\t"name"\t\t"Half a row"\n}', 'D:\\'),
    ).toBeUndefined();
  });

  it('reads every library Steam lists, on whatever drive', () => {
    const list = [
      '"libraryfolders"',
      '{',
      '\t"0"',
      '\t{',
      '\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"',
      '\t\t"label"\t\t""',
      '\t}',
      '\t"1"',
      '\t{',
      '\t\t"path"\t\t"D:\\\\SteamLibrary\\\\"',
      '\t}',
      '}',
    ].join('\n');
    expect(steamLibraries(list)).toEqual([
      'C:\\Program Files (x86)\\Steam',
      'D:\\SteamLibrary',
    ]);
  });

  it('reads an Epic manifest, and refuses one that installs nowhere', () => {
    expect(
      epicGame(
        JSON.stringify({
          DisplayName: 'Fortnite',
          InstallLocation: 'D:\\Epic\\Fortnite\\',
        }),
      ),
    ).toEqual({ name: 'Fortnite', path: 'D:\\Epic\\Fortnite', source: 'epic' });
    expect(
      epicGame(JSON.stringify({ DisplayName: 'A redistributable' })),
    ).toBeUndefined();
    expect(epicGame('not json at all')).toBeUndefined();
  });

  it('shows a game found twice once, and sorts by name', () => {
    expect(
      mergeGamePrograms([
        {
          name: 'Overwatch',
          path: 'D:\\GAMES\\Overwatch',
          source: 'battlenet',
        },
        { name: 'Overwatch', path: 'd:\\games\\overwatch', source: 'running' },
        { name: 'Dota 2', path: 'D:\\SteamLibrary\\dota', source: 'steam' },
      ]).map((program) => `${program.name} ${program.source}`),
    ).toEqual(['Dota 2 steam', 'Overwatch battlenet']);
  });
});
