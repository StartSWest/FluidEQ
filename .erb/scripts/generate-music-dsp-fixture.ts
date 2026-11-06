/* FluidEQ — GPL-3.0-or-later */
import { mkdirSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import { GENRE_RACKS, genreChainId } from '../../src/common/dsp/genres';
import { factoryMusicLine } from './music-dsp-evidence';
import policy from '../../docs/dsp/music-reference-policy.json';

const root = path.join(__dirname, '..', '..');
const file = path.join(
  root,
  'native/dsp-core/tests/fixtures/music-factory.txt',
);
const rows = GENRE_RACKS.map((rack) => {
  const preset = DSP_PRESETS.find((entry) => entry.id === genreChainId(rack));
  if (!preset) throw new Error(`Missing music preset: ${rack.id}`);
  const saved:
    { limiterLossBudgetLu: number; outputAimLufs: number } | undefined =
    Reflect.get(policy.genres, rack.id);
  if (!saved) {
    throw new Error(`Missing music dynamics budget: ${rack.id}`);
  }
  const loss = saved.limiterLossBudgetLu;
  const crest = loss < 0.2 ? 1.75 : loss < 0.5 ? 3 : 4;
  const contrast = loss < 0.2 ? 0.65 : loss < 0.5 ? 1 : 1.5;
  return `${rack.id} ${loss} ${crest} ${contrast} ${saved.outputAimLufs} ${factoryMusicLine(preset)}`;
});
mkdirSync(path.dirname(file), { recursive: true });
// A running dev process must never observe a partially written source fixture.
writeFileSync(`${file}.tmp`, `${rows.join('\n')}\n`);
renameSync(`${file}.tmp`, file);
