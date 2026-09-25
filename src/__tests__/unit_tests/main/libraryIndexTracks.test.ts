/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryTrack } from '../../../common/library/types';
import {
  replaceRootTracks,
  upsertTracks,
} from '../../../main/library/libraryIndexTracks';

const track = (
  rootId: string,
  name: string,
  over: Partial<ILibraryTrack> = {},
): ILibraryTrack => ({
  id: `${rootId}-${name}`,
  rootId,
  path: `/${rootId}/${name}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: name,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

const ids = (tracks: readonly ILibraryTrack[]) =>
  tracks.map((entry) => entry.id);

describe('folding a batch of a walk into the index', () => {
  it('replaces a track where it stands and puts a new one on the end, removing nothing', () => {
    const index = [track('a', '1'), track('a', '2'), track('b', '1')];
    const { tracks, merged } = upsertTracks(index, [
      track('a', '2', { title: 'Two, read' }),
      track('a', '3'),
    ]);
    expect(ids(tracks)).toEqual(['a-1', 'a-2', 'b-1', 'a-3']);
    expect(tracks[1].title).toBe('Two, read');
    expect(ids(merged)).toEqual(['a-2', 'a-3']);
    // The array it was given is left as it was.
    expect(ids(index)).toEqual(['a-1', 'a-2', 'b-1']);
  });

  it('keeps a loudness measured while the walk was reading the same bytes', () => {
    const measured = track('a', '1', {
      normalization: { version: 2, truePeakDbtp: -1, integratedLufs: -9 },
    });
    const { tracks } = upsertTracks(
      [measured],
      [track('a', '1', { title: 'Read' })],
    );
    expect(tracks[0]).toMatchObject({
      title: 'Read',
      normalization: measured.normalization,
    });
    // The control: different bytes are measured again, not inherited.
    const { tracks: edited } = upsertTracks(
      [measured],
      [track('a', '1', { sizeBytes: 2 })],
    );
    expect(edited[0].normalization).toBeUndefined();
  });

  it('carries on correctly from an array another edit made', () => {
    const first = upsertTracks([track('a', '1')], [track('a', '2')]).tracks;
    // Something else edits the index between two batches.
    const edited = first.filter((entry) => entry.id !== 'a-1');
    const { tracks } = upsertTracks(edited, [track('a', '1')]);
    expect(ids(tracks)).toEqual(['a-2', 'a-1']);
  });
});

describe('folding a finished walk into the index', () => {
  it('reports no change for a root that came back as the very tracks it had', () => {
    const index = [track('a', '1'), track('b', '1'), track('b', '2')];
    expect(replaceRootTracks(index, 'b', [index[1], index[2]])).toBeUndefined();
    // The control: equal, but not the same objects -- read again -- is news.
    expect(
      replaceRootTracks(index, 'b', [track('b', '1'), track('b', '2')]),
    ).toBeDefined();
  });

  it('keeps a changed root where it stood, drops what the walk no longer found, and adds what it did', () => {
    const index = [
      track('a', '1'),
      track('b', '1'),
      track('b', '2'),
      track('c', '1'),
    ];
    const replaced = replaceRootTracks(index, 'b', [
      track('b', '2', { title: 'Retagged' }),
      track('b', '3'),
    ]);
    expect(ids(replaced ?? [])).toEqual(['a-1', 'b-2', 'b-3', 'c-1']);
  });

  it('puts a root that had nothing yet on the end', () => {
    const replaced = replaceRootTracks([track('a', '1')], 'b', [
      track('b', '1'),
    ]);
    expect(ids(replaced ?? [])).toEqual(['a-1', 'b-1']);
  });
});
