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

  it('opens 2.5 on the two editions, then 2.4’s sound, then the standing slides', () => {
    const sound = slidesOfPart(featureTourFor('2.5.0'), 'sound');
    expect(sound.slice(0, 2).map((slide) => [slide.id, slide.release])).toEqual(
      [
        ['editions', '2.5'],
        ['song-level', '2.4'],
      ],
    );
    expect(sound.slice(2).every((slide) => slide.release === undefined)).toBe(
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
    // The sound's 2.5 brings the two editions, and nothing about scenes.
    expect(
      newInPart(featureTourFor('2.5.0'), 'sound', '2.5.0').map((s) => s.id),
    ).toEqual(['editions']);
    expect(isVisualsNewsUnseen('2.4.0', true, null)).toBe(true);
    expect(isVisualsNewsUnseen('2.4.2', true, '2.4')).toBe(false);
    expect(isVisualsNewsUnseen('2.5.0', true, '2.4')).toBe(true);
    expect(isVisualsNewsUnseen('2.5.0', false, null)).toBe(false);
  });
});

describe('the two editions’ slide', () => {
  const root = path.join(__dirname, '../../../..');
  const LOCALES = fs
    .readdirSync(path.join(root, 'src/common/i18n'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const editionLines = (locale: string): string[] =>
    fs
      .readFileSync(
        path.join(root, 'src/common/i18n', locale, 'tour24.ts'),
        'utf8',
      )
      .split(/\r?\n/)
      .map((line, index, lines) =>
        /^\s*'tour\.editions\./.test(line)
          ? `${line} ${lines[index + 1] ?? ''}`
          : '',
      )
      .filter(Boolean);

  it.each(LOCALES)('names no price, in %s', (locale) => {
    const lines = editionLines(locale);
    expect(lines).toHaveLength(10);
    // A launch price the server words; a number here would outlive it.
    lines.forEach((line) => {
      expect(line).not.toMatch(/[$€£¥]|\{price\}|\b19\b|\b29\b/);
    });
  });

  it('says nothing of scenes or credits in the sound’s What’s New', () => {
    const english = editionLines('en').join(' ');
    expect(english).toContain('{publisher}');
    expect(english).not.toMatch(/scene|credit|visuali[sz]er|studio/i);
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

  const sections = notes.split(/^## /m).slice(1);
  const partsOf = (section: string): string[] =>
    section.split(/\r?\n/).filter((line) => /^### /.test(line));
  const release = (version: string): string =>
    sections.find((section) => section.split(/\r?\n/)[0] === version) ?? '';

  it('puts the sound first and the visualizers apart, from 2.4 on', () => {
    const later = sections.filter((section) => /^2\.(4|[5-9])\./.test(section));
    expect(later.length).toBeGreaterThan(1);
    later.forEach((section) => {
      // The app as a whole may stand ahead of both (2.5's two editions).
      const parts = partsOf(section).filter(
        (line) => line !== '### Two editions',
      );
      expect(parts).toEqual(['### Sound', '### Visualizers and Studio']);
    });
  });

  it('opens 2.5 on its two editions, ahead of the sound', () => {
    expect(partsOf(release('2.5.0'))).toEqual([
      '### Two editions',
      '### Sound',
      '### Visualizers and Studio',
    ]);
    // The signed edition comes with no credits (Ivan, 2026-11-11); the
    // refund line under Visualizers and Studio still speaks of credits.
    const editions = release('2.5.0').split(/^### /m)[1] ?? '';
    expect(editions).toMatch(/^Two editions/);
    expect(editions).not.toMatch(/credit/i);
    expect(release('2.5.0')).toMatch(/credit back/);
    // The control: 2.4 has no such heading.
    expect(partsOf(release('2.4.0'))).toEqual([
      '### Sound',
      '### Visualizers and Studio',
    ]);
  });
});
