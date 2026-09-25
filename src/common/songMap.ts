/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A song as a whole, from what FluidEQ heard of it moment by moment
 * (`songJournal.ts`): where it is calm and where it is strong, how it builds
 * into its big moments, where the voice sings and the drums play, its tempo
 * - for the member's AI, which never hears the music it designs a scene for
 * (Ivan, 2026-09-24: "so the agent can feel the full intention of the song
 * and build visualizers that make humans feel too").
 *
 * Pure: moments in, a map out, and the words the AI reads - in the uniforms'
 * own names, so what it reads is what its scene will be handed.
 */

/** What the music was doing over one JOURNAL_STEP_MS of it. */
export interface ISongMoment {
  /** Seconds into the song. */
  t: number;
  /** How loud it was, in dB: absolute, where every reading below is relative. */
  loudness: number;
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** uSong.x and uSong.y: how intense against the rest of the song, and building. */
  intensity: number;
  build: number;
  tempo: number;
  confidence: number;
  /** Drum hits, and drops landing, in this moment. */
  kicks: number;
  snares: number;
  hats: number;
  drops: number;
  /** uVoice.z, uVoice.x and uVoice.y: how sure a voice sings, the mouth, the note. */
  voice: number;
  open: number;
  pitch: number;
}

/** How often a moment is kept: ten a second. */
export const JOURNAL_STEP_MS = 100;

/** One second of the song. */
export interface ISongSecond {
  t: number;
  /**
   * How strong it is against the whole song, 0..1, judged afterwards from
   * its loudness. uSong.x can only judge against what came before it, so
   * every song's intro read as its most intense part; this knows how the
   * song goes on.
   */
  strength: number;
  intensity: number;
  level: number;
  bass: number;
  mid: number;
  treble: number;
  voice: number;
  /** The note sung, where a voice sang in this second. */
  pitch?: number;
  kicks: number;
  snares: number;
  hats: number;
  build: number;
  drop: boolean;
}

export const SONG_ENERGIES = [
  'calm',
  'gentle',
  'moderate',
  'strong',
  'peak',
] as const;

/** A stretch of the song that holds together. */
export interface ISongSection {
  from: number;
  to: number;
  /** Its strength in words. */
  energy: (typeof SONG_ENERGIES)[number];
  strength: number;
  intensity: number;
  level: number;
  /** The share of its seconds a voice sings in. */
  voice: number;
  /** The mean note sung, where a voice sang. */
  pitch?: number;
  /** Drum hits a second. */
  kicks: number;
  snares: number;
  hats: number;
  bass: number;
  mid: number;
  treble: number;
  /** How much more intense its last third is than its first: rising, or fading. */
  rise: number;
  /** Whether its last stretch builds, towards whatever follows it. */
  builds: boolean;
}

export interface ISongMap {
  /** How far into the song FluidEQ heard, in seconds. */
  seconds: number;
  /** The tempo the beat clock settled on, 0 when it never did, and how sure it was. */
  tempo: number;
  steadiness: number;
  sections: ISongSection[];
  /** When each drop landed, in seconds. */
  drops: number[];
  /** The middle of the song's strongest stretch. */
  peakAt: number;
  /** Where a voice first sings for more than a moment. */
  voiceFrom?: number;
  /** Seconds in which a voice sang. */
  voicedSeconds: number;
  /** The sung notes' range, on uVoice.y's scale. */
  voiceLow?: number;
  voiceHigh?: number;
  /** One line a second: the moment-by-moment arc, for a close reading. */
  perSecond: ISongSecond[];
}

/** A section is at least this long, and a change has to last this long to start one. */
const SECTION_MIN_S = 6;
/**
 * How far the next SECTION_MIN_S seconds' make-up has to stand from the
 * section so far to begin a new one, as a root mean square over its four
 * parts, each 0..1: a verse to its chorus moves about 0.3, one bar of a verse
 * to the next under 0.1.
 */
const SECTION_CHANGE = 0.22;
/**
 * A stretch longer than this is split again where it changes most, if it
 * changes at least SPLIT_CHANGE there: a song that keeps one groove through
 * its verses and choruses (September) came out as one three-minute section,
 * and a truly steady one still does.
 */
const SECTION_MOST_S = 40;
const SPLIT_CHANGE = 0.1;
/**
 * How sure the voice reading has to be, over a second, for the second to
 * count as sung. Lower than a moment's: a sung phrase breathes, and on real
 * songs a verse's seconds read 0.3 to 0.7 while an intro's guitar reads under
 * 0.1 (Rolling in the Deep).
 */
const SUNG = 0.3;
/** How sure it has to be for a moment's note to be believed. */
const NOTE_SURE = 0.5;
/**
 * The stretch at a section's end that says whether it builds into what
 * follows: its last quarter, at least this long. Across a whole section a
 * pop song reads as building a second or two in every ten; a pre-chorus
 * builds through most of its end.
 */
const BUILD_TAIL_S = 3;
/** The share of that stretch that has to be building. */
const BUILDS = 0.5;
/** How sure the beat clock has to be for its tempo to count. */
const TEMPO_SURE = 0.5;
/**
 * A song's range, for its strength: from its quieter seconds to its loudest,
 * and never narrower than this - one that hardly changes is neither weak nor
 * strong against itself (`rhythmSection.ts`'s MIN_RANGE_DB).
 */
const LEAST_RANGE_DB = 8;
/** Quieter than this a second is silence, and says nothing of the song's range. */
const SILENT_DB = -80;
/** The strongest stretch is this many seconds either side of its middle. */
const PEAK_REACH_S = 4;

/** The value at `share` of the way up `sorted`. */
const quantile = (sorted: readonly number[], share: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];

const mean = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0) /
  Math.max(1, values.length);

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

