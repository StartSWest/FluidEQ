/** @jest-environment node */
import galleryPublishedFile from '../../../main/plus/galleryPublishedFile';
import { fakeResponse } from '../../utils/memberSceneFixtures';

const author = '10000000-0000-4000-8000-000000000001';
const uuid = '20000000-0000-4000-8000-000000000001';
const immutable = `${author}/lake/preview/${uuid}.webm.${'a'.repeat(64)}.picture.webp`;
it('resolves the exact immutable current path and sends only identifiers', async () => {
  const read = jest.fn(async () => fakeResponse(200, immutable));
  expect(await galleryPublishedFile(author, 'lake', 'picture.webp', read)).toBe(
    immutable,
  );
  expect(read).toHaveBeenCalledWith({
    p_author: author,
    p_scene: 'lake',
    p_file: 'picture.webp',
  });
});
it('uses the legacy path only for an explicitly absent RPC', async () => {
  expect(
    await galleryPublishedFile(author, 'lake', 'scene.json', async () =>
      fakeResponse(404, {}),
    ),
  ).toBe(`${author}/lake/scene.json`);
  expect(
    await galleryPublishedFile(author, 'lake', 'scene.json', async () =>
      fakeResponse(403, {}),
    ),
  ).toBeUndefined();
  expect(
    await galleryPublishedFile(author, 'lake', 'scene.json', async () =>
      fakeResponse(200, null),
    ),
  ).toBeUndefined();
});
it.each([
  immutable.replace(author, uuid),
  immutable.replace('lake', 'other'),
  immutable.replace('picture.webp', 'scene.json'),
  `${author}/lake/../../secret.picture.webp`,
  {},
  [],
])(
  'refuses a different scene, file or malformed current reference: %p',
  async (value) => {
    expect(
      await galleryPublishedFile(author, 'lake', 'picture.webp', async () =>
        fakeResponse(200, value),
      ),
    ).toBeUndefined();
  },
);
