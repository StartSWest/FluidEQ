/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCENE_WINDOW_COLOUR_STOPS,
  type ISceneWindowColours,
  type ISceneWindowColourStops,
  type TSceneWindowColourStop,
} from '../../common/sceneWindowColours';
import {
  lchOf,
  windowColourFaults,
  windowColourFaultsThroughDay,
  type TWindowColourFault,
} from '../../renderer/utils/windowColourCheck';

/**
 * What a look says of the scene's window colours: its Window colours check,
 * which has to pass before the scene is finished, like the Night check
 * (`darkLevel.ts`). A model judging colours from a picture alone named
 * mid-tone floors and dark accents; a measured verdict with the numbers and
 * the way out is what it acts on.
 */

const at = (value: number) => value.toFixed(2);

const faultLine = (
  fault: TWindowColourFault,
  colours: ISceneWindowColours,
): string => {
  const surface = lchOf(colours.surface);
  const accent = lchOf(colours.accent);
  const glow = lchOf(colours.glow);
  switch (fault) {
    case 'surface-mid':
      return `The surface is a mid-tone (lightness ${at(surface?.lightness ?? 0)} of 1), which FluidEQ cannot wear as named and moves. Take the picture's ground down to a night's floor, lightness 0.18 to 0.28 (like #1d2b4f), or for a picture that is truly light - snow, white marble - up to 0.85 or more.`;
    case 'accent-dim':
      return `The accent is too dark to point with (lightness ${at(accent?.lightness ?? 0)}): buttons in it vanish on a dark window. Keep its hue at lightness 0.70 to 0.85.`;
    case 'accent-grey':
      return `The accent is nearly grey (chroma ${at(accent?.chroma ?? 0)}): give it the colour of the scene's signature thing, chroma 0.10 or more.`;
    case 'accent-like-surface':
      return "The accent is the surface's own colour at nearly its lightness: take the scene's second colour, about 50 degrees or more round the wheel from the surface, or the surface's hue far brighter.";
    case 'glow-dim':
      return `The glow is too dark to look lit (lightness ${at(glow?.lightness ?? 0)}): use lightness 0.70 to 0.92.`;
    case 'glow-warning':
      return 'The glow is a red, an orange or an amber, which FluidEQ keeps for off and waiting and so never shows: take a third colour of the scene, or a pale light of it - moonlight, mist, a cream spark - clear of those.';
    case 'glow-like-accent':
      return "The glow is the accent's colour again: take a third colour of the scene, at least 50 degrees round the wheel from the accent.";
    default:
      return '';
  }
};

const nameOf = (colours: ISceneWindowColours) =>
  `surface ${colours.surface}, accent ${colours.accent}, glow ${colours.glow}`;

/** What is wrong with one set at its hour, as sentences; [] when nothing. */
const setLines = (
  label: string,
  colours: ISceneWindowColours,
  daylight: number,
): string[] => {
  const faults = windowColourFaults(colours, daylight);
  return faults.length === 0
    ? []
    : [
        `${label} (${nameOf(colours)}):`,
        ...faults.map((fault) => faultLine(fault, colours)),
      ];
};

/** How the check names a point, in the words of `windowColourStops`. */
const STOP_LABEL: Record<TSceneWindowColourStop, string> = {
  '0': 'windowColourStops "0", the night',
  '25': 'windowColourStops "25"',
  '50': 'windowColourStops "50"',
  '75': 'windowColourStops "75"',
  '100': 'windowColourStops "100", the day on a white window',
};

/**
 * The Window colours check for the sets the scene names at its five hours
 * (`windowColourStops`, the two-point `windowColours` and `windowColoursDay`
 * folded in as the 0 and 100 points by the pack's reader), and for the blend
 * between them, which the window wears at every hour in between.
 */
const windowColourLines = (
  stops: ISceneWindowColourStops | undefined,
): string[] => {
  const named = SCENE_WINDOW_COLOUR_STOPS.filter(
    (stop) => stops?.[stop] !== undefined,
  );
  if (!stops || named.length === 0) {
    return [
      'Window colours check: MISSING. pack.json names no windowColourStops (the scene\'s hours "0" night to "100" day), so FluidEQ works them out from the picture by a fixed rule. Choose them from what you see at each hour (the fluideq-finish skill says how), save, and look again.',
    ];
  }
  const problems = named.flatMap((stop) => {
    const colours = stops[stop];
    return colours ? setLines(STOP_LABEL[stop], colours, Number(stop)) : [];
  });
  const crossing =
    named.length > 1 ? windowColourFaultsThroughDay(stops) : undefined;
  if (crossing && problems.length === 0) {
    problems.push(
      `Between the hours named, at Daylight ${crossing.daylight}, the blend the window wears fails: ${crossing.faults.join(', ')}. Each set is fine alone, so they turn through each other: keep the accent on its side of the wheel and the glow on its own at every hour, rather than trading hues through the day.`,
    );
  }
  // An end not named is worked out by the app, which is allowed: said, so
  // the AI names it when the scene's hour changes its colours.
  let missing = '';
  if (!stops['0']) {
    missing =
      ' The night ("0") is not named: FluidEQ works it out from the picture at Daylight 0.';
  } else if (!stops['100']) {
    missing =
      ' The day ("100") is not named: FluidEQ works it out from the picture at Daylight 100; name it if the scene by day has colours of its own.';
  }
  if (problems.length === 0) {
    const shown = named
      .map((stop) => {
        const colours = stops[stop];
        return colours ? `"${stop}" ${nameOf(colours)}` : '';
      })
      .join('; ');
    return [`Window colours check: PASSES (${shown}).${missing}`];
  }
  return [
    [
      'Window colours check: NOT YET.',
      ...problems,
      "Fix them in pack.json from the scene's own colours and look again. Do not tell the member the scene is finished until this passes.",
    ].join(' ') + missing,
  ];
};

export default windowColourLines;