const toPower = (db: number) => 10 ** (db / 10);
const toDb = (power: number) => 10 * Math.log10(Math.max(1e-10, power));

type TLoudSecond = ISongSecond & { loudness: number };

/**
 * The moments as seconds: each the mean of its moments, hits summed, its
 * loudness a mean of power, its strength left for the song's range.
 */
const bySecond = (moments: readonly ISongMoment[]): TLoudSecond[] => {
  const seconds: TLoudSecond[] = [];
  let at = 0;
  while (at < moments.length) {
    const second = Math.floor(moments[at].t);
    const run: ISongMoment[] = [];
    while (at < moments.length && Math.floor(moments[at].t) === second) {
      run.push(moments[at]);
      at += 1;
    }
    const of = (key: keyof ISongMoment) =>
      mean(run.map((moment) => moment[key]));
    const count = (key: 'kicks' | 'snares' | 'hats' | 'drops') =>
      sum(run.map((moment) => moment[key]));
    const sung = run.filter((moment) => moment.voice > NOTE_SURE);
    seconds.push({
      t: second,
      loudness: toDb(mean(run.map((moment) => toPower(moment.loudness)))),
      strength: 0,
      intensity: of('intensity'),
      level: of('level'),
      bass: of('bass'),
      mid: of('mid'),
      treble: of('treble'),
      voice: of('voice'),
      ...(sung.length > 0
        ? { pitch: mean(sung.map((moment) => moment.pitch)) }
        : {}),
      kicks: count('kicks'),
      snares: count('snares'),
      hats: count('hats'),
      build: Math.max(...run.map((moment) => moment.build)),
      drop: count('drops') > 0,
    });
  }
  return seconds;
};

/** What makes a second what it is: how intense, sung, drummed and bright. */
const makeUp = (second: ISongSecond) => [
  second.intensity,
  second.voice,
  Math.min(1, (second.kicks + second.snares) / 4),
  Math.min(1, second.hats / 6),
];

