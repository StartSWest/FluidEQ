/* FluidEQ — GPL-3.0-or-later */
/** Real command/adoption/shutdown coverage without opening an audio endpoint. */
import path from 'path';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../src/common/dsp/chainWire';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import { factoryMusicTone } from './music-dsp-evidence';

const main = async () => {
  const root = path.join(__dirname, '..', '..');
  const executablePath = path.join(
    root,
    'native/.build/bin',
    process.platform === 'win32' ? 'FluidEQ-DSP.exe' : 'FluidEQ-DSP',
  );
  const exits: number[] = [];
  let opened = false;
  const host = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
    onLifecycle: (event) => {
      if (event.event === 'device-open-requested') {
        opened = true;
      }
      if (event.event === 'exited' && typeof event.values.code === 'number') {
        exits.push(event.values.code);
      }
    },
  });
  const applied = (value: boolean) => {
    if (!value) {
      throw new Error('Offline handover command was refused');
    }
  };
  const preset = DSP_PRESETS.find((one) => one.id === 'pop');
  if (!preset) {
    throw new Error('Missing Pop factory chain');
  }
  const line = appendPresetTone(
    encodeChainSettings(preset.settings),
    factoryMusicTone(preset),
  );
  try {
    applied(await host.start());
    applied(await host.applyChain(line));
    applied(await host.setTrackGains(-2, 0, true));
    applied(await host.runOfflineBlocks(8));
    applied(await host.applyChain(line));
    applied(await host.setTrackGains(-3, 0, false));
    applied(await host.runOfflineBlocks(8));
    applied(await host.applyChain(line));
    applied(await host.runOfflineBlocks(8));
  } finally {
    await host.stop();
  }
  if (opened || exits.length !== 1 || exits[0] !== 0) {
    throw new Error(
      `Unsafe offline host shutdown: ${JSON.stringify({ opened, exits })}`,
    );
  }
  process.stdout.write(
    'Offline host chain/gain handover and clean shutdown passed; no output device opened.\n',
  );
};
main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
