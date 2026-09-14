/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createScenePackPublications,
  readPublications,
} from '../../../main/scenePackPublications';

describe('which publication of each scene this computer took', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-publications-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const noon = {
    id: 'alpine',
    version: 49,
    publishedAt: '2026-09-13T16:00:00Z',
  };

  it('reads the server rows, dropping anything that is not one', () => {
    expect(
      readPublications([
        { id: 'alpine', version: 49, published_at: noon.publishedAt },
        { id: 'Alpine', version: 1, published_at: 'x' },
        { id: 'aurora', version: 0, published_at: 'x' },
        { id: 'bloom', version: 1.5, published_at: 'x' },
        { id: 'neon-city', version: 4 },
        'alpine',
      ]),
    ).toEqual([noon]);
    expect(readPublications({ message: 'nope' })).toEqual([]);
  });

  it('asks for a scene it holds but has not taken, and only that one', () => {
    const publications = createScenePackPublications({ userDataDir: root });
    const server = [noon, { ...noon, id: 'aurora', version: 4 }];
    expect(publications.changed(server, new Map([['alpine', 49]]))).toEqual([
      'alpine',
    ]);
  });

  it('stops asking once taken, and asks again when it is published again', () => {
    const publications = createScenePackPublications({ userDataDir: root });
    const held = new Map([['alpine', 49]]);
    publications.took([noon]);
    expect(publications.changed([noon], held)).toEqual([]);

    const again = { ...noon, publishedAt: '2026-09-14T01:00:00Z' };
    expect(publications.changed([again], held)).toEqual(['alpine']);
    expect(publications.changed([{ ...noon, version: 50 }], held)).toEqual([
      'alpine',
    ]);
  });

  it('never asks for a version older than the one held', () => {
    const publications = createScenePackPublications({ userDataDir: root });
    expect(publications.changed([noon], new Map([['alpine', 50]]))).toEqual([]);
  });

  it('remembers across a restart, and survives a damaged file', () => {
    createScenePackPublications({ userDataDir: root }).took([noon]);
    expect(
      createScenePackPublications({ userDataDir: root }).changed(
        [noon],
        new Map([['alpine', 49]]),
      ),
    ).toEqual([]);

    fs.writeFileSync(
      path.join(root, 'scene-packs', 'publications.json'),
      '{not json',
    );
    expect(
      createScenePackPublications({ userDataDir: root }).changed(
        [noon],
        new Map([['alpine', 49]]),
      ),
    ).toEqual(['alpine']);
  });
});
