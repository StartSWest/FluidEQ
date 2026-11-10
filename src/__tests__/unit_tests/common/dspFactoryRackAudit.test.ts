/* FluidEQ — GPL-3.0-or-later */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import {
  factoryMusicTone,
  musicProcessingSources,
} from '../../../../.erb/scripts/music-dsp-evidence';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../../common/dsp/chainWire';
import { DSP_PRESETS } from '../../../common/dsp/presets';

interface IReference {
  latencyFrames: number;
  loudnessDeltaLu: number;
  limiterLossLu: number;
  limiterCrestLossDb: number;
  limiterPhraseLossDb: number;
  output: { truePeakDbtp: number; crestDb: number };
  effects: { stage: string; loudnessDeltaLu: number }[];
}
interface IReceipt {
  completeCatalogue: boolean;
  processingSha256: string;
  outputDevicesOpened: boolean;
  headphoneCorrection: boolean;
  roomHeadSha256: string;
  failures: string[];
  presets: {
    id: string;
    configurationSha256: string;
    normalizerMode: string;
    adaptiveMaster: boolean;
    references: IReference[];
  }[];
}
const root = path.resolve(__dirname, '../../../..');
const hash = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');

it('audits all 35 non-genre factory racks through the unanalysed native graph', () => {
  const file = path.join(root, 'docs/dsp/factory-rack-audit.json');
  const receipt = JSON.parse(readFileSync(file, 'utf8')) as IReceipt;
  const factory = DSP_PRESETS.filter((preset) => preset.group !== 'genre');
  expect(receipt.completeCatalogue).toBe(true);
  expect(receipt.processingSha256).toBe(musicProcessingSources(root).sha256);
  expect(receipt.roomHeadSha256).toBe(
    hash(readFileSync(path.join(root, 'assets/room/heads/medium.txt'))),
  );
  expect(receipt.outputDevicesOpened).toBe(false);
  expect(receipt.headphoneCorrection).toBe(false);
  expect(receipt.failures).toEqual([]);
  expect(receipt.presets.map((row) => row.id)).toEqual(
    factory.map((preset) => preset.id),
  );
  expect(receipt.presets).toHaveLength(35);
  receipt.presets.forEach((row, index) => {
    const { settings, id, curve } = factory[index];
    const tone = curve ? factoryMusicTone(factory[index]) : undefined;
    const wire = appendPresetTone(encodeChainSettings(settings), tone);
    expect(row.configurationSha256).toBe(hash(wire.join(' ')));
    expect(row.normalizerMode).toBe('off');
    expect(row.adaptiveMaster).toBe(false);
    expect(row.references).toHaveLength(2);
    row.references.forEach((source) => {
      expect(Number.isFinite(source.loudnessDeltaLu)).toBe(true);
      expect(source.output.crestDb).toBeGreaterThan(2);
    });
    row.references
      .filter(() => settings.gameMode)
      .forEach((source) => {
        expect(source.latencyFrames).toBe(id === 'game-night' ? 645 : 48);
      });
    row.references
      .filter(() => !settings.maximizer.enabled)
      .forEach((source) => {
        expect(id).toBe('empty');
        expect(source.loudnessDeltaLu).toBeCloseTo(0, 7);
      });
    row.references
      .filter(() => settings.maximizer.enabled)
      .forEach((source) => {
        const lossBudget =
          id === 'late-night' || id === 'game-night' ? 1.6 : 1.25;
        expect(source.output.truePeakDbtp).toBeLessThanOrEqual(
          settings.maximizer.ceilingDb + 0.03,
        );
        expect(source.limiterLossLu).toBeLessThanOrEqual(lossBudget);
        expect(source.limiterCrestLossDb).toBeLessThanOrEqual(4);
        expect(source.limiterPhraseLossDb).toBeLessThanOrEqual(1.5);
        expect(source.loudnessDeltaLu).toBeLessThanOrEqual(2.05);
        source.effects
          .filter((one) => one.stage === 'deEsser')
          .forEach((one) => {
            expect(Math.abs(one.loudnessDeltaLu)).toBeLessThanOrEqual(0.5);
          });
      });
  });
});
