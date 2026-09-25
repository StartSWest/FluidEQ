/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every shipped DSP recipe over real music, through the native host.
 *
 * A catalogue can be numerically valid and still be unusable: several stages
 * can each add safe gain and leave their sum pinned to the final limiter, or a
 * cleanup recipe can remove enough clean programme to sound watery. These are
 * whole-chain failures, so this renders whole chains and measures their result.
 * It cannot decide whether a tonal choice is tasteful; that final judgement is
 * still a listening test in the real window.
 */
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { DSP_DEFAULTS, IDspSettings } from '../../src/common/dsp/chain';
import { encodeChainSettings } from '../../src/common/dsp/chainWire';
import { filterPresetCases } from './dsp-preset-cases';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import { writeProgrammeFixture } from './programme-fixture';
import {
  IAudio,
  bassCorrelation,
  fairStereo,
  heardLevel,
  readFloatWav,
  settleFrames,
  songSecondsFor,
  withCurve,
  writeFloatWav,
} from './preset-hearing';

interface IMetrics {
  finite: boolean;
  peak: number;
  rms: number;
  dc: number;
  nearCeilingFraction: number;
  crestDb: number;
}

/**
 * What the Library hands a chain whose Master is bringing a track to a target.
 *
 * Stood in for here because this harness has no analysis of its own; the real
 * figure is whatever the song's own loudness asks for.
 */
const MASTER_MAKEUP_DB = 4;

/** A chain that is deliberately moving the level toward a delivery target. */
const normalisesLoudness = (settings: IDspSettings): boolean =>
  settings.master.enabled &&
  settings.master.loudnessMaximize &&
  !settings.master.matchedBypass;