const middleOf = (seconds: readonly ISongSecond[]) => {
  const parts = seconds.map(makeUp);
  return parts[0].map((_, key) => mean(parts.map((values) => values[key])));
};

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.sqrt(
    a.reduce((total, value, at) => total + (value - b[at]) ** 2, 0) / a.length,
  );

/** How much the SECTION_MIN_S seconds either side of `at` differ. */
const changeAt = (seconds: readonly ISongSecond[], at: number) =>
  distance(
    middleOf(seconds.slice(at - SECTION_MIN_S, at)),
    middleOf(seconds.slice(at, at + SECTION_MIN_S)),
  );

/** A long stretch, split where it changes most, again and again. */
const splitLong = (
  seconds: readonly ISongSecond[],
  [from, to]: [number, number],
): [number, number][] => {
  if (to - from <= SECTION_MOST_S) {
    return [[from, to]];
  }
  let best = -1;
  let most = SPLIT_CHANGE;
  for (let at = from + SECTION_MIN_S; at + SECTION_MIN_S <= to; at += 1) {
    const change = changeAt(seconds, at);
    if (change > most) {
      most = change;
      best = at;
    }
  }
  return best < 0
    ? [[from, to]]
    : [...splitLong(seconds, [from, best]), ...splitLong(seconds, [best, to])];
};

/**
 * The seconds split where their make-up changes and stays changed: a new
 * section where the next SECTION_MIN_S seconds stand SECTION_CHANGE from the
 * section so far, once that has lasted SECTION_MIN_S itself.
 */
const sectionsOf = (seconds: readonly ISongSecond[]): [number, number][] => {
  const cuts: [number, number][] = [];
  let from = 0;
  let at = SECTION_MIN_S;
  while (at + SECTION_MIN_S <= seconds.length) {
    const sofar = middleOf(seconds.slice(from, at));
    const ahead = middleOf(seconds.slice(at, at + SECTION_MIN_S));
    if (distance(sofar, ahead) > SECTION_CHANGE) {
      cuts.push([from, at]);
      from = at;
      at += SECTION_MIN_S;
    } else {
      at += 1;
    }
  }
  if (from < seconds.length) {
    cuts.push([from, seconds.length]);
  }
  return cuts.flatMap((span) => splitLong(seconds, span));
};

/** A section's strength in words. */
const energyOf = (strength: number): ISongSection['energy'] => {
  if (strength < 0.2) {
    return 'calm';
  }
  if (strength < 0.4) {
    return 'gentle';
  }
  if (strength < 0.62) {
    return 'moderate';
  }
  if (strength < 0.82) {
    return 'strong';
  }
  return 'peak';
};

/**
 * Each second's strength: its loudness placed in the song's own range, from
 * its quieter tenth of seconds to its loudest twentieth.
 */
const strengthen = (seconds: TLoudSecond[]) => {
  const heard = seconds
    .map((second) => second.loudness)
    .filter((db) => db > SILENT_DB)
    .sort((a, b) => a - b);
  if (heard.length === 0) {
    return;
  }
  let low = quantile(heard, 0.1);
  let high = quantile(heard, 0.95);
  if (high - low < LEAST_RANGE_DB) {
    const middle = (low + high) / 2;
    low = middle - LEAST_RANGE_DB / 2;
    high = middle + LEAST_RANGE_DB / 2;
  }
  seconds.forEach((second) => {
    second.strength = Math.max(
      0,
      Math.min(1, (second.loudness - low) / (high - low)),
    );
  });
};

