/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { featureTourFor } from 'renderer/components/featureTour/slides';

const idsOf = (version: string, release?: string) =>
  featureTourFor(version)
    .filter((slide) => slide.release === release)
    .map((slide) => slide.id);

describe("What's new in 2.1", () => {
  it('opens on what 2.1 brought, every output first', () => {
    expect(idsOf('2.1.0', '2.1')).toEqual([
      'every-output',
      'share-audio',
      'band-labels',
      'song-sound',
    ]);
  });

  it('keeps showing 2.0 as new under its own number, and 1.7 no longer', () => {
    expect(idsOf('2.1.0', '2.0')).toEqual(idsOf('2.0.0', '2.0'));
    expect(idsOf('2.1.0', '1.7')).toEqual([]);
  });

  it('stands 1.7’s slides first among the rest, ahead of the tabs', () => {
    expect(idsOf('2.1.0').slice(0, 5)).toEqual(idsOf('2.0.0', '1.7'));
  });

  it('shows every slide once and loses nothing 2.0 showed', () => {
    const ids = featureTourFor('2.1.0').map((slide) => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    featureTourFor('2.0.0').forEach((slide) => expect(ids).toContain(slide.id));
    // Share Audio is announced again, both ways now, and not repeated
    // among the standing slides.
    expect(idsOf('2.1.0')).not.toContain('share-audio');
    expect(idsOf('2.1.0')).toContain('second-output');
  });

  it('groups 2.1, then 2.0, then the standing slides', () => {
    const releases = featureTourFor('2.1.0').map(
      (slide) => slide.release ?? 'always',
    );
    const groups = releases.filter(
      (release, index) => index === 0 || release !== releases[index - 1],
    );
    expect(groups).toEqual(['2.1', '2.0', 'always']);
  });
});

describe("What's new, slide by slide", () => {
  it('opens 2.0 on what 2.0 brought, in the order Ivan named it', () => {
    expect(idsOf('2.0.0', '2.0')).toEqual([
      'new-look',
      'visualizer-engine',
      'pointer-sparks',
      'presets',
      'engine-sound',
      'room',
      'game-presets',
      'compact-player',
      'graph-views',
      'tone',
      'studio',
      'guide-search',
    ]);
  });

  it('keeps showing 1.7 as new under its own number (Ivan, 2026-09-22)', () => {
    expect(idsOf('2.0.0', '1.7')).toEqual([
      'fluideq-engine',
      'fluideq-plus',
      'visualizers',
      'desktop-visualizer',
      'dynamic-lighting',
    ]);
  });

  it('shows every slide once: the Room moved up, nothing announced is lost', () => {
    const slides = featureTourFor('2.0.0');
    const ids = slides.map((slide) => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Everything 1.7's own tour showed is still in 2.0's, but the Dark
    // theme's slide: the two themes became one slider, which the new look's
    // slide shows.
    featureTourFor('1.7.4').forEach((slide) => expect(ids).toContain(slide.id));
    expect(ids).not.toContain('black-theme');
  });

  it('lists each release together, newest first, and the standing slides last', () => {
    const releases = featureTourFor('2.0.0').map(
      (slide) => slide.release ?? 'always',
    );
    const groups = releases.filter(
      (release, index) => index === 0 || release !== releases[index - 1],
    );
    expect(groups).toEqual(['2.0', '1.7', 'always']);
  });

  it('gives a patch release the tour of the release it patches', () => {
    expect(featureTourFor('2.0.3').map((slide) => slide.id)).toEqual(
      featureTourFor('2.0.0').map((slide) => slide.id),
    );
    // 1.7's own tour is unchanged: the Room is still in it, as new.
    expect(idsOf('1.7.4', '1.7')).toContain('room');
  });
});
