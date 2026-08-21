/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The library read the way a file manager reads a disk.
 *
 * The flat grouping beside this one answers "every folder that holds a file";
 * these three answer "what is at this level", which is a different question
 * and the one somebody asks when they organised the music themselves.
 */

import {
  folderChildren,
  parentFolderPath,
  rootFolders,
} from '../../../common/library/grouping';
import type { ILibraryTrack } from '../../../common/library/types';

const track = (path: string, extra: Partial<ILibraryTrack> = {}) =>
  ({
    id: path,
    rootId: 'root',
    path,
    title: path.split(/[\\/]/).pop() ?? path,
    addedAt: 1,
    ...extra,
  }) as ILibraryTrack;

const ROOTS = [{ path: 'D:\\Music' }];

const TRACKS = [
  track('D:/Music/loose.mp3'),
  track('D:/Music/Artist/Album/01.mp3', { artId: 'art-1' }),
  track('D:/Music/Artist/Album/02.mp3'),
  track('D:/Music/Artist/Live/01.mp3'),
  track('D:/Music/Other/01.mp3'),
];

describe('the library as a tree', () => {
  it('opens on the folders somebody added, counting everything beneath', () => {
    // The root's own count is the whole library under it, loose file and all
    // — "Music (5)". Counting only what sits directly in it would answer 1,
    // which is true and useless.
    expect(rootFolders(TRACKS, ROOTS)).toEqual([
      expect.objectContaining({
        id: 'D:/Music',
        name: 'Music',
        trackCount: 5,
      }),
    ]);
  });

  it('lists a root that has nothing in it', () => {
    // Usually a drive that is not plugged in. Worth seeing rather than
    // quietly missing from the shelf somebody put it on.
    expect(rootFolders([], [{ path: 'E:/Archive' }])).toEqual([
      expect.objectContaining({ id: 'E:/Archive', trackCount: 0 }),
    ]);
  });

  it('goes one level at a time and no further', () => {
    // `Artist` is one row of 3, not three rows spread over the albums below
    // it; `Album` and `Live` only appear once you are inside `Artist`.
    expect(
      folderChildren(TRACKS, 'D:/Music').map((folder) => [
        folder.name,
        folder.trackCount,
      ]),
    ).toEqual([
      ['Artist', 3],
      ['Other', 1],
    ]);
    expect(
      folderChildren(TRACKS, 'D:/Music/Artist').map((folder) => folder.name),
    ).toEqual(['Album', 'Live']);
  });

  it('carries a cover up from whatever is beneath it', () => {
    // The folder above the music has no art of its own; the record inside it
    // does, and a tile with nothing on it says less than the record does.
    expect(folderChildren(TRACKS, 'D:/Music')[0].artId).toBe('art-1');
  });

  it('walks back up until it reaches the root, and then stops', () => {
    expect(parentFolderPath('D:/Music/Artist/Album', ROOTS)).toBe(
      'D:/Music/Artist',
    );
    expect(parentFolderPath('D:/Music/Artist', ROOTS)).toBe('D:/Music');
    // At the root there is nothing above that this library knows anything
    // about: walking out into `D:/` would offer a folder it cannot fill.
    expect(parentFolderPath('D:/Music', ROOTS)).toBeUndefined();
  });

  it('reads a root written with backslashes as the same folder', () => {
    // A path arrives as Windows text; an index carried from another machine,
    // or a root added by hand, can hold either separator.
    expect(
      parentFolderPath('D:/Music', [{ path: 'D:\\Music\\' }]),
    ).toBeUndefined();
  });
});