const sectionOf = (part: readonly ISongSecond[]): ISongSection => {
  const { length } = part;
  const sung = part.filter((second) => second.voice > SUNG);
  const pitches = sung.flatMap((second) =>
    second.pitch === undefined ? [] : [second.pitch],
  );
  const third = Math.max(1, Math.floor(length / 3));
  const tail = part.slice(-Math.max(BUILD_TAIL_S, Math.ceil(length / 4)));
  const strength = mean(part.map((second) => second.strength));
  return {
    from: part[0].t,
    to: part[length - 1].t + 1,
    energy: energyOf(strength),
    strength,
    intensity: mean(part.map((second) => second.intensity)),
    level: mean(part.map((second) => second.level)),
    voice: sung.length / length,
    ...(pitches.length > 0 ? { pitch: mean(pitches) } : {}),
    kicks: sum(part.map((second) => second.kicks)) / length,
    snares: sum(part.map((second) => second.snares)) / length,
    hats: sum(part.map((second) => second.hats)) / length,
    bass: mean(part.map((second) => second.bass)),
    mid: mean(part.map((second) => second.mid)),
    treble: mean(part.map((second) => second.treble)),
    rise:
      mean(part.slice(-third).map((second) => second.strength)) -
      mean(part.slice(0, third).map((second) => second.strength)),
    builds:
      tail.filter((second) => second.build > 0.5).length / tail.length >=
      BUILDS,
  };
};

/** The whole song's map from its moments, oldest first. */
export const mapSong = (moments: readonly ISongMoment[]): ISongMap => {
  const loud = bySecond(moments);
  strengthen(loud);
  const seconds = loud.map(({ loudness, ...second }): ISongSecond => second);
  const spans = sectionsOf(seconds);
  const tempos = moments
    .filter((moment) => moment.confidence > TEMPO_SURE && moment.tempo > 0)
    .map((moment) => moment.tempo)
    .sort((a, b) => a - b);
  const pitches = moments
    .filter((moment) => moment.voice > NOTE_SURE)
    .map((moment) => moment.pitch)
    .sort((a, b) => a - b);
  // A second or two that reads as sung is as often an instrument as a voice:
  // the voice comes in where two seconds running are sung.
  const voiceFrom = seconds.find(
    (second, at) => second.voice > SUNG && (seconds[at + 1]?.voice ?? 0) > SUNG,
  )?.t;
  // Its strongest stretch: the loudest nine seconds, by loudness itself,
  // because strength is 1 all through a song's loudest twentieth and a tie
  // went to the first of them - one hit of a string stab in Toxic's intro.
  const stretch = (at: number) =>
    toDb(
      mean(
        loud
          .slice(Math.max(0, at - PEAK_REACH_S), at + PEAK_REACH_S + 1)
          .map((second) => toPower(second.loudness)),
      ),
    );
  const peak = seconds.reduce(
    (best, _, at) => (stretch(at) > stretch(best) ? at : best),
    0,
  );
  const last = moments[moments.length - 1];
  return {
    seconds: last ? last.t + JOURNAL_STEP_MS / 1_000 : 0,
    tempo: tempos.length > 0 ? quantile(tempos, 0.5) : 0,
    steadiness: mean(moments.map((moment) => moment.confidence)),
    sections: spans.map(([from, to]) => sectionOf(seconds.slice(from, to))),
    drops: seconds.filter((second) => second.drop).map((second) => second.t),
    peakAt: seconds[peak]?.t ?? 0,
    ...(voiceFrom === undefined ? {} : { voiceFrom }),
    voicedSeconds: seconds.filter((second) => second.voice > SUNG).length,
    ...(pitches.length > 0
      ? { voiceLow: quantile(pitches, 0.1), voiceHigh: quantile(pitches, 0.9) }
      : {}),
    perSecond: seconds,
  };
};

/** Seconds as m:ss. */
export const songClock = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const two = (value: number) => value.toFixed(2);

/** How far a section's intensity has to move across it to be told. */
const TREND = 0.12;

const trendOf = (section: ISongSection) => {
  if (section.rise > TREND) {
    return ', rising';
  }
  return section.rise < -TREND ? ', fading' : '';
};

/** The drums of a section, in words. */
const drumsOf = (section: ISongSection) => {
  const parts = [
    section.kicks >= 0.5 ? `kick ${section.kicks.toFixed(1)}/s` : '',
    section.snares >= 0.3 ? `snare ${section.snares.toFixed(1)}/s` : '',
    section.hats >= 0.8 ? `hats ${section.hats.toFixed(1)}/s` : '',
  ].filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(', ') : 'no drums';
};

