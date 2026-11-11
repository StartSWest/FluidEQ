/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The patterns skill (`assets/studio/fluideq/skills/fluideq-patterns`; Ivan,
 * 2026-11-11: "rules ... so it makes super great scenes that animate with
 * music and use all capabilities"): short worked pieces the Studio's AI
 * adapts. An AI copies an example more faithfully than it follows a rule, so
 * an example that names a uniform the engine does not hand over, breaks a
 * scene rule or writes a formula the world drops would be taught to every
 * scene. Each piece is held to the engine's own readers here.
 *
 * FluidEQ's own scenes are what the Visualizers sell: none of their source
 * is in this skill, and it says so of itself.
 */

import fs from 'fs';
import path from 'path';
import { checkMemberSceneSource } from '../../../common/memberSceneRules';
import type { IScenePack } from '../../../common/scenePacks';
import { assembleFragmentSource } from '../../../common/sceneUniformContract';
import { WORLD_SIGNALS, worldScopeNames } from '../../../common/sceneWorld';
import { isValidExpression } from '../../../common/worldExpression';

const SKILL = fs
  .readFileSync(
    path.join(
      __dirname,
      '../../../../assets/studio/fluideq/skills/fluideq-patterns/SKILL.md',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

const blocks = (language: string) =>
  [
    ...SKILL.matchAll(
      new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g'),
    ),
  ].map((match) => match[1]);

const HELPERS = blocks('glsl').join('\n');

/** A scene that uses every helper the skill gives, as a member's would. */
const PATTERNS_SCENE = `${HELPERS}
vec4 sceneColour(vec2 uv) {
  vec4 song = songState();
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 subject = vec2(0.5 + 0.03 * barSway(), 0.4 + 0.06 * beatLift()) * aspect;
  vec3 col = skyAt(uv.y) * (1.0 - 0.3 * song.x);
  col += vec3(1.0, 0.6, 0.3) * lampStrength()
       * exp(-20.0 * length(uv * aspect - subject)) * (0.4 + 0.6 * song.y);
  col = buildAndDrop(col, uv * aspect, subject);
  col = underTheHand(col, uv);
  col = 1.0 - exp(-col * 1.4);
  return vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}
`;

/** A pack with the one control every scene declares. */
const pack = {
  params: [
    { id: 'daylight', names: { en: 'Daylight' }, min: 0, max: 100, value: 0 },
  ],
  palettes: [],
  colours: [],
  source: PATTERNS_SCENE,
} as unknown as IScenePack;

const ASSEMBLED = assembleFragmentSource(pack).source;

describe('the GLSL patterns', () => {
  it('are the six helpers the skill names', () => {
    [
      'vec4 songState()',
      'float beatLift()',
      'float barSway()',
      'vec3 buildAndDrop(vec3 col, vec2 p, vec2 subject)',
      'vec3 hours()',
      'vec3 skyAt(float height)',
      'float lampStrength()',
      'vec3 underTheHand(vec3 col, vec2 uv)',
    ].forEach((signature) => expect(HELPERS).toContain(signature));
  });

  it('keep every rule FluidEQ holds a scene to', () => {
    expect(checkMemberSceneSource(PATTERNS_SCENE)).toEqual([]);
    // The control: the checker does refuse what it should.
    expect(
      checkMemberSceneSource(`#define X 1\n${PATTERNS_SCENE}`),
    ).not.toEqual([]);
  });

  it('use only what a scene is handed', () => {
    const declared = new Set(
      [...ASSEMBLED.matchAll(/uniform\s+\w+\s+(u[A-Z]\w*)\s*;/g)].map(
        (match) => match[1],
      ),
    );
    const used = [...new Set(HELPERS.match(/\bu[A-Z]\w*/g) ?? [])];
    expect(used.filter((name) => !declared.has(name))).toEqual([]);
    // The control: they do use the music's time, the song and the hand.
    expect(used).toEqual(
      expect.arrayContaining([
        'uRhythm',
        'uSong',
        'uLevel',
        'uPointer',
        'uTap',
        'uParam_daylight',
      ]),
    );
  });

  it('move nothing by a hit, and no body by anything but the clock', () => {
    // Bodies are moved by uRhythm; uDrums and uBeat arrive after the hit.
    expect(HELPERS).not.toMatch(/uDrums|uBeat\b/);
  });

  it('keep the three times of day adding up to one, black at night', () => {
    const hours = (daylight: number) => {
      const day = daylight / 100;
      const step = (from: number, to: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
        return t * t * (3 - 2 * t);
      };
      const up = step(0, 0.45, day);
      const high = step(0.55, 1, day);
      return [1 - up, up - high, high];
    };
    // As the skill writes it: the same two smoothsteps, the same three sums.
    expect(HELPERS).toContain('float up = smoothstep(0.0, 0.45, day);');
    expect(HELPERS).toContain('float high = smoothstep(0.55, 1.0, day);');
    expect(HELPERS).toContain('return vec3(1.0 - up, up - high, high);');
    [0, 10, 30, 50, 70, 90, 100].forEach((daylight) => {
      const [night, dusk, day] = hours(daylight);
      expect(night + dusk + day).toBeCloseTo(1, 9);
      [night, dusk, day].forEach((weight) =>
        expect(weight).toBeGreaterThanOrEqual(0),
      );
    });
    expect(hours(0)).toEqual([1, 0, 0]);
    expect(hours(50)).toEqual([0, 1, 0]);
    expect(hours(100)).toEqual([0, 0, 1]);
    // The night sky's two colours, as written: far under the 6% line.
    const night = [...HELPERS.matchAll(/h\.x \* vec3\(([^)]*)\)/g)].flatMap(
      (match) => match[1].split(',').map(Number),
    );
    expect(night).toHaveLength(6);
    expect(Math.max(...night)).toBeLessThan(0.02);
  });
});

describe('the 3D-world pattern', () => {
  const world = JSON.parse(`{${blocks('json')[0]}}`) as {
    vars: Record<string, string>;
    nodes: {
      type: string;
      light: { kind: string; intensity: string; distance: number };
    }[];
  };

  it('is one light whose strength is a formula on the bass and the kick', () => {
    expect(world.nodes).toHaveLength(1);
    expect(world.nodes[0].type).toBe('light');
    expect(world.nodes[0].light.kind).toBe('point');
    expect(world.nodes[0].light.intensity).toMatch(/weight/);
    expect(world.vars.weight).toContain('bass');
    expect(world.vars.thump).toContain('drumKick');
  });

  it('writes only formulas the world can run, each var after those it uses', () => {
    const names = Object.keys(world.vars);
    names.forEach((name, index) => {
      const scope = {
        names: worldScopeNames(['daylight'], names.slice(0, index)),
      };
      expect(isValidExpression(world.vars[name], scope)).toBe(true);
    });
    const all = { names: worldScopeNames(['daylight'], names) };
    expect(isValidExpression(world.nodes[0].light.intensity, all)).toBe(true);
    // The control: a name the world does not know is refused.
    expect(isValidExpression('weight + kickDrum', all)).toBe(false);
  });

  it('names no var like a signal, which the world would drop', () => {
    const signals = new Set<string>(WORLD_SIGNALS);
    expect(Object.keys(world.vars).filter((name) => signals.has(name))).toEqual(
      [],
    );
  });
});

it('says of itself that it is no scene of FluidEQ’s own', () => {
  expect(SKILL).toContain('They are written for this skill');
  expect(SKILL).toContain('none is a scene');
});
