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
    });
  });

  it('knows the end of a list', () => {
    expect(parseGameWatchLine('listed')).toEqual({ kind: 'listed' });
    expect(parseGameWatchLine('listed\r')).toEqual({ kind: 'listed' });
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
