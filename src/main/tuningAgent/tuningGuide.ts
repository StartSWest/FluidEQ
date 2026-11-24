/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Perceptual tuning playbook and DSP-stage parameter reference exposed via the
 * `get_tuning_guide` MCP tool.
 *
 * Bridges subjective listener goals ("clearer vocals", "remove mud", "small
 * monitor speakers", "punchier bass", "late night") to FluidEQ's concrete EQ
 * frequencies, DSP stages, safe step sizes, and pitfalls to avoid.
 */

import { DSP_DEFAULTS, RANGES } from '../../common/dsp/chainDefaults';
import { DSP_STAGE_NAMES, TDspStageName, isDspStageName } from './tuningSafety';

export const TUNING_GOAL_IDS = [
  'vocal_clarity',
  'warm_relaxed',
  'punchy_bass',
  'airy_detail',
  'remove_mud',
  'tame_harshness',
  'wide_soundstage',
  'small_speakers',
  'late_night',
  'gaming_footsteps',
  'movies_dialogue',
  'podcast_mic',
] as const;

export type TTuningGoalId = (typeof TUNING_GOAL_IDS)[number];

interface ITuningRecipe {
  goal: TTuningGoalId;
  listenerCues: string;
  eqMoves: string[];
  dspStages: string[];
  avoid: string[];
}

const RECIPES: Readonly<Record<TTuningGoalId, ITuningRecipe>> = {
  vocal_clarity: {
    goal: 'vocal_clarity',
    listenerCues:
      'Vocals sound distant, muffled, buried under bass/guitars, or hard to understand.',
    eqMoves: [
      'Gentle cut -1.5 to -3 dB around 220-350 Hz (Q 1.0-1.4) if low-mids mask chest resonance.',
      'Broad lift +1.5 to +3 dB around 2.5-3.5 kHz (Q 0.9-1.2) for vocal presence & intelligibility.',
      'Optional +1 to +2 dB high shelf at 8-10 kHz for breath and articulation (watch sibilance).',
    ],
    dspStages: [
      'Enable deEsser (mode="spectral") if sibilance rises around 5.5-8.5 kHz.',
      'Avoid heavy room wetness when clarity is the top priority.',
    ],
    avoid: [
      'Boosting > +4 dB at 2.5-4 kHz (causes ear fatigue and nasal shout).',
    ],
  },
  warm_relaxed: {
    goal: 'warm_relaxed',
    listenerCues:
      'Sound feels thin, clinical, fatiguing, bright, or lacks musical body.',
    eqMoves: [
      'Warm low shelf +1.5 to +3 dB at 100-140 Hz (Q 0.7).',
      'Gentle dip -1.5 to -2.5 dB at 3-5 kHz (Q 1.0) to relax upper-mid edge.',
      'Soft high shelf -1 to -2 dB above 8-10 kHz if treble still stings.',
    ],
    dspStages: [
      'Optional mild exciter (low mix 0.08-0.15, low drive 1.2-1.6) or warm voicing profile.',
    ],
    avoid: ['Over-boosting 250-400 Hz (+3 dB+ turns warmth into boxiness).'],
  },
  punchy_bass: {
    goal: 'punchy_bass',
    listenerCues:
      'Kick drums and bass lines feel weak, flat, slow, or lack impact.',
    eqMoves: [
      'Tight peak +1.5 to +3 dB around 55-85 Hz (Q 1.0-1.2) for kick weight.',
      'Subtle cut -1 to -2 dB around 220-300 Hz (Q 1.2) so kick separates cleanly from mud.',
      'Optional +1.5 to +2.5 dB low shelf at 45-60 Hz for headphones/subwoofers capable of sub-bass.',
    ],
    dspStages: [
      'Use bassPunch (enabled=true, modest transient boost) for tight kick snap without blooming sustain.',
      'Keep Auto Normalize on so low-end boosts never clip.',
    ],
    avoid: [
      'Boosting 30-50 Hz on tiny laptop or monitor speakers (adds distortion, no audible sub).',
    ],
  },
  airy_detail: {
    goal: 'airy_detail',
    listenerCues:
      'Sound feels veiled, dark, dull, or lacking sparkle and micro-detail.',
    eqMoves: [
      'Gentle high shelf +1.5 to +3 dB at 8-12 kHz (Q 0.7).',
      'Small +1 to +2 dB lift around 4.5-6 kHz (Q 1.2) only if presence is recessed.',
    ],
    dspStages: [
      'Verify measure_live_audio deEsser.sibilanceDb after boosting; enable deEsser if 6-8 kHz turns sharp.',
    ],
    avoid: [
      'Boosting 6-8 kHz aggressively on sibilant pop/vocal tracks or bright headphones.',
    ],
  },
  remove_mud: {
    goal: 'remove_mud',
    listenerCues: 'Bloated, boxy, congested, boomy, or hollow midrange.',
    eqMoves: [
      'Cut -2 to -4 dB around 180-350 Hz (Q 1.0-1.5) targeting the specific elevated ISO bands in measure_live_audio.',
      'Check 80-125 Hz for boominess (-1.5 to -2.5 dB if bass deviation is strongly positive).',
    ],
    dspStages: [
      'Check if a bassy voicing/preset or Room stage is adding low-mid resonance before stacking cuts.',
    ],
    avoid: ['Cutting too wide below 150 Hz and making the mix sound thin.'],
  },
  tame_harshness: {
    goal: 'tame_harshness',
    listenerCues: 'Piercing guitars/vocals, sharp S/T sibilance, ear fatigue.',
    eqMoves: [
      'Targeted cut -2 to -4 dB at 2.5-4 kHz (Q 1.5-2.5) for shout/glare.',
      'Targeted cut -2 to -3.5 dB around 6-8 kHz (Q 2.0-3.0) for sibilance/cymbal splash.',
    ],
    dspStages: [
      'Enable deEsser (enabled=true, mode="spectral") locked around the frequencyHz reported by measure_live_audio.',
    ],
    avoid: [
      'Cutting everything above 2 kHz broadly when only a narrow spike hurts.',
    ],
  },
  wide_soundstage: {
    goal: 'wide_soundstage',
    listenerCues: 'Sound feels cramped inside the head or overly narrow.',
    eqMoves: [
      'Subtle +1 to +1.5 dB air shelf at 10-12 kHz increases perceived openness.',
    ],
    dspStages: [
      'Enable dimension stage with conservative width (keep correlation >= 0.35 in measure_live_audio).',
      'On headphones ONLY, Room stage can add natural out-of-head acoustic space.',
    ],
    avoid: [
      'Enabling virtual Room on loudspeakers (double-room echo).',
      'Pushing stereo width until correlation drops negative (phase cancellation).',
    ],
  },
  small_speakers: {
    goal: 'small_speakers',
    listenerCues:
      'Built-in monitor speakers (e.g. HDMI display), laptop speakers, or small desktop speakers.',
    eqMoves: [
      'Apply high-pass eqCuts.low=12 or HPQ around 70-100 Hz so tiny cones do not distort on inaudible sub-bass.',
      'Cut boxy plastic cabinet resonance -2 to -4 dB around 300-600 Hz (Q 1.2-1.8).',
      'Gentle presence lift +1.5 to +2.5 dB around 2.5-4 kHz for clarity.',
    ],
    dspStages: [
      'Use bassForge (psychoacoustic upper-bass harmonics) to create perceived bass without overloading small drivers.',
      'Turn OFF headphone Room simulation on speakers.',
    ],
    avoid: [
      'Heavy 25-60 Hz boosts or virtual headphone Room on monitor speakers.',
    ],
  },
  late_night: {
    goal: 'late_night',
    listenerCues:
      'Quiet listening where whispers disappear and explosions/choruses are too loud.',
    eqMoves: [
      'Gentle Fletcher-Munson contour: +2 dB low shelf at 80 Hz and +1.5 dB high shelf at 10 kHz at low playback volume.',
    ],
    dspStages: [
      'Use dynamics stage or late-night DSP preset to narrow dynamic range gently.',
      'Keep maximizer/master ceiling <= -1.0 dBTP.',
    ],
    avoid: [
      'Crushing loud modern pop (crestFactorDb < 8 dB) with heavy compression.',
    ],
  },
  gaming_footsteps: {
    goal: 'gaming_footsteps',
    listenerCues:
      'Competitive FPS footsteps, directional cues, dialogue clarity, explosion taming.',
    eqMoves: [
      'Trim masking bass (-1.5 to -2.5 dB around 80-200 Hz) if explosions bury steps.',
      'Modest lift +1.5 to +2.5 dB around 2-4 kHz and 6-8 kHz for footstep transients.',
    ],
    dspStages: [
      'Set gameMode=true on DSP rack for minimum latency.',
      'Enable footsteps stage (lift, calm for rumble/shots, environment bed control, dialogue).',
      'Disable virtual Room if the game has its own 3D HRTF audio.',
    ],
    avoid: [
      'High-latency non-gameMode processing or double-HRTF with Room on.',
    ],
  },
  movies_dialogue: {
    goal: 'movies_dialogue',
    listenerCues: 'Movie/TV speech hard to hear over score and sound effects.',
    eqMoves: [
      'Cut -1.5 to -2.5 dB at 200-320 Hz; lift +2 to +3 dB at 1.5-3.5 kHz (Q 1.0).',
    ],
    dspStages: [
      'Use dynamics or vocal/cinema DSP preset; mild deEsser if speech turns sharp.',
    ],
    avoid: ['Over-widening stereo (pulls center-channel dialogue apart).'],
  },
  podcast_mic: {
    goal: 'podcast_mic',
    listenerCues:
      'Cleaner, fuller voice on calls, streaming, or podcast recording.',
    eqMoves: [
      'Use configure_mic_rack (never main output EQ) for microphone capture.',
    ],
    dspStages: [
      'Start from mic profile "stream", "podcast", or "chat", then tune voice.lowCutHz (70-100 Hz), proximityDb, deplosive, denoise, and deEsser.',
    ],
    avoid: ['Aggressive gate range (> 12 dB) that chops soft word starts.'],
  },
};

const STAGE_NOTES: Readonly<Record<TDspStageName, string>> = {
  normalizer:
    'Live loudness/peak leveling. Modes: off, peak, loudness. Keep truePeakDbtp <= -1 dBTP.',
  denoise: 'Noise reduction for hiss, mains hum, clicks, and voice cleaning.',
  deEsser:
    'Dynamic sibilance control (mode: spectral|treble|whole). Match frequency range to measure_live_audio deEsser.frequencyHz.',
  exciter:
    'Harmonic warmth/sparkle generator (drive 1..3.5, mix 0..1, texture 0..0.7). Keep mix low (0.05..0.25) to avoid hash.',
  eq: 'Rack-internal parametric/dynamic EQ (separate from main EQ). Use main EQ for broad listener tone; use rack EQ for dynamic/supporting moves.',
  bassForge:
    'Psychoacoustic bass harmonic generator — ideal for small speakers or light headphones that lack physical sub-bass.',
  bassPunch:
    'Low-frequency transient/sustain shaper — tightens kick impact or controls boomy bass decay.',
  dynamics:
    '3-band multiband compressor/expander for leveling, punch, or late-night dynamic control.',
  footsteps:
    'Game stage: transient footstep lift (300 Hz / 2.4 kHz / 7 kHz), rumble calm, environment bed control, and dialogue clarity.',
  dimension:
    'Stereo width & spatial enhancer. Keep correlation positive in measure_live_audio.',
  room: 'Virtual listening room acoustics — great on headphones, turn OFF on loudspeakers.',
  surround:
    'Surround / multi-channel balance and fold-down stage for 5.1/7.1 endpoints.',
  maximizer:
    'True-peak look-ahead limiter and loudness maximizer (AI ceiling clamped <= -0.3 dBTP).',
  master:
    'Final master output trim (AI clamped <= 0 dB), ceiling (<= -0.3 dBTP), and mono/polarity checks.',
};

export const buildTuningGuide = (args: { goal?: string; stage?: string }) => {
  const goalKey = args.goal?.trim().toLowerCase();
  const stageKey = args.stage?.trim();

  let goals: ITuningRecipe[] = Object.values(RECIPES);
  if (goalKey && goalKey !== 'all') {
    goals = TUNING_GOAL_IDS.includes(goalKey as TTuningGoalId)
      ? [RECIPES[goalKey as TTuningGoalId]]
      : [];
  }

  const stagePrefix = stageKey?.toLowerCase();
  const filteredRanges = stagePrefix
    ? Object.fromEntries(
        Object.entries(RANGES).filter(([key]) =>
          key.toLowerCase().includes(stagePrefix),
        ),
      )
    : undefined;

  const stageInfo =
    stageKey && isDspStageName(stageKey)
      ? {
          stage: stageKey,
          purpose: STAGE_NOTES[stageKey],
          defaults: DSP_DEFAULTS[stageKey],
          ...(filteredRanges && Object.keys(filteredRanges).length > 0
            ? { ranges: filteredRanges }
            : {}),
        }
      : undefined;

  return {
    workflow: [
      '1. Call get_audio_context to inspect nowPlaying (track/artist/app), output device type, active effectiveCurve across all layers, and DSP rack.',
      '2. Call measure_live_audio to read 15-band ISO spectrum, FluidEQ reference-curve deviations, crestFactorDb, and automatic acoustic observations.',
      '3. Start with small, surgical changes (1.5-3 dB EQ steps or subtle DSP mix) and never double-boost on top of an already-boosted layer in effectiveCurve.',
      '4. Call measure_live_audio again to inspect deltaFromPrevious and verify clippingRisk=false.',
      '5. Offer tuning_session(action="ab_compare") so the listener judges Original vs Tuned by ear and refines.',
    ],
    availableGoals: TUNING_GOAL_IDS,
    availableStages: DSP_STAGE_NAMES,
    ...(goals.length > 0 ? { recipes: goals } : {}),
    ...(stageInfo ? { stageDetail: stageInfo } : {}),
  };
};
