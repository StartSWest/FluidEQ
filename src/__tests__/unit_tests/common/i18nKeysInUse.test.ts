/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import en from '../../../common/i18n/en';

/**
 * Every English key is read by something, or it is deleted.
 *
 * On 2026-09-21, 143 of 4,496 keys were read by nothing, each with nine
 * translations: the Voicing page, the Plus welcome, the EQ's old trim and
 * adaptive switches, a favourites panel, and fifty-one strings that had never
 * been wired to anything at all. Three more were the translations of refusals
 * the profile list was still printing in English in every language. Nothing
 * failed. The coverage test compares each language with English, and English
 * had them all.
 *
 * A key counts as read when the app, a build script or the guide's exporter
 * writes it out as a string anywhere (a call, a table, a type, a prop), or
 * when one of the builders below makes it at runtime. The sources are PARSED,
 * not searched, so a key named only in a comment is not read, and a test that
 * names a key does not keep it alive either.
 */

const REPO = path.resolve(__dirname, '../../../..');
const ROOTS = ['src', '.erb/scripts', 'scripts'];
const SKIPPED = [
  path.join(REPO, 'src', 'common', 'i18n'),
  path.join(REPO, 'src', '__tests__'),
];

/**
 * What a file builds: the keys, and the template in it that builds them with
 * every `${…}` written as `*`. A plain string is both. In the keys, `*` is one
 * dotted segment or the rest of one, and `{a,b}` lists the values filled in.
 */
type TBuilt = string | readonly [keys: string, template: string];

/**
 * Where keys are made at runtime rather than written out.
 *
 * A `*` excuses every key under its prefix, so it is used only where the
 * prefix holds nothing but what that builder fills in: presets, chapters,
 * categories. A builder in a namespace shared with ordinary labels — the bug
 * report's, the rhythm game's, the EQ mode menu's — lists its values instead,
 * or one template would excuse all of that feature's strings.
 */
const BUILDERS: Record<string, readonly TBuilt[]> = {
  'src/common/dsp/presetOrder.ts': ['dsp.eqPreset.*'],
  'src/renderer/ExtraOutputs.tsx': [
    'extraOutput.latency.*',
    'extraOutput.mode.*.title',
    'extraOutput.mode.*.body',
    'extraOutput.mode.*.buffer',
  ],
  'src/renderer/components/BugReportDialog.tsx': [
    [
      'bugReport.{copied,issuePaste,emailOpening,emailOpened,emailOpenedPartial,emailNotOpened}',
      'bugReport.*',
    ],
  ],
  'src/renderer/components/EqModeSelect.tsx': [
    // The menu's rows, its band shapes and its smoothing steps.
    [
      'eq.mode.{phase,q,strength,smoothing,constant,proportional,asymmetric,off,twelfth,third}',
      'eq.mode.*',
    ],
    ['eq.mode.{constant,proportional,asymmetric}Hint', 'eq.mode.*Hint'],
  ],
  'src/renderer/components/LookDesigner.tsx': ['look.peak.*'],
  'src/renderer/components/ProcessesDialog.tsx': ['app.processes.place.*'],
  'src/renderer/components/RhythmGame.tsx': [
    ['support.game.{perfect,great,good,miss}', 'support.game.*'],
  ],
  'src/renderer/components/ThemePicker.tsx': [
    ['theme.{ocean,black}', 'theme.*'],
  ],
  // Each slide is a prefix and a fixed set of suffixes, both typed unions in
  // the slide's own file; these are them.
  'src/renderer/components/featureTour/FeatureSlide.tsx': [
    [
      'tour.{library,dsp,output,looks,karaoke,maker,media}.{kicker,title,lead,how,open,point1,point2,point3,point4}',
      '*.*',
    ],
  ],
  'src/renderer/components/featureTour/ShowcaseSlide.tsx': [
    [
      'tour.{engine,room,plus,visualizers,desktop,lighting,player,games,presets,tone,studio,help}.{kicker,title,lead,how,open,point1,point2,point3}',
      '*.*',
    ],
  ],
  // `fact1`, `fact1Title`, `step1`, `step1Title`, …
  'src/renderer/components/featureTour/ShareAudioSlide.tsx': [
    'tour.share.fact*',
    'tour.share.step*',
  ],
  'src/renderer/dsp/DspEqBar.tsx': [
    'dsp.eqEngine.*',
    'dsp.eqModel.*',
    'dsp.eqPhase.*',
    'dsp.eqStereo.*',
  ],
  'src/renderer/dsp/DspMasterBar.tsx': ['dsp.masterPresetGroup.*'],
  'src/renderer/dsp/DspMasterCard.tsx': ['dsp.master.limit.*'],
  'src/renderer/dsp/DspRoomFit.tsx': ['dsp.room.head.*'],
  'src/renderer/dsp/presetPickEntries.tsx': ['dsp.eqPresetGroup.*'],
  'src/renderer/games/GamesPanel.tsx': ['games.source.*'],
  'src/renderer/graph/lookPickerRows.ts': ['graph.styleName.*'],
  'src/renderer/help/HelpGuide.tsx': [
    'help.*.title',
    'help.*.intro',
    'help.*.steps',
    'help.*.tip',
    'help.group.*',
  ],
  'src/renderer/help/helpSearch.ts': ['help.*.keywords'],
  'src/renderer/karaoke/KaraokeMakerSpeechMemoryPanel.tsx': [
    'karaoke.maker.memoryPolicy.*',
  ],
  'src/renderer/plus/GalleryParts.tsx': ['plus.category.*'],
  'src/renderer/plus/lighting/LightingDevices.tsx': [
    'lighting.effect.*',
    'lighting.form.*',
  ],
  'src/renderer/plus/lighting/LightingPanel.tsx': ['lighting.pulse.*'],
  'src/renderer/plus/lighting/LightingProfileTuning.tsx': [
    'lighting.focus.*',
    'lighting.idle.*',
  ],
  'src/renderer/remoteAudio/RemoteAudioMonitor.tsx': [
    ['remoteAudio.{listen,send}.kicker', 'remoteAudio.*.kicker'],
  ],
  'src/renderer/remoteAudio/RemoteAudioPanel.tsx': ['remoteAudio.error.*'],
  'src/renderer/studio/StudioBench.tsx': ['studio.problem.*'],
  'src/renderer/studio/StudioTestCard.tsx': [
    'studio.signal.*',
    'studio.signalHint.*',
    'studio.size.*',
  ],
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPattern = (keys: string) =>
  new RegExp(
    `^${keys
      .split(/(\*|\{[^}]*\})/)
      .map((part) => {
        if (part === '*') {
          return '[^.]+';
        }
        if (part.startsWith('{')) {
          return `(?:${part.slice(1, -1).split(',').map(escape).join('|')})`;
        }
        return escape(part);
      })
      .join('')}$`,
  );

const BUILT = Object.entries(BUILDERS).flatMap(([file, built]) =>
  built.map((entry) => {
    const [keys, template] = typeof entry === 'string' ? [entry, entry] : entry;
    return { file, keys, template, pattern: toPattern(keys) };
  }),
);

interface ISources {
  files: string[];
  /** Every string written out anywhere in them. */
  strings: Set<string>;
  /** Per file, the shape of every template with a `${…}` in it. */
  templates: Map<string, Set<string>>;
}

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED.includes(full) ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx|js|jsx|cjs|mjs)$/.test(entry.name) &&
      !/\.test\.[jt]sx?$/.test(entry.name)
      ? [full]
      : [];
  });

