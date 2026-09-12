import { ipcMain } from 'electron';
import log from 'electron-log';
import fs from 'fs/promises';
import path from 'path';
import ChannelEnum from '../../common/channels';
import { IState } from '../../common/constants';
import { IAudioEngineStatus, TAudioEngine } from '../../common/audioEngine';
import {
  CURVE_COMPARISON_FILENAME,
  ICurveComparisonStatus,
  TCurveComparison,
  isCurveComparison,
  supportsCurveComparison,
  DEFAULT_CURVE_COMPARISON,
  EQ_PHASE_FILENAME,
  supportsEqPhase,
} from '../../common/curveComparison';
import { ErrorCode } from '../../common/errors';
import { hasSampledCurveLayers } from '../apoRender';
import { scheduleWrite } from '../asyncWriter';

export interface ICurveComparisonDeps {
  state: IState;
  getStatus: () => Promise<IAudioEngineStatus>;
  getConfigPath: () => Promise<string>;
  getEngine: () => TAudioEngine | null;
  isSwitching: () => boolean;
}

const readVariant = async (
  filePath: string,
  fallback: TCurveComparison,
): Promise<TCurveComparison> => {
  try {
    const value = (await fs.readFile(filePath, 'utf8')).trim();
    return isCurveComparison(value) ? value : fallback;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
};

export const registerCurveComparisonIpc = ({
  state,
  getStatus,
  getConfigPath,
  getEngine,
  isSwitching,
}: ICurveComparisonDeps) => {
  const readStatus = async (): Promise<ICurveComparisonStatus> => {
    const status = await getStatus();
    const active =
      status.engine === 'fluid' &&
      getEngine() === 'fluid' &&
      status.fluid.installed &&
      !isSwitching();
    return {
      variant: active
        ? await readVariant(
            path.join(await getConfigPath(), CURVE_COMPARISON_FILENAME),
            DEFAULT_CURVE_COMPARISON,
          )
        : DEFAULT_CURVE_COMPARISON,
      hasSampledCurves: hasSampledCurveLayers(state),
      eqVariant: active
        ? await readVariant(
            path.join(await getConfigPath(), EQ_PHASE_FILENAME),
            'B',
          )
        : 'B',
      eqSupported: active && supportsEqPhase(status.fluid.dllVersion),
      supported: active && supportsCurveComparison(status.fluid.dllVersion),
      active,
    };
  };
  ipcMain.on(ChannelEnum.GET_CURVE_COMPARISON, async (event) => {
    try {
      event.reply(ChannelEnum.GET_CURVE_COMPARISON, {
        result: await readStatus(),
      });
    } catch (error) {
      log.error('Could not read curve comparison', error);
      event.reply(ChannelEnum.GET_CURVE_COMPARISON, {
        errorCode: ErrorCode.FAILURE,
      });
    }
  });
  ipcMain.on(ChannelEnum.SET_CURVE_COMPARISON, async (event, args) => {
    const channel = ChannelEnum.SET_CURVE_COMPARISON;
    const variant: unknown = Array.isArray(args) ? args[0] : undefined;
    const scope: unknown = Array.isArray(args)
      ? (args[1] ?? 'curves')
      : undefined;
    if (!isCurveComparison(variant) || (scope !== 'eq' && scope !== 'curves')) {
      event.reply(channel, { errorCode: ErrorCode.INVALID_PARAMETER });
      return;
    }
    try {
      const current = await readStatus();
      const supported =
        scope === 'eq' ? current.eqSupported : current.supported;
      if (!current.active || !supported) {
        event.reply(channel, { result: current });
        return;
      }
      const filePath = path.join(
        await getConfigPath(),
        scope === 'eq' ? EQ_PHASE_FILENAME : CURVE_COMPARISON_FILENAME,
      );
      if (isSwitching() || getEngine() !== 'fluid') {
        event.reply(channel, { result: await readStatus() });
        return;
      }
      await scheduleWrite(filePath, `${variant}\r\n`);
      event.reply(channel, {
        result: {
          ...current,
          ...(scope === 'eq' ? { eqVariant: variant } : { variant }),
        },
      });
    } catch (error) {
      log.error('Could not apply curve comparison', error);
      event.reply(channel, { errorCode: ErrorCode.FAILURE });
    }
  });
};
