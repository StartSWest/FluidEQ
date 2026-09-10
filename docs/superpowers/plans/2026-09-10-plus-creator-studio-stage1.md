# Plus Creator Studio — Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plus members build scenes in a Studio inside Community — copy an AI prompt, link a project folder, watch the scene live on their music with test signals — and add them to their look picker under "Made by you".

**Architecture:** Member scenes are ordinary `IScenePack`s built from a folder by the main process, checked by stricter member rules (`memberSceneRules.ts`, dependency-free so the server can vendor it in stage 2), stored unsigned in `userData/member-scenes/own/`, and drawn by the existing WebGL engine through a shared scene runner. Member scenes get two extra safeguards the official ones do not: a warm-up ladder that starts at an eighth of the size, and a GPU brightness limiter.

**Tech Stack:** Electron 43 main + React renderer, TypeScript strict, WebGL2 (GLSL ES 3.00), Jest (ts-jest, jsdom; `@jest-environment node` for main), SCSS, i18n dictionaries in ten locales.

**Spec:** `docs/superpowers/specs/2026-09-10-plus-creator-studio-design.md` — §3 Studio, §4 folder, §5 channels, §6 rules, §7 security, §12 stage 1. Stage 2 (signing, import/export, likes, block list, terms v2) is a separate plan.

## Global Constraints

- Work only in the worktree `.claude/worktrees/plus-studio` on branch `plus-studio`. Never touch the main checkout: another agent has uncommitted work there.
- **No `setTimeout`, no `setInterval`, anywhere.** Wait on events, promises, or `requestAnimationFrame`. Burst coalescing uses an in-flight flag plus a dirty flag.
- Strict TS: no `any`, no `!`, no `@ts-ignore`, no `==`, no empty `catch` (a comment saying why it is safe to ignore is required), no `console.log`.
- Files under 500 lines. Comments state constraints and reasons, never what the next line does.
- Every user-facing string in all ten locales (`en es pt fr de it ru zh ja hi`) in the same commit. The AI prompt body is English by decision (spec §2); its button labels and idea chips are translated.
- File headers: source files use the long GPL header (copy from any `src/common/*.ts`); tests use the short SPDX header.
- The renderer never supplies a filesystem path to main. Paths come only from native dialogs in main.
- Member look ids: `member:<authorId>:<packId>`. Never a `GraphStyle`, never `premium:`.
- Member rules: no `#` outside comments; `for` loops only, constant bounds, ≤ 128 iterations, loop variable not assigned in the body; no `while`/`do`; no `main`; printable ASCII outside comments; source ≤ 64 KB; names ≤ 40 characters per locale.
- Warm-up rungs `[0.125, 0.25, 0.5, 0.75, 1]`. Brightness limit: 0.5 of full relative luminance per second, per cell of a 4 × 4 grid.
- UI reuses app classes (`button small`, `button small subtle`); weights via `$weight-*`; fonts via the theme stacks. Every UI change is looked at on screen at normal, narrow and fullscreen sizes before it is called done.
- Commands (run from the worktree): one test file `pnpm exec jest <path>`; typecheck `pnpm typecheck`; lint `pnpm lint`; styles `pnpm typecheck:styles`. Tests need `release/app/dist/main/main.js` and `release/app/dist/renderer/renderer.js` — run `pnpm build` once first.
- Commit after each task; end commit messages with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File map

