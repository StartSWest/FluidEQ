/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseGameWatchLine } from '../../../main/gameWatch';

describe('what the game watcher says', () => {
  /**
   * The real shape, as `FluidEQ-Games.exe` writes it: tab between the fields,
   * the path last because it holds spaces, and the carriage return Windows
   * adds to every line of a console program's output.
   */
  it('reads a program that came to the front', () => {
    expect(
      parseGameWatchLine(
        'front\t4242\tForza Horizon 6\tD:\\XboxGames\\Forza Horizon 6\\Content\\forzahorizon6.exe\r',
      ),
    ).toEqual({
      kind: 'front',
      program: {
        name: 'Forza Horizon 6',
        path: 'D:\\XboxGames\\Forza Horizon 6\\Content\\forzahorizon6.exe',
        source: 'running',
        // The running program, which is what the app asks to be told the end
        // of so a game keeps its sound until it is really closed.
        pid: 4242,
      },
    });
  });

  it('names a program with no description of its own after its file', () => {
    expect(
      parseGameWatchLine('open\t12\t\tD:\\Games\\mine\\Overwatch.exe')?.program,
    ).toEqual({
      name: 'Overwatch',
      path: 'D:\\Games\\mine\\Overwatch.exe',
      source: 'running',
      pid: 12,
    });
  });

  it('reads where the game was drawn, and lives without it', () => {
    expect(
      parseGameWatchLine(
        'front\t7\t0,0,2560,1440\tOverwatch\tD:\\GAMES\\Overwatch\\ow.exe',
      )?.program,
    ).toEqual({
      name: 'Overwatch',
      path: 'D:\\GAMES\\Overwatch\\ow.exe',
      source: 'running',
      pid: 7,
      rect: '0,0,2560,1440',
    });
    // The field joined the record after the first watcher shipped: a packaged
    // app can be newer than the helper beside it until one is installed, and
    // the old shape still has to be read rather than thrown away.
    expect(
      parseGameWatchLine('front\t7\tOverwatch\tD:\\GAMES\\ow.exe')?.program,
    ).toEqual({
      name: 'Overwatch',
      path: 'D:\\GAMES\\ow.exe',
      source: 'running',
      pid: 7,
    });
  });

  it('knows the end of a list', () => {
    expect(parseGameWatchLine('listed')).toEqual({ kind: 'listed' });
    expect(parseGameWatchLine('listed\r')).toEqual({ kind: 'listed' });
  });

  /**
   * The end of the program the app asked to be told the end of. It carries a
   * pid and nothing else — by the time it is written there is no process left
   * to read a name or a path from — and it is the only thing that puts a
   * game's sound back, so a record misread here is a sound that never returns.
   */
  it('reads the end of the game it was holding', () => {
    expect(parseGameWatchLine('gone\t4242')).toEqual({
      kind: 'gone',
      pid: 4242,
    });
    expect(parseGameWatchLine('gone\t4242\r')).toEqual({
      kind: 'gone',
      pid: 4242,
    });
    expect(parseGameWatchLine('gone\tnot-a-pid')).toBeUndefined();
    expect(parseGameWatchLine('gone')).toBeUndefined();
  });

  it('drops anything that is not a record', () => {
    expect(parseGameWatchLine('')).toBeUndefined();
    expect(parseGameWatchLine('front\t4242\tno path here')).toBeUndefined();
    expect(
      parseGameWatchLine('front\tnot-a-pid\tName\tC:\\a.exe'),
    ).toBeUndefined();
    expect(parseGameWatchLine('something else entirely')).toBeUndefined();
  });
});