let failures = 0;
const line = (message: string) => process.stdout.write(`${message}\n`);
const check = (condition: boolean, what: string) => {
  line(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

/** Under this, a source's bass is out of phase between its channels. */
const FAIR_BASS_CORRELATION = -0.3;
/**
 * Where in the song a fair programme is built from, and how much of it: the
 * renders below read two seconds from twelve in, so twenty is room enough.
 */
const PROGRAMME_START_SECONDS = 30;
const PROGRAMME_SECONDS = 20;

/** Ignore filter warm-up, then measure both channels as one programme. */
const measure = (audio: IAudio): IMetrics => {
  const skip = settleFrames(audio);
  let finite = true;
  let peak = 0;
  let sum = 0;
  let sumSquared = 0;
  let nearCeiling = 0;
  let count = 0;
  audio.channels.forEach((channel) => {
    for (let at = skip; at < channel.length; at += 1) {
      const sample = channel[at];
      if (!Number.isFinite(sample)) {
        finite = false;
      }
      const absolute = Math.abs(sample);
      peak = Math.max(peak, absolute);
      sum += sample;
      sumSquared += sample * sample;
      nearCeiling += absolute >= 0.999 ? 1 : 0;
      count += 1;
    }
  });
  const rms = Math.sqrt(sumSquared / Math.max(1, count));
  return {
    finite,
    peak,
    rms,
    dc: Math.abs(sum / Math.max(1, count)),
    nearCeilingFraction: nearCeiling / Math.max(1, count),
    crestDb: 20 * Math.log10(Math.max(peak, 1e-12) / Math.max(rms, 1e-12)),
  };
};

/**
 * Whether the rack carries a stage whose job is holding a ceiling.
 *
 * The rack's own final guard held every chain under full scale until it was
 * removed on 2026-09-22 (`chain_transparency_test.cpp`). A chain that ends in
 * the Maximizer, or in a Master bringing the programme to a target, still
 * promises a ceiling; one that ends in nothing is measured and reported, as
 * it would be under Equalizer APO, where the listener's preamp is the room.
 */
const holdsCeiling = (settings: IDspSettings): boolean =>
  settings.maximizer.enabled ||
  (settings.master.enabled && settings.master.loudnessMaximize);

const passesShapeSafety = (metrics: IMetrics, held: boolean): boolean =>
  metrics.finite &&
  (!held ||
    (metrics.peak <= 1.0001 && metrics.nearCeilingFraction < 0.0001)) &&
  metrics.rms > 0.003 &&
  metrics.crestDb > 2 &&
  metrics.dc < 0.02;

const shapeCheckName = (held: boolean): string =>
  held ? 'no clip, silence, DC, or crushing' : 'no silence, DC, or crushing';

const dbRatio = (value: number, reference: number): number =>
  20 * Math.log10(Math.max(value, 1e-12) / Math.max(reference, 1e-12));

const main = async (): Promise<void> => {
  const executablePath = findDspHostExecutable();
  if (!executablePath) {
    throw new Error('preset smoke: no host executable; run pnpm build first');
  }
  // An optional fixture keeps catalogue tuning honest across more than the
  // one song this script originally hard-coded. A full audit runs another
  // pass over a second file by naming it.
  const argumentsAfterScript = process.argv.slice(2);
  const chainsOnly = argumentsAfterScript.includes('--chains-only');
  const synthetic = argumentsAfterScript.includes('--synthetic');
  const fixture = argumentsAfterScript.find(
    (argument) => argument !== '--chains-only' && argument !== '--synthetic',
  );
  if (synthetic && fixture) {
    throw new Error('preset smoke: choose a music fixture or --synthetic');
  }
  const scratch = mkdtempSync(path.join(tmpdir(), 'fluideq-presets-'));
  /**
   * Real music where there is any, and synthesised programme where there is
   * not — never a skipped pass.
   *
   * The song this used to require unconditionally is excluded by `.gitignore`
   * (`/*.MP3`), so on a clean checkout the file cannot exist and this script
   * threw before it reached a single check. The weekly cold build runs
   * `pnpm test` from exactly such a checkout. A named fixture that is absent
   * is still fatal, because that is a typo rather than a cold tree.
   */
  const repositoryFixture = path.resolve(
    __dirname,
    '../..',
    'karaoke_instrumental.mp3',
  );
  let source: string;
  /**
   * Whether the level windows below are being asked about the music they were
   * drawn against.
   *
   * They are not a property of the catalogue on its own. "Within 1.5 dB of DSP
   * Off" was measured over one recording, with that recording's spectrum,
   * loudness and crest factor, and the same profiles move synthesised
   * programme by four or five decibels while being entirely correct — which
   * was confirmed by generating one and watching every boosting chain leave
   * the window from above and every speech chain leave it from below. Widening
   * the bound until both passed would assert nothing; shaping the generator
   * until it agreed would be fitting the evidence to the answer.
   *
   * So they run over real music and are skipped otherwise — and over music
   * whose bass is in phase between its channels (`bassCorrelation`). The
   * instrumental they were first drawn on is the right channel the left
   * turned upside down, and every chain that folds the bass to mono measured
   * a fault of that file, so that song is now rebuilt as fair stereo before
   * it is measured, and a named recording like it is refused. The
   * shape-safety pass, which asks whether a profile renders valid audio at
   * all, runs always — it does not care what it is given, and it is the half
   * a cold build most needs.
   */
  let levelChecks = true;
  if (fixture) {
    source = path.resolve(fixture);
    if (!existsSync(source)) {
      throw new Error(`preset smoke: missing fixture ${source}`);
    }
  } else if (!synthetic && existsSync(repositoryFixture)) {
    source = repositoryFixture;
  } else {
    source = path.join(scratch, 'programme.wav');
    writeProgrammeFixture(source);
    levelChecks = false;
  }
  line(`source: ${source}`);
  const host = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
  });

  const render = async (
    settings: IDspSettings,
    name: string,
    inputGainDb = 0,
  ): Promise<IMetrics> => {
    const target = path.join(scratch, `${name}.wav`);
    check(
      await host.applyChain(encodeChainSettings(settings)),
      `${name}: applies`,
    );
    check(await host.seekDeck(0, 12), `${name}: seeks`);
    check(
      await host.setTrackGains(
        inputGainDb,
        normalisesLoudness(settings) ? MASTER_MAKEUP_DB : 0,
        true,
      ),
      `${name}: gains apply`,
    );
    // Warm the decoder and every stateful stage by processing actual blocks.
    // This waits on completed engine work rather than guessing with a timer.
    check(await host.runOfflineBlocks(96), `${name}: pre-rolls`);
    check(await host.renderToFile(96_000, target), `${name}: renders`);
    return measure(readFloatWav(target));
  };

  try {
    line('preset chains, through the native host');
    check(await host.start(), 'the host starts');
    check(await host.loadDeck(0, source), 'the music fixture loads');
    check(await host.setPlaying(true), 'the transport starts');

    // DSP Off must bypass the root. An enabled empty rack still runs final
    // safety, so its attenuation would make every preset seem louder by the
    // same amount when comparing against that already-limited reference.
    const dryOff = { ...DSP_DEFAULTS, enabled: false };
    let probe = await render(dryOff, 'dry-probe');
    const correlation = bassCorrelation(
      readFloatWav(path.join(scratch, 'dry-probe.wav')),
    );
    if (levelChecks && correlation < FAIR_BASS_CORRELATION) {
      const reason = `the source's bass is out of phase between its channels (correlation ${correlation.toFixed(2)}), and a stage that folds the bass to mono cancels it`;
      if (fixture) {
        throw new Error(`preset smoke: ${reason}; name a fair recording`);
      }
      /**
       * The song at the root is exactly that — its right channel is its left
       * upside down — so the windows run over a fair programme built from it
       * (`fairStereo`) rather than being skipped: the same song, from
       * PROGRAMME_START_SECONDS, with its own later bars for ambience.
       */
      const song = path.join(scratch, 'song.wav');
      check(
        await host.applyChain(encodeChainSettings(dryOff)),
        'the song decodes',
      );
      check(await host.seekDeck(0, PROGRAMME_START_SECONDS), 'the song seeks');
      check(await host.setTrackGains(0, 0, true), 'the song plays at unity');
      check(await host.runOfflineBlocks(16), 'the song pre-rolls');
      check(
        await host.renderToFile(
          Math.round(48_000 * songSecondsFor(PROGRAMME_SECONDS)),
          song,
        ),
        'the song renders',
      );
      const decoded = readFloatWav(song);
      source = path.join(scratch, 'fair-programme.wav');
      writeFloatWav(
        source,
        fairStereo(decoded.channels[0], decoded.rate, PROGRAMME_SECONDS),
      );
      check(await host.loadDeck(0, source), 'the fair programme loads');
      check(await host.setPlaying(true), 'the transport restarts');
      line(`source: ${source}, fair stereo built from the song (${reason})`);
      probe = await render(dryOff, 'dry-probe');
    }
    /**
     * Every render starts from the source brought under the ceiling the
     * engine's output guard holds everything to, DSP Off included: -1 dBTP,
     * and half a decibel more for the peaks between samples.
     *
     * A record that plays over it is heard at that ceiling whatever the rack
     * does, so a reference left above it read every limited chain low by the
     * record's overs — two to three decibels on a modern master decoded past
     * full scale — while the listener, hearing both through the guard, heard
     * them level.
     */
    const headroomDb = Math.min(
      0,
      -1.5 - 20 * Math.log10(Math.max(probe.peak, 1e-9)),
    );
    const dryName = headroomDb < 0 ? 'dry-reference' : 'dry-probe';
    const dry =
      headroomDb < 0 ? await render(dryOff, dryName, headroomDb) : probe;
    check(passesShapeSafety(dry, false), 'the reference is valid programme');
    const dryLoudness = heardLevel(
      readFloatWav(path.join(scratch, `${dryName}.wav`)),
    );
    // Said out loud, and unmissably, because a green run means two different
    // things depending on it.
    line(
      levelChecks
        ? `level windows: ON (real music, started ${(-headroomDb).toFixed(1)} dB down)`
        : 'level windows: SKIPPED — synthesised programme, shape safety only',
    );

    // Positive control: a flat-topped constant must fail the same predicate.
    const clipped = measure({
      rate: 48_000,
      channels: [new Float32Array(48_000).fill(1)],
    });
    check(
      !passesShapeSafety(clipped, true) && !passesShapeSafety(clipped, false),
      'the safety check rejects clipped audio',
    );

    for (let index = 0; index < DSP_PRESETS.length; index += 1) {
      const preset = DSP_PRESETS[index];
      // eslint-disable-next-line no-await-in-loop -- one native chain owns one deck.
      const result = await render(
        preset.settings,
        `chain-${preset.id}`,
        headroomDb,
      );
      const rendered = readFloatWav(
        path.join(scratch, `chain-${preset.id}.wav`),
      );
      const levelDb = dbRatio(
        heardLevel(
          preset.curve
            ? withCurve(rendered, preset.id, preset.curve)
            : rendered,
        ),
        dryLoudness,
      );
      line(
        `       ${preset.id.padEnd(16)} peak ${result.peak.toFixed(4)} · ${levelDb.toFixed(1).padStart(5)} dB vs DSP Off, heard, with its curve · crest ${result.crestDb.toFixed(1)} dB`,
      );
      const held = holdsCeiling(preset.settings);
      check(
        passesShapeSafety(result, held),
        `${preset.id}: ${shapeCheckName(held)}`,
      );
      if (levelChecks) {
        /**
         * The floor is the same for every chain; only the ceiling moves.
         *
         * A chain whose Master is bringing the programme to a target cannot
         * also be level-neutral — the harness hands it a makeup (above) and
         * the old window then demanded the result come back where it started,
         * which is why Default failed this for as long as the window existed.
         * Those chains may spend the makeup they were given and no more; the
         * Master's own limiter absorbs part of it, and how much is a property
         * of the destination rather than a fault. Vinyl keeps a -3 dBTP
         * ceiling for the lathe, so it delivers almost none of it and lands
         * below DSP Off, which is correct and still inside the floor.
         */
        const normalising = normalisesLoudness(preset.settings);
        check(
          levelDb > -1.5 && levelDb < (normalising ? MASTER_MAKEUP_DB + 0.5 : 1.6),
          normalising
            ? `${preset.id}: spends its makeup and no more`
            : `${preset.id}: stays within -1.5/+1.6 dB of DSP Off`,
        );
        if (preset.id === 'reference') {
          check(
            Math.abs(levelDb) < 0.5,
            'reference: gain-matched level stays within 0.5 dB of DSP Off',
          );
        }
      }
    }

    if (!chainsOnly) {
      // Keep the quiet calibration and also exercise the reported unity input.
      const levels = [-6, 0];
      const profiles = filterPresetCases();
      for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
        const inputGainDb = levels[levelIndex];
        line(`every filter profile at ${inputGainDb} dB input`);
        for (let index = 0; index < profiles.length; index += 1) {
          const preset = profiles[index];
          // eslint-disable-next-line no-await-in-loop -- one native chain owns one deck.
          const result = await render(
            preset.settings,
            `${preset.family}-${preset.id}`,
            inputGainDb,
          );
          const levelDb = dbRatio(result.rms, dry.rms) - inputGainDb;
          line(
            `       ${preset.family.padEnd(12)} ${preset.id.padEnd(16)} level ${levelDb.toFixed(2).padStart(6)} dB vs dry`,
          );
          const held = holdsCeiling(preset.settings);
          check(
            passesShapeSafety(result, held),
            `${preset.family}/${preset.id}: ${shapeCheckName(held)}`,
          );
          if (levelChecks) {
            check(
              levelDb > -12 && levelDb < 9,
              `${preset.family}/${preset.id}: level remains bounded`,
            );
            if (preset.family === 'denoise') {
              check(
                levelDb > -2 && levelDb < 0.5,
                `${preset.id}: does not hollow out clean music`,
              );
            }
          }
        }
      }
    }

    if (failures > 0) {
      throw new Error(`preset smoke: ${failures} check(s) failed`);
    }
    line(
      levelChecks
        ? 'all preset checks passed'
        : 'all preset shape checks passed — level windows were not evaluated',
    );
  } finally {
    await host.stop();
    rmSync(scratch, { recursive: true, force: true });
  }
  process.exit(0);
};

main().catch((error: unknown) => {
  console.error('preset smoke failed', error);
  process.exit(1);
});
