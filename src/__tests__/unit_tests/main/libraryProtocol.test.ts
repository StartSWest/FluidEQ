import {
  libraryMediaUrl,
  parseLibraryMediaUrl,
} from '../../../main/library/libraryProtocol';

describe('the media URL the renderer is handed', () => {
  it('round-trips a track and a cover', () => {
    expect(parseLibraryMediaUrl(libraryMediaUrl('track', 'abc123'))).toEqual({
      kind: 'track',
      id: 'abc123',
    });
    expect(parseLibraryMediaUrl(libraryMediaUrl('art', 'def456'))).toEqual({
      kind: 'art',
      id: 'def456',
    });
  });

  it('refuses anything that is not one of those two shapes', () => {
    // Everything this scheme will ever serve is addressed by an id. A URL
    // carrying a path is not a request it can answer.
    expect(
      parseLibraryMediaUrl('fluideq-media://track/../../secret'),
    ).toBeUndefined();
    expect(parseLibraryMediaUrl('fluideq-media://other/abc')).toBeUndefined();
    expect(
      parseLibraryMediaUrl('file:///C:/Windows/notepad.exe'),
    ).toBeUndefined();
    expect(parseLibraryMediaUrl('fluideq-media://track/')).toBeUndefined();
    expect(parseLibraryMediaUrl('')).toBeUndefined();
  });
});