const scriptKind = (file: string) => {
  if (file.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }
  if (file.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }
  return /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
};

let parsed: ISources | undefined;

/** Parsed once for the whole file: about 1,400 sources, a second or so. */
const readSources = (): ISources => {
  if (parsed) {
    return parsed;
  }
  const files = ROOTS.map((root) => path.join(REPO, root))
    .filter((root) => fs.existsSync(root))
    .flatMap(sourceFiles);
  const strings = new Set<string>();
  const templates = new Map<string, Set<string>>();
  files.forEach((file) => {
    const shapes = new Set<string>();
    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        strings.add(node.text);
      } else if (
        ts.isTemplateExpression(node) ||
        ts.isTemplateLiteralTypeNode(node)
      ) {
        shapes.add(
          [
            node.head.text,
            ...node.templateSpans.map((span) => span.literal.text),
          ].join('*'),
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(
      ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        false,
        scriptKind(file),
      ),
    );
    templates.set(path.relative(REPO, file).split(path.sep).join('/'), shapes);
  });
  parsed = { files, strings, templates };
  return parsed;
};

/** The keys neither written out nor built. */
const unread = (keys: string[], strings: Set<string>) =>
  keys.filter(
    (key) =>
      !strings.has(key) && !BUILT.some(({ pattern }) => pattern.test(key)),
  );

describe('the dictionaries', () => {
  it('hold no key that nothing reads', () => {
    // Delete what this lists from all ten languages in one change — or, if
    // the key is made at runtime, add the place that makes it to BUILDERS.
    expect(unread(Object.keys(en), readSources().strings)).toEqual([]);
  });

  it('would notice a key that nothing reads', () => {
    // The control for the test above: a scan that found no sources, or a
    // builder that excused everything, would pass that one just the same.
    const { files, strings } = readSources();
    expect(files.length).toBeGreaterThan(1000);
    expect(strings.has('tour.title')).toBe(true);
    // Read only through its slide's builder.
    expect(strings.has('tour.library.kicker')).toBe(false);
    expect(
      unread(
        [
          'tour.library.kicker',
          'tour.library.point5',
          'bugReport.title',
          'bugReport.nobodyReadsThis',
          'theme.aria',
        ],
        strings,
      ),
    ).toEqual(['tour.library.point5', 'bugReport.nobodyReadsThis']);
  });

  it('list only builders that are still there, and only keys that exist', () => {
    // A builder taken out of the app would leave its keys excused here for
    // good, unless its entry has to go with it.
    const { templates } = readSources();
    const keys = Object.keys(en);
    const stale = BUILT.flatMap(({ file, keys: built, template, pattern }) => {
      const found = templates.get(file);
      if (!found) {
        return [`${built}: ${file} is not a source any more`];
      }
      if (!found.has(template)) {
        return [`${built}: ${file} has no \`${template}\``];
      }
      return keys.some((key) => pattern.test(key))
        ? []
        : [`${built}: matches no key in the dictionary`];
    });
    expect(stale).toEqual([]);
  });
});