| File                                                                                          | Responsibility                                                                                              |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/common/memberSceneRules.ts` (new)                                                        | Dependency-free GLSL checks: comment stripping, preprocessor, loops, `main`, ASCII, size.                   |
| `src/common/memberScenes.ts` (new)                                                            | Member look ids, display-text sanitising, `normalizeMemberScene` (pack + rules + name caps), problem types. |
| `src/main/memberScenes/project.ts` (new)                                                      | Build a pack from a project folder safely; write the starter project.                                       |
| `src/main/memberScenes/starterScene.ts` (new)                                                 | The starter `pack.json` and `scene.frag` text.                                                              |
| `src/main/memberScenes/projectWatcher.ts` (new)                                               | Watch a folder; coalesce bursts of saves without timers.                                                    |
| `src/main/memberScenes/store.ts` (new)                                                        | The member's own scenes on disk: list, load (re-validated), save, remove, quarantine.                       |
| `src/main/ipc/memberScenes.ts` (new)                                                          | IPC for the store and the Studio, with the Plus gate; linked-folder memory.                                 |
| `src/main/api.ts`, `src/main/main.ts` (modify)                                                | Bridge functions; registration and dispose.                                                                 |
| `src/renderer/graph/sceneWarmup.ts` (new)                                                     | Warm-up ladder with the `ICostLadder` interface.                                                            |
| `src/renderer/graph/sceneFlashGuard.ts` (new)                                                 | GPU brightness limiter post-pass, plus its pure limit maths.                                                |
| `src/renderer/graph/useSceneRunner.ts` (new)                                                  | The GL loop extracted from `SceneCanvas`, shared by the graph and the Studio stage.                         |
| `src/renderer/graph/SceneCanvas.tsx` (modify)                                                 | Thin wrapper over the runner for official and member looks.                                                 |
| `src/renderer/utils/memberScenes.ts` (new)                                                    | Renderer store of member scenes, like `utils/scenePacks.ts`.                                                |
| `src/renderer/utils/graphStyle.ts`, `graph/FrequencyResponseChart.tsx` (modify)               | Member ids in selection and the picker's "Made by you" section.                                             |
| `src/renderer/studio/*` (new)                                                                 | Studio UI: panel, start, stage, meters, signals, prompt, store.                                             |
| `src/renderer/community/CommunityPanel.tsx` (modify)                                          | The Studio rail entry and view.                                                                             |
| `src/renderer/styles/Studio.scss` (new)                                                       | Studio styles.                                                                                              |
| `src/common/i18n/<locale>/studio.ts` (new ×10), `index.ts` (modify ×10), `eq.ts` (modify ×10) | Strings.                                                                                                    |

Code blocks preceded by `<!-- file: path -->` are complete file contents; the
executor writes them with `node <scratchpad>/extract-plan.mjs <this plan> "Task N"`.

---

### Task 1: Member source rules

**Files:**

- Create: `src/common/memberSceneRules.ts`
- Test: `src/__tests__/unit_tests/common/memberSceneRules.test.ts`

**Interfaces:**

- Produces: `MAX_MEMBER_SOURCE_BYTES = 65536`, `MAX_MEMBER_LOOP_ITERATIONS = 128`, `type TMemberRuleCode`, `interface IMemberRuleViolation { code: TMemberRuleCode; line: number }`, `blankGlslComments(source: string): string | null`, `checkMemberSceneSource(source: string): IMemberRuleViolation[]` (sorted by line, at most one per code). No imports — stage 2 vendors this file into a Deno function.

- [ ] **Step 1: Write the failing test**

<!-- file: src/__tests__/unit_tests/common/memberSceneRules.test.ts -->

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  blankGlslComments,
  checkMemberSceneSource,
  MAX_MEMBER_SOURCE_BYTES,
} from '../../../common/memberSceneRules';

// Every rule below is only meaningful beside this: a realistic scene, with
// comments that mention everything the rules forbid, passes untouched.
const GOOD = `// A scene that uses # and while and main() in its notes — moiré, ×2.
/* Block comment: #define FOO, do { } while (1); */
const int BIRDS = 5;
const float TAU = 6.2831853;
float band(float f) { return texture(uSpectrumSlow, vec2(f, 0.5)).r; }
vec4 sceneColour(vec2 uv) {
  vec3 colour = vec3(0.0);
  for (int i = 0; i < BIRDS; i++) {
    colour += uAccent * band(float(i) / 5.0) * 0.1;
  }
  for (int k = 3; k >= 0; k--) {
    colour *= 0.98 + 0.01 * float(k);
  }
  for (int j = 0; j <= 126; j += 2) colour += vec3(0.0001);
  return vec4(colour * uLevel, 1.0);
}
`;

const codes = (source: string) =>
  checkMemberSceneSource(source).map((violation) => violation.code);

describe('member scene rules', () => {
  it('accepts a realistic scene, whatever its comments say', () => {
    expect(checkMemberSceneSource(GOOD)).toEqual([]);
  });

  it('blanks comments without moving any line', () => {
    const blanked = blankGlslComments('a // x\n/* y\nz */ b');
    expect(blanked).toBe('a     \n    \n     b');
    expect(blankGlslComments('/* never closed')).toBeNull();
  });

  it.each([
    ['a preprocessor line', '#define GLOW 1.0\n', 'preprocessor'],
    ['a while loop', 'float f() { while (true) {} return 0.0; }\n', 'while'],
    ['a do loop', 'float f() { do { } while (false); return 0.0; }\n', 'do'],
    ['a main function', 'void main() {}\n', 'main'],
    [
      'a variable bound',
      'float f(int n) { for (int i = 0; i < n; i++) {} return 0.0; }\n',
      'loop-shape',
    ],
    [
      'a bound over 128',
      'float f() { for (int i = 0; i < 129; i++) {} return 0.0; }\n',
      'loop-bound',
    ],
    [
      'a step the wrong way',
      'float f() { for (int i = 0; i < 4; i--) {} return 0.0; }\n',
      'loop-shape',
    ],
    [
      'an assigned loop variable',
      'float f() { for (int i = 0; i < 4; i++) { i = 0; } return 0.0; }\n',
      'loop-assign',
    ],
    ['non-ASCII code', 'float café = 1.0;\n', 'non-ascii'],
  ])('refuses %s', (_name, extra, code) => {
    expect(codes(`${extra}${GOOD}`)).toContain(code);
    // The same scene without the extra lines is the control for each case.
    expect(codes(GOOD)).not.toContain(code);
  });

  it('refuses a block comment that never closes', () => {
    // After the scene, so no later `*/` in it can close the comment.
    expect(codes(`${GOOD}/* open\n`)).toEqual(['unterminated-comment']);
  });

  it('refuses a source with no sceneColour', () => {
    expect(codes('vec4 other(vec2 uv) { return vec4(1.0); }\n')).toEqual([
      'entry-point',
    ]);
  });

  it('refuses a source over 64 KB and accepts one just under', () => {
    const pad = (bytes: number) => `// ${'x'.repeat(bytes)}\n`;
    const room =
      MAX_MEMBER_SOURCE_BYTES - new TextEncoder().encode(GOOD).length;
    expect(codes(`${pad(room - 5)}${GOOD}`)).toEqual([]);
    expect(codes(`${pad(room + 5)}${GOOD}`)).toContain('too-large');
  });

  it('points at the line that broke the rule', () => {
    const [violation] = checkMemberSceneSource(`${GOOD}\n\n#pragma x\n`);
    // GOOD is sixteen lines, then two blank ones: the directive is line 19.
    expect(violation).toEqual({ code: 'preprocessor', line: 19 });
  });

  it('reports each rule once, in line order', () => {
    const source = `#a\n#b\nvoid main() {}\n${GOOD}`;
    expect(checkMemberSceneSource(source)).toEqual([
      { code: 'preprocessor', line: 1 },
      { code: 'main', line: 3 },
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec jest src/__tests__/unit_tests/common/memberSceneRules.test.ts`
Expected: FAIL — cannot find module `../../../common/memberSceneRules`.

- [ ] **Step 3: Write the implementation**

<!-- file: src/common/memberSceneRules.ts -->

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The rules a member's scene must keep, on top of the ones every scene pack
 * keeps (see `scenePacks.ts`).
 *
 * Official scenes are read by a person before they are signed; members' are
 * not, so their source is held to rules that make two things impossible
 * rather than unlikely. A preprocessor line could `#define main` away and
 * replace the wrapper the app puts around every scene — and with it the fade
 * and every guard in it — so no `#` may appear outside a comment. A loop could
 * run long enough to reset the graphics driver, so the only loop is a `for`
 * with constant bounds, at most 128 turns, whose counter the body never
 * touches. Every one of the thirty official scenes already keeps these rules.
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno
 * as it is, and the checks must be the same bytes on both sides.
 */

