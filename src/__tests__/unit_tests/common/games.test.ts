/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IGameProfile,
  gamePathHolds,
  gameProfileFor,
  gamingProfileOf,
} from '../../../common/games';
import {
  ANY_GAME_PROFILE,
  chainGamingProfileId,
  readyGamingProfileId,
  suggestGamingProfile,
} from '../../../common/gaming';
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

describe('which Gaming profile a game’s own sound starts from', () => {
  it('is the one it was given, before anything else', () => {
    expect(
      gamingProfileOf({
        name: 'Counter-Strike 2',
        presetId: 'gaming',
        profileId: 'yours:abc12345',
      }),
    ).toBe('yours:abc12345');
  });

  /**
   * A row from before the Gaming Lab named a DSP chain, and its game kept
   * playing that chain's rack; its copy starts from it rather than from a
   * guess about the title.
   */
  it('is the chain an older row played', () => {
    expect(
      gamingProfileOf({ name: 'Counter-Strike 2', presetId: 'gaming' }),
    ).toBe(chainGamingProfileId('gaming'));
  });

  it('is the one made for its title, read from the program’s own name', () => {
    expect(gamingProfileOf({ name: 'Counter-Strike 2', presetId: '' })).toBe(
      readyGamingProfileId('cs2'),
    );
    expect(suggestGamingProfile('ELDEN RING™')).toBe(
      readyGamingProfileId('eldenRing'),
    );
    // A series named in the preset is found from the game's own file either
    // way round.
    expect(suggestGamingProfile('Call of Duty®')).toBe(
      readyGamingProfileId('cod'),
    );
  });

  it('is the one for any game when no title matches', () => {
    expect(suggestGamingProfile('Stardew Valley')).toBe(
      readyGamingProfileId(ANY_GAME_PROFILE),
    );
    // A short word is not a title: "Rust" must not be heard in "Trust".
    expect(suggestGamingProfile('Trust Issues')).toBe(
      readyGamingProfileId(ANY_GAME_PROFILE),
    );
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
