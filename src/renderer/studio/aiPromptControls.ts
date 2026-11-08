import {
  CHOICE_ICONS,
  MAX_CHOICE_NAME_LENGTH,
  MAX_CHOICE_OPTIONS,
  MAX_CHOICE_SWATCH,
  MIN_CHOICE_OPTIONS,
} from 'common/sceneChoice';
import { MAX_SCENE_COLOURS } from 'common/sceneColourControl';
import { MAX_SHOW_WHEN_KEYS } from 'common/sceneShowWhen';
import {
  MAX_PALETTE_STOPS,
  MAX_SCENE_PALETTES,
  MIN_PALETTE_STOPS,
  PALETTE_TEXELS,
} from 'common/scenePalette';

/**
 * The part of the Studio's AI prompt (`aiPrompt.ts`) about the two kinds of
 * control beside a slider (contract 9): a palette (`scenePalette.ts`) and a
 * choice (`sceneChoice.ts`). Ivan, 2026-11-07: "a new control on fluid so
 * scenes can use it", and "selectors to select options like dropdown but
 * nicer". Its numbers are the readers' own, so the brief cannot promise what
 * the engine refuses, and it names nothing of any one project: the brief is
 * one cached prefix for every scene's chat. With them, the single colour
 * (`sceneColourControl.ts`), an option's icon and colour chip, and
 * `showWhen` (`sceneShowWhen.ts`).
 *
 * Written as two more items of the pack.json fields list, under `params`,
 * in its indentation. English, like the rest of the prompt: a model reads it.
 */
export const CONTROLS_SECTION = `- A PALETTE is a control of its own kind in params: a gradient of colours I
  edit in FluidEQ - add a colour, drag it, recolour it, pick from twenty
  stock palettes, reverse it.
  { "id": "colours", "type": "palette", "names": { "en": "Colours" }, "stops": ["#ff3030", "#ffd21f", "#2fd66b", "#6b4cff"] }
  ${MIN_PALETTE_STOPS} to ${MAX_PALETTE_STOPS} stops, #rrggbb, bass to treble, spaced evenly from 0 to 1;
  "positions": [0, 0.3, 1] (one per stop, 0 to 1, in order) only to place
  them unevenly. At most ${MAX_SCENE_PALETTES} palettes, and they do NOT count toward the 8.
  Each becomes "uniform sampler2D uPalette_<id>;" automatically: the gradient
  ${PALETTE_TEXELS} texels wide, in LINEAR light. Read it as
  texture(uPalette_colours, vec2(t, 0.5)).rgb, t from 0 to 1 - along the
  spectrum (a bar's frequency), over time, by height, by distance. A shader
  that writes sRGB converts it as any linear colour: pow(c, vec3(1.0 / 2.2)).
  A 3D world's material GLSL sees the same uniform, and a world colour can be
  read from one: "colour": { "palette": "colours", "at": "<formula, 0 to 1>" }.
  Whenever the scene's colours are a set I might want to change, give them as
  a palette: never a rainbow written into the code that I cannot edit. My
  edits are written back as "stops": keep them when you rewrite pack.json.
  In Colourful mode FluidEQ's own wave, meters and bands wear the FIRST
  palette the scene is showing, in its order, bass to treble (or the single
  colours it shows when its choices hide that palette): put the scene's main
  colours first, and read a palette's t along the spectrum so the scene and
  the app agree.
- A CHOICE picks one of ${MIN_CHOICE_OPTIONS} to ${MAX_CHOICE_OPTIONS} named options, shown to me as buttons side by
  side (up to 4) or a menu (5 to ${MAX_CHOICE_OPTIONS}).
  { "id": "style", "type": "choice", "names": { "en": "Style" }, "min": 0, "max": 2, "value": 0,
    "options": [ { "names": { "en": "Bars" } }, { "names": { "en": "Rings" } }, { "names": { "en": "Both" } } ] }
  It becomes "uniform float uParam_<id>;" exactly as a slider does: the
  chosen option's number, 0 for the first, also p.<id> in a world's formulas.
  Round it before comparing: float style = floor(uParam_style + 0.5);
  Always write "min": 0 and "max" one less than the options: an older FluidEQ
  shows it as a slider across those numbers, so every option is still
  reachable. Option names are a word or two, at most ${MAX_CHOICE_NAME_LENGTH} characters, in
  English and any of the languages above. A choice counts toward the 8. Use
  one for modes I pick between - a style, a shape, a count, a variant of the
  scene - never for an amount, which is a slider. Every option has to show as
  plainly as a slider's two ends.
  An option may wear a picture beside its name: "icon", one of
  ${CHOICE_ICONS.join(', ')};
  and/or "swatch", 1 to ${MAX_CHOICE_SWATCH} #rrggbb colours drawn as a chip - give a colour mode's
  options their colours: { "names": { "en": "Rainbow" }, "swatch": ["#ff3030", "#ffd21f", "#2fd66b", "#6b4cff"] }.
- A COLOUR is one colour I pick, apart from the 8 sliders, at most ${MAX_SCENE_COLOURS}:
  { "id": "tint", "type": "colour", "names": { "en": "Colour" }, "value": "#00b3a4" }
  It becomes "uniform vec3 uColour_<id>;" automatically, in LINEAR light
  (converted from the sRGB I picked), like a palette's texture; a world's
  material GLSL sees it too. My pick is written back as "value": keep it when
  you rewrite pack.json. Use a colour for one thing I would want my own
  colour (a glow, a tint, an accent) and a palette for a set.
- "showWhen" on ANY control shows it only while a choice stands on one of the
  listed option numbers: "showWhen": { "style": [0] } for a colour used in a
  "One colour" mode, "showWhen": { "style": [1, 2] } for a palette used in the
  others. At most ${MAX_SHOW_WHEN_KEYS} choices, every one listed must match. A hidden
  control keeps its value and still reaches the shader, so the shader decides
  what is drawn and showWhen only tidies what I am offered: never show me a
  control that does nothing in the mode I am in.
`;