export const MAX_MEMBER_SOURCE_BYTES = 64 * 1024;
export const MAX_MEMBER_LOOP_ITERATIONS = 128;

export type TMemberRuleCode =
  | 'too-large'
  | 'unterminated-comment'
  | 'preprocessor'
  | 'non-ascii'
  | 'while'
  | 'do'
  | 'main'
  | 'loop-shape'
  | 'loop-bound'
  | 'loop-assign'
  | 'entry-point';

export interface IMemberRuleViolation {
  code: TMemberRuleCode;
  /** One-based, in the author's own file. */
  line: number;
}

const ENTRY_POINT = /\bvec4\s+sceneColour\s*\(\s*vec2\s+\w+\s*\)/;
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;
const CONST_INT = /\bconst\s+int\s+([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*;/g;
const FOR_HEADER =
  /^\s*int\s+([A-Za-z_]\w*)\s*=\s*(-?\w+)\s*;\s*([A-Za-z_]\w*)\s*(<=|<|>=|>)\s*(-?\w+)\s*;\s*(.*?)\s*$/s;

/**
 * Comments replaced by spaces, newlines kept — so a line number found in the
 * result is the line the author sees. `null` for a block comment that never
 * closes, which a compiler would read as the rest of the file.
 */
export const blankGlslComments = (source: string): string | null => {
  const out: string[] = [];
  let at = 0;
  while (at < source.length) {
    const pair = source.slice(at, at + 2);
    if (pair === '//') {
      while (at < source.length && source[at] !== '\n') {
        out.push(' ');
        at += 1;
      }
    } else if (pair === '/*') {
      const end = source.indexOf('*/', at + 2);
      if (end < 0) {
        return null;
      }
      for (let k = at; k < end + 2; k += 1) {
        out.push(source[k] === '\n' ? '\n' : ' ');
      }
      at = end + 2;
    } else {
      out.push(source[at]);
      at += 1;
    }
  }
  return out.join('');
};

const lineAt = (text: string, index: number): number => {
  let line = 1;
  for (let k = 0; k < index; k += 1) {
    if (text.charCodeAt(k) === 10) {
      line += 1;
    }
  }
  return line;
};

/** The index of the bracket that closes the one at `open`, or -1. */
const matching = (text: string, open: number, left: string, right: string) => {
  let depth = 0;
  for (let k = open; k < text.length; k += 1) {
    if (text[k] === left) {
      depth += 1;
    } else if (text[k] === right) {
      depth -= 1;
      if (depth === 0) {
        return k;
      }
    }
  }
  return -1;
};

const readInt = (token: string, constants: Map<string, number>) => {
  if (/^-?\d+$/.test(token)) {
    return Number(token);
  }
  return constants.get(token);
};

/** How far one turn moves the counter, or undefined for anything else. */
const readStep = (
  step: string,
  counter: string,
  constants: Map<string, number>,
): number | undefined => {
  const compact = step.replace(/\s+/g, '');
  if (compact === `${counter}++` || compact === `++${counter}`) {
    return 1;
  }
  if (compact === `${counter}--` || compact === `--${counter}`) {
    return -1;
  }
  const by = compact.match(/^([A-Za-z_]\w*)([+-])=(-?\w+)$/);
  if (!by || by[1] !== counter) {
    return undefined;
  }
  const size = readInt(by[3], constants);
  return size === undefined ? undefined : by[2] === '+' ? size : -size;
};

const turns = (start: number, end: number, test: string, step: number) => {
  if (test === '<') {
    return end > start ? Math.ceil((end - start) / step) : 0;
  }
  if (test === '<=') {
    return end >= start ? Math.floor((end - start) / step) + 1 : 0;
  }
  if (test === '>') {
    return start > end ? Math.ceil((start - end) / -step) : 0;
  }
  return start >= end ? Math.floor((start - end) / -step) + 1 : 0;
};

/** Where a loop's body ends: its closing brace, or the end of one statement. */
const bodyEnd = (code: string, from: number): number => {
  let at = from;
  while (at < code.length && /\s/.test(code[at])) {
    at += 1;
  }
  if (code[at] === '{') {
    return matching(code, at, '{', '}');
  }
  let depth = 0;
  for (let k = at; k < code.length; k += 1) {
    if (code[k] === '(') {
      depth += 1;
    } else if (code[k] === ')') {
      depth -= 1;
    } else if (code[k] === ';' && depth === 0) {
      return k;
    }
  }
  return -1;
};

type TLoopFinding = TMemberRuleCode | undefined;

const checkLoop = (
  code: string,
  open: number,
  constants: Map<string, number>,
): TLoopFinding => {
  const close = matching(code, open, '(', ')');
  if (close < 0) {
    return 'loop-shape';
  }
  const header = code.slice(open + 1, close).match(FOR_HEADER);
  if (!header) {
    return 'loop-shape';
  }
  const [, counter, from, tested, test, to, stepText] = header;
  const start = readInt(from, constants);
  const end = readInt(to, constants);
  const step = readStep(stepText, counter, constants);
  if (
    tested !== counter ||
    start === undefined ||
    end === undefined ||
    step === undefined ||
    step === 0 ||
    ((test === '<' || test === '<=') && step < 0) ||
    ((test === '>' || test === '>=') && step > 0)
  ) {
    return 'loop-shape';
  }
  if (turns(start, end, test, step) > MAX_MEMBER_LOOP_ITERATIONS) {
    return 'loop-bound';
  }
  const last = bodyEnd(code, close + 1);
  if (last < 0) {
    return 'loop-shape';
  }
  const body = code.slice(close + 1, last + 1);
  const assigned = new RegExp(
    `\\b${counter}\\s*(?:[-+*/%]?=(?!=)|\\+\\+|--)|(?:\\+\\+|--)\\s*${counter}\\b`,
  );
  return assigned.test(body) ? 'loop-assign' : undefined;
};

/**
 * Every rule the source breaks, at most once each, in the order they appear.
 * Empty means the source may be handed to the compiler.
 */
export const checkMemberSceneSource = (
  source: string,
): IMemberRuleViolation[] => {
  const found = new Map<TMemberRuleCode, number>();
  const note = (code: TMemberRuleCode, line: number) => {
    if (!found.has(code)) {
      found.set(code, line);
    }
  };

  if (new TextEncoder().encode(source).byteLength > MAX_MEMBER_SOURCE_BYTES) {
    note('too-large', 1);
  }
  const code = blankGlslComments(source);
  if (code === null) {
    note('unterminated-comment', lineAt(source, source.lastIndexOf('/*')));
    return [...found].map(([rule, line]) => ({ code: rule, line }));
  }

  for (let k = 0; k < code.length; k += 1) {
    const unit = code.charCodeAt(k);
    const printable = unit >= 32 && unit <= 126;
    if (!printable && unit !== 9 && unit !== 10 && unit !== 13) {
      note('non-ascii', lineAt(code, k));
      break;
    }
  }
  const hash = code.indexOf('#');
  if (hash >= 0) {
    note('preprocessor', lineAt(code, hash));
  }

  const constants = new Map<string, number>();
  for (const [, name, value] of code.matchAll(CONST_INT)) {
    constants.set(name, Number(value));
  }

  for (const token of code.matchAll(IDENTIFIER)) {
    const word = token[0];
    const index = token.index ?? 0;
    if (word === 'while') {
      note('while', lineAt(code, index));
    } else if (word === 'do') {
      note('do', lineAt(code, index));
    } else if (word === 'main' && /^\s*\(/.test(code.slice(index + 4))) {
      note('main', lineAt(code, index));
    } else if (word === 'for') {
      const open = code.indexOf('(', index);
      const between = code.slice(index + 3, open);
      const finding =
        open < 0 || between.trim() !== ''
          ? 'loop-shape'
          : checkLoop(code, open, constants);
      if (finding) {
        note(finding, lineAt(code, index));
      }
    }
  }

  if (!ENTRY_POINT.test(code)) {
    note('entry-point', 1);
  }

  return [...found]
    .map(([rule, line]) => ({ code: rule, line }))
    .sort((a, b) => a.line - b.line);
};
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm exec jest src/__tests__/unit_tests/common/memberSceneRules.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Hold the official scenes to the same rules**

Run, from the worktree (reads the private repo beside the main checkout; skip silently is not allowed — if the repo is absent, say so in the report):

```bash
node -e "const ts=require('typescript');const fs=require('fs');const p=require('path');const src=fs.readFileSync('src/common/memberSceneRules.ts','utf8');const js=ts.transpileModule(src,{compilerOptions:{module:1,target:9}}).outputText;const m={exports:{}};new Function('module','exports',js)(m,m.exports);const root='../../../../fluideq-premium/packs';let bad=0;for(const d of fs.readdirSync(root)){const f=p.join(root,d,'scene.frag');if(!fs.existsSync(f))continue;const v=m.exports.checkMemberSceneSource(fs.readFileSync(f,'utf8'));if(v.length){bad++;console.log(d,JSON.stringify(v));}}console.log(bad?'FAIL':'all official scenes pass');"
```

Expected: `all official scenes pass`. Official scenes are checked without the private `shared/scene.glsl` prepended, which is what members get too.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm exec eslint src/common/memberSceneRules.ts src/__tests__/unit_tests/common/memberSceneRules.test.ts
git add src/common/memberSceneRules.ts src/__tests__/unit_tests/common/memberSceneRules.test.ts
git commit -m "feat(studio): the rules a member's scene must keep"
```

<!-- plan-end -->
