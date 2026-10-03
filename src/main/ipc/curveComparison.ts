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
import { bandPhaseScopes, hasSampledCurveLayers } from '../apoRender';
import { scheduleWrite } from '../asyncWriter';
import onWindowMessage from './windowMessages';
import type { IOutputSound } from '../../common/outputSettings';
import { outputConfigFileName } from '../../common/outputConfigFiles';
import { outputDesignsOf } from '../outputDesigns';

export interface ICurveComparisonDeps {
  state: IState;
  getStatus: () => Promise<IAudioEngineStatus>;
  getConfigPath: () => Promise<string>;
  getEngine: () => TAudioEngine | null;
  isSwitching: () => boolean;
  getOutputGuid?: () => string | undefined;
  persist?: (sound: IOutputSound) => Promise<void>;
  getEditGeneration?: () => number;
  flush?: () => Promise<void>;
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
  getOutputGuid,
  persist,
  getEditGeneration,
  flush,
}: ICurveComparisonDeps) => {
  const readStatus = async (): Promise<ICurveComparisonStatus> => {
    const status = await getStatus();
    const active =
      status.engine === 'fluid' &&
      getEngine() === 'fluid' &&
      status.fluid.installed &&
      !isSwitching();
    let variant = DEFAULT_CURVE_COMPARISON;
    let eqVariant: TCurveComparison = 'B';
    if (getOutputGuid) {
      const designs = outputDesignsOf(state);
      variant = designs.curvePhase;
      eqVariant = designs.eqPhase;
    } else if (active) {
      const directory = await getConfigPath();
      [variant, eqVariant] = await Promise.all([
        readVariant(
          path.join(directory, CURVE_COMPARISON_FILENAME),
          DEFAULT_CURVE_COMPARISON,
        ),
        readVariant(path.join(directory, EQ_PHASE_FILENAME), 'B'),
      ]);
    }
    return {
      variant,
      eqVariant,
      hasSampledCurves: hasSampledCurveLayers(state),
      bandPhaseScopes: bandPhaseScopes(state),
      eqSupported: active && supportsEqPhase(status.fluid.dllVersion),
      supported: active && supportsCurveComparison(status.fluid.dllVersion),
      active,
    };
  };
  onWindowMessage(ChannelEnum.GET_CURVE_COMPARISON, async (event) => {
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
  onWindowMessage(ChannelEnum.SET_CURVE_COMPARISON, async (event, args) => {
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
      const target = getOutputGuid?.();
      const generation = getEditGeneration?.();
      const filename = target
        ? outputConfigFileName(
            scope === 'eq' ? 'eqPhase' : 'curvePhase',
            target,
          )
        : undefined;
      const current = await readStatus();
      const supported =
        scope === 'eq' ? current.eqSupported : current.supported;
      if (!current.active || !supported) {
        event.reply(channel, { result: current });
        return;
      }
      if (
        getOutputGuid?.() !== target ||
        getEditGeneration?.() !== generation
      ) {
        event.reply(channel, { result: await readStatus() });
        return;
      }
      if (persist && flush) {
        await persist(
          scope === 'eq' ? { eqPhase: variant } : { curvePhase: variant },
        );
        await flush();
        event.reply(channel, { result: await readStatus() });
        return;
      }
      const filePath = path.join(
        await getConfigPath(),
        filename ??
          (scope === 'eq' ? EQ_PHASE_FILENAME : CURVE_COMPARISON_FILENAME),
      );
      if (getOutputGuid && !filename) {
        throw new Error('No output selected.');
      }
      if (isSwitching() || getEngine() !== 'fluid') {
        event.reply(channel, { result: await readStatus() });
        return;
      }
      if (persist) {
        await persist(
          scope === 'eq' ? { eqPhase: variant } : { curvePhase: variant },
        );
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