const voiceOf = (section: ISongSection) => {
  if (section.voice > 0.5) {
    return section.pitch === undefined
      ? 'singing'
      : `singing around uVoice.y ${two(section.pitch)}`;
  }
  return section.voice > 0.15 ? 'some singing' : 'no voice';
};

const tempoLine = (map: ISongMap) => {
  if (map.tempo <= 0) {
    return 'No steady beat: uRhythm.w stays low, so a dance should rest on uTime and uLevel here.';
  }
  let clock = 'unsure';
  if (map.steadiness > 0.6) {
    clock = 'steady';
  } else if (map.steadiness > 0.35) {
    clock = 'mostly steady';
  }
  return `Tempo ${Math.round(map.tempo)} BPM (uRhythm.z), the beat clock ${clock} (uRhythm.w averaged ${two(map.steadiness)}).`;
};

const voiceLine = (map: ISongMap) => {
  if (map.voiceFrom !== undefined) {
    const range =
      map.voiceLow === undefined || map.voiceHigh === undefined
        ? ''
        : `, its notes between uVoice.y ${two(map.voiceLow)} and ${two(map.voiceHigh)}`;
    return `FluidEQ hears singing from ${songClock(map.voiceFrom)} on, in ${map.voicedSeconds} seconds of it (uVoice.z high there)${range}. A lead instrument playing a sung line can read as a voice too.`;
  }
  return map.voicedSeconds > 0
    ? `Only a moment here and there reads as sung (${map.voicedSeconds} seconds), which is as likely a lead instrument: treat it as instrumental.`
    : 'No voice: uVoice.z stays low, so it is instrumental as far as FluidEQ can tell.';
};

/**
 * The map in words, for the member's AI: the song's shape first, section by
 * section, then the numbers a second at a time.
 */
export const describeSongMap = (map: ISongMap) => {
  const heard = map.perSecond.length;
  const missing = Math.max(0, Math.round(map.seconds) - heard);
  return [
    tempoLine(map),
    voiceLine(map),
    map.drops.length > 0
      ? `Drops land at ${map.drops.map(songClock).join(', ')} (uSong.z jumps to 1 and falls away).`
      : 'No drop was heard.',
    `The strongest stretch is around ${songClock(map.peakAt)}.`,
    '',
    "THE ARC, section by section. Each part's strength is against the whole song, judged afterwards from how loud it is (0 its quietest stretch, 1 its loudest); uSong.x is what a scene is handed as it plays, which can only judge against what came before, so it runs high early in a song.",
    ...map.sections.map(
      (section) =>
        `- ${songClock(section.from)}-${songClock(section.to)}: ${section.energy} (${two(section.strength)})${trendOf(section)}${section.builds ? ', BUILDING into what follows' : ''}; ${voiceOf(section)}; ${drumsOf(section)}; uSong.x ${two(section.intensity)}, uLevel ${two(section.level)}, uBands (${two(section.bass)}, ${two(section.mid)}, ${two(section.treble)}).`,
    ),
    '',
    `SECOND BY SECOND (time: strength, uSong.x, uLevel, uBands bass/mid/treble, uVoice.z, then kick/snare/hat hits heard, and "build" or "DROP" where they happen)${missing > 0 ? `. FluidEQ could not listen for about ${songClock(missing)} of it: those seconds are missing` : ''}:`,
    ...map.perSecond.map(
      (second) =>
        `${songClock(second.t)} ${two(second.strength)} ${two(second.intensity)} ${two(second.level)} ${two(second.bass)}/${two(second.mid)}/${two(second.treble)} v${two(second.voice)} ${second.kicks}/${second.snares}/${second.hats}${second.build > 0.5 ? ' build' : ''}${second.drop ? ' DROP' : ''}`,
    ),
  ].join('\n');
};
