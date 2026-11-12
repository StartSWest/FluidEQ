/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { createHash } from 'crypto';
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

  it('opens 2.5 on its signing, then 2.4’s sound, then the standing slides', () => {
    const sound = slidesOfPart(featureTourFor('2.5.0'), 'sound');
    expect(sound.slice(0, 2).map((slide) => [slide.id, slide.release])).toEqual(
      [
        ['signed', '2.5'],
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
    // The sound's 2.5 brings the signing, and nothing about scenes.
    expect(
      newInPart(featureTourFor('2.5.0'), 'sound', '2.5.0').map((s) => s.id),
    ).toEqual(['signed']);
    expect(isVisualsNewsUnseen('2.4.0', true, null)).toBe(true);
    expect(isVisualsNewsUnseen('2.4.2', true, '2.4')).toBe(false);
    expect(isVisualsNewsUnseen('2.5.0', true, '2.4')).toBe(true);
    expect(isVisualsNewsUnseen('2.5.0', false, null)).toBe(false);
  });
});

const root = path.join(__dirname, '../../../..');
const LOCALES = fs
  .readdirSync(path.join(root, 'src/common/i18n'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const notes = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const sections = notes.split(/^## /m).slice(1);
const release = (version: string): string =>
  sections.find((section) => section.split(/\r?\n/)[0] === version) ?? '';

/** Each `prefix` key of a locale's 2.4/2.5 tour file, with the line after it. */
const tourLines = (locale: string, prefix: RegExp): string[] =>
  fs
    .readFileSync(
      path.join(root, 'src/common/i18n', locale, 'tour24.ts'),
      'utf8',
    )
    .split(/\r?\n/)
    .map((line, index, lines) =>
      prefix.test(line) ? `${line} ${lines[index + 1] ?? ''}` : '',
    )
    .filter(Boolean);

describe('2.5’s opening page', () => {
  it('folds the walkthrough into it, so the film is not shown twice', () => {
    const ids = featureTourFor('2.5.0').map((slide) => slide.id);
    expect(ids).not.toContain('walkthrough');
    // The control: 2.4's tour still lists the walkthrough on its own.
    expect(featureTourFor('2.4.0').map((slide) => slide.id)).toContain(
      'walkthrough',
    );
  });

  it.each(LOCALES)('names its publisher and no price, in %s', (locale) => {
    const lines = tourLines(locale, /^\s*'tour\.signed\./);
    // Fifteen sentences and labels, and four plural forms of four units.
    expect(lines).toHaveLength(31);
    // FluidEQ is free for everyone (Ivan, 2026-11-11): nothing to buy.
    lines.forEach((line) => {
      expect(line).not.toMatch(/[$€£¥]|\{price\}|\b19\b|\b29\b/);
    });
    expect(lines.join(' ')).toContain('{publisher}');
    expect(lines.join(' ')).toContain('{date}');
    // Where FluidEQ came from is the licence's and About's to say, never
    // this page's (Ivan, 2026-11-11), and nothing false stands in for it.
    expect(lines.join(' ')).not.toMatch(/aqua|fork|from scratch|from nothing/i);
  });

  it('says it is signed and free, and promises nothing of Windows warnings', () => {
    const english = tourLines('en', /^\s*'tour\.signed\./).join(' ');
    expect(english).toContain('Now signed, for free!');
    expect(english).toContain('Thank you');
    expect(english).not.toMatch(/edition|account|paddle|credit/i);
    expect(english).not.toMatch(/warning|smartscreen/i);
  });

  // Ivan, 2026-11-11: "not true and fixed month on text dont put that on
  // text". A length of time goes stale the day after the release (the live
  // count says how long), and the gallery's scenes are bought, so nothing may
  // claim there is nothing to buy.
  const STALE =
    /\bmonths?\b|\bweeks?\b|\bmeses\b|\bsemanas?\b|\bmois\b|\bsemaines?\b|\bMonate?n?\b|\bWochen?\b|\bmesi\b|\bsettimane?\b|месяц|недел|महीन|हफ़्त|か月|週間|개월|석 달|个月|個月/i;
  const NOTHING_TO_BUY =
    /nothing to buy|nothing to activate|nada que comprar|nada para comprar|rien à acheter|nichts zu kaufen|niente da comprare|ничего не нужно покупать|न कुछ ख़रीदना|購入も|구매할 것도|无需购买|不必購買/i;

  it.each(LOCALES)(
    'names no length of time and no "nothing to buy", in %s',
    (locale) => {
      const page = tourLines(locale, /^\s*'tour\.signed\./).join(' ');
      expect(page).not.toMatch(STALE);
      expect(page).not.toMatch(NOTHING_TO_BUY);
    },
  );

  it('catches what it is there to catch', () => {
    expect('A little over three months on, it has').toMatch(STALE);
    expect('Pouco mais de três meses depois').toMatch(STALE);
    expect('Чуть больше трёх месяцев спустя').toMatch(STALE);
    expect('with nothing to buy and nothing to activate').toMatch(
      NOTHING_TO_BUY,
    );
    expect('The app costs nothing and needs no activation.').not.toMatch(
      NOTHING_TO_BUY,
    );
  });

  it('keeps the notes’ opening to what is true of the app', () => {
    const app = release('2.5.0').split(/^### /m)[1] ?? '';
    expect(app).not.toMatch(STALE);
    expect(app).not.toMatch(NOTHING_TO_BUY);
    expect(app).toContain('The app costs');
  });
});

/**
 * Words of the paid edition and of GPT, which 2.5 no longer has (Ivan,
 * 2026-11-11: "make sure you update all, release notes and What's New"),
 * in English and as the locales spelled the editions (Spanish, Portuguese and
 * French say "editing" with the same word, so only the editions' names count).
 */
const OLD_DIRECTION =
  /edition|édition (gratuite|signée)|edición (gratuita|firmada)|edizione|edição (gratuita|assinada)|издани|エディション|에디션|paddle|\$\s?19|19\s?\$|another email|gpt|codex/i;

/** Every key 2.5's slides read, in both What's News. */
const SLIDES_25 = /^\s*'tour\.(signed|edit|watch|makers|code|v25)\./;

describe('2.5 says nothing of a paid edition or GPT', () => {
  it.each(LOCALES)('in its slides, in %s', (locale) => {
    const lines = tourLines(locale, SLIDES_25);
    // The control: the pattern reads the slides, all of them.
    expect(lines.length).toBeGreaterThan(40);
    expect(lines.filter((line) => OLD_DIRECTION.test(line))).toEqual([]);
  });

  it('in its release notes', () => {
    expect(release('2.5.0')).not.toMatch(OLD_DIRECTION);
    // The control: the pattern finds what it looks for.
    expect('the Signed Edition – $19').toMatch(OLD_DIRECTION);
    expect('I bought it with another email').toMatch(OLD_DIRECTION);
  });

  // The site's licence guard refuses a licence-key vocabulary (GPL section
  // 10's "activation" among it), and 2.5's notes reach the site's changelog.
  const LICENCE_WORDS = /activation|licen[cs]e key|per-seat/i;

  it.each(LOCALES)('nor in a licence-key word, in %s', (locale) => {
    expect(
      tourLines(locale, SLIDES_25).filter((line) => LICENCE_WORDS.test(line)),
    ).toEqual([]);
  });

  it('nor in a licence-key word in its release notes', () => {
    expect(release('2.5.0')).not.toMatch(LICENCE_WORDS);
    expect('The app costs nothing and needs no activation.').toMatch(
      LICENCE_WORDS,
    );
    expect('a per-seat licence key').toMatch(LICENCE_WORDS);
  });

  it('nor any release’s notes, of FluidEQ’s own features', () => {
    expect(notes).not.toMatch(/\bGPT\b|ChatGPT|Codex/);
  });
});

describe('Higgsfield, the Studio’s one maker', () => {
  // GPT left the Studio (2026-11-11): no slide or note may still offer it.
  it.each(LOCALES)('leaves GPT out of the makers slide, in %s', (locale) => {
    const makers = tourLines(locale, /^\s*'tour\.makers\./).join('\n');
    expect(makers).toContain('Higgsfield');
    expect(makers).not.toMatch(/GPT/);
  });

  it('is in 2.5’s notes in Ivan’s words', () => {
    expect(release('2.5.0')).toContain('Now integrated with Higgsfield');
  });
});

describe('the release notes and the version', () => {
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

  const partsOf = (section: string): string[] =>
    section.split(/\r?\n/).filter((line) => /^### /.test(line));

  // Two parts and only two (Ivan, 2026-11-11: "one for the FluidEQ app, for
  // all related to sound etc., and the other section only for the
  // visualizers").
  it('has the app and the visualizers apart, from 2.4 on', () => {
    const later = sections.filter((section) => /^2\.(4|[5-9])\./.test(section));
    expect(later.length).toBeGreaterThan(1);
    later.forEach((section) => {
      expect(partsOf(section)).toEqual(['### FluidEQ', '### Visualizers']);
    });
  });

  // Regrouping 2.4.0 into two parts once replaced a line of its prose with a
  // heading, cutting the Visualizers' introduction off mid-sentence. The
  // text under the headings is pinned: retitling stays free, losing a word
  // does not. A real change to 2.4.0's words moves the pin in its commit.
  it('keeps 2.4.0’s words whatever its headings are called', () => {
    const words = release('2.4.0')
      .split(/\r?\n/)
      .filter((line) => !/^#{2,4} /.test(line))
      .join('\n');
    expect(createHash('sha256').update(words).digest('hex')).toBe(
      '84dd062d7e1cd1ff13397691bd2d3d32c6a580e48bc7d80d15303d2b12311986',
    );
  });

  it('names no heading twice within a release, from 2.4 on', () => {
    sections
      .filter((section) => /^2\.(4|[5-9])\./.test(section))
      .forEach((section) => {
        const headings = section
          .split(/\r?\n/)
          .filter((line) => /^#{3,4} /.test(line));
        expect(new Set(headings).size).toBe(headings.length);
      });
  });

  it('opens 2.5 on its signing, at the top of the app’s part', () => {
    const app = release('2.5.0').split(/^### /m)[1] ?? '';
    expect(app).toMatch(/^FluidEQ\s+\*\*Now signed, for free!\*\*/);
    expect(app).toContain('Ivan Carmenates');
    // Free for everyone, no paid edition: the app's part names no price,
    // edition, seller or account. The refund line under the visualizers
    // still speaks of credits, as its control.
    expect(app).not.toMatch(/credit|edition|paddle|account|\$/i);
    expect(release('2.5.0').split(/^### /m)[2]).toMatch(/credit back/);
  });
});
