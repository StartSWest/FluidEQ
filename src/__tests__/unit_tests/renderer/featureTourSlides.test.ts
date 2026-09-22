/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { featureTourFor } from 'renderer/components/featureTour/slides';

const idsOf = (version: string, release?: string) =>
  featureTourFor(version)
    .filter((slide) => slide.release === release)
    .map((slide) => slide.id);

describe("What's new, slide by slide", () => {
  it('opens 1.8 on what 1.8 brought, the Compact player first', () => {
    expect(idsOf('1.8.0', '1.8')).toEqual([
      'compact-player',
      'game-presets',
      'presets',
      'room',
      'tone',
      'studio',
      'guide-search',
    ]);
  });

  it('keeps showing 1.7 as new under its own number (Ivan, 2026-09-22)', () => {
    expect(idsOf('1.8.0', '1.7')).toEqual([
      'fluideq-engine',
      'fluideq-plus',
      'visualizers',
      'desktop-visualizer',
      'dynamic-lighting',
      'rainbow-mode',
    ]);
  });

  it('shows every slide once: the Room moved up, nothing announced is lost', () => {
    const slides = featureTourFor('1.8.0');
    const ids = slides.map((slide) => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Everything 1.7's own tour showed is still in 1.8's.
    featureTourFor('1.7.4').forEach((slide) => expect(ids).toContain(slide.id));
  });

  it('lists each release together, newest first, and the standing slides last', () => {
    const releases = featureTourFor('1.8.0').map(
      (slide) => slide.release ?? 'always',
    );
    const groups = releases.filter(
      (release, index) => index === 0 || release !== releases[index - 1],
    );
    expect(groups).toEqual(['1.8', '1.7', 'always']);
  });

  it('gives a patch release the tour of the release it patches', () => {
    expect(featureTourFor('1.8.3').map((slide) => slide.id)).toEqual(
      featureTourFor('1.8.0').map((slide) => slide.id),
    );
    // 1.7's own tour is unchanged: the Room is still in it, as new.
    expect(idsOf('1.7.4', '1.7')).toContain('room');
  });
});
