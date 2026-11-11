/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import { isVisualsNewsUnseen } from 'common/featureTour';
import {
  featureTourFor,
  newInPart,
  slidesOfPart,
} from 'renderer/components/featureTour/slides';

/**
 * What's New in two that never meet (Ivan, 2026-11-11: "for EQ only, and
 * nothing to do with the visualizer, never. So anything related to
 * visualizers and studio and keyboard lighting should be a completely
 * separate what's new").
 */

/** Every slide about scenes, the Gallery, the Studio, desktops or lighting. */
const VISUALS = [
  'fluideq-plus',
  'visualizers',
  'desktop-visualizer',
  'dynamic-lighting',
  'visualizer-engine',
  'pointer-sparks',
  'studio',
  'studio-chat',
  'karaoke-background',
  'custom-looks',
  'studio-animations',
  'studio-pictures',
  'studio-stage',
  'studio-ai',
  'scene-controls',
  'scene-camera',
  'studio-edit',
  'studio-watch',
  'studio-makers',
  'studio-code',
];

const VERSIONS = [
  '1.6.0',
  '1.7.0',
  '2.0.0',
  '2.1.0',
  '2.2.0',
  '2.3.0',
  '2.4.0',
  '2.5.0',
];

describe("What's New: the sound's and the visualizers'", () => {
  it.each(VERSIONS)(
    'keeps every visualizer, Studio and lighting slide out of the sound’s in %s',
    (version) => {
      const sound = slidesOfPart(featureTourFor(version), 'sound').map(
        (slide) => slide.id,
      );
      expect(sound.filter((id) => VISUALS.includes(id))).toEqual([]);
      // The control: the same slides are there, in the other one.
      const visuals = slidesOfPart(featureTourFor(version), 'visuals').map(
        (slide) => slide.id,
      );
      expect(visuals.length).toBeGreaterThan(0);
      expect(visuals.every((id) => VISUALS.includes(id))).toBe(true);
    },
  );

  it('splits the tour without losing or doubling a slide', () => {
    const all = featureTourFor('2.5.0');
    const parts = [
      ...slidesOfPart(all, 'sound'),
      ...slidesOfPart(all, 'visuals'),
    ].map((slide) => slide.id);
    expect([...parts].sort()).toEqual(all.map((slide) => slide.id).sort());
  });

  it('opens 2.5 on the sound of 2.4, then the standing sound slides', () => {
    const sound = slidesOfPart(featureTourFor('2.5.0'), 'sound');
    expect(sound[0].id).toBe('song-level');
    expect(sound[0].release).toBe('2.4');
    expect(sound.slice(1).every((slide) => slide.release === undefined)).toBe(
      true,
    );
    expect(featureTourFor('2.5.3')).toEqual(featureTourFor('2.5.0'));
  });

  it('opens the Visualizers’ own on 2.5’s, in the order of the release', () => {
    const visuals = slidesOfPart(featureTourFor('2.5.0'), 'visuals');
    expect(
      visuals.filter((slide) => slide.release === '2.5').map((s) => s.id),
    ).toEqual(['studio-edit', 'studio-watch', 'studio-makers', 'studio-code']);
    expect(visuals[0].id).toBe('studio-edit');
  });

  it('keeps 2.4’s visualizers as new in the Visualizers’ own', () => {
    const visuals = slidesOfPart(featureTourFor('2.5.0'), 'visuals');
    expect(
      visuals.filter((slide) => slide.release === '2.4').map((s) => s.id),
    ).toEqual([
      'studio-animations',
      'studio-pictures',
      'studio-stage',
      'studio-ai',
      'scene-controls',
      'scene-camera',
    ]);
  });

  it('marks the Visualizers’ news only for a release that brought some', () => {
    expect(newInPart(featureTourFor('2.4.0'), 'visuals', '2.4.0')).toHaveLength(
      6,
    );
    expect(
      newInPart(featureTourFor('2.5.0'), 'visuals', '2.5.0').map((s) => s.id),
    ).toEqual(['studio-edit', 'studio-watch', 'studio-makers', 'studio-code']);
    // The sound's 2.5 brings no feature slide: nothing new there.
    expect(newInPart(featureTourFor('2.5.0'), 'sound', '2.5.0')).toEqual([]);
    expect(isVisualsNewsUnseen('2.4.0', true, null)).toBe(true);
    expect(isVisualsNewsUnseen('2.4.2', true, '2.4')).toBe(false);
    expect(isVisualsNewsUnseen('2.5.0', true, '2.4')).toBe(true);
    expect(isVisualsNewsUnseen('2.5.0', false, null)).toBe(false);
  });
});

describe('the release notes and the version', () => {
  const root = path.join(__dirname, '../../../..');
  const notes = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const version = (file: string): string =>
    (
      JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as {
        version: string;
      }
    ).version;

  it('opens the notes on the version the app ships as', () => {
    const first = notes.split(/\r?\n/).find((line) => /^## \S/.test(line));
    expect(first).toBe(`## ${version('release/app/package.json')}`);
    expect(version('package.json')).toBe(version('release/app/package.json'));
  });

  it('puts the sound first and the visualizers apart, from 2.4 on', () => {
    const sections = notes.split(/^## /m).slice(1);
    sections
      .filter((section) => /^2\.(4|[5-9])\./.test(section))
      .forEach((section) => {
        const parts = section
          .split(/\r?\n/)
          .filter((line) => /^### /.test(line));
        expect(parts).toEqual(['### Sound', '### Visualizers and Studio']);
      });
  });
});
