import { ipcRenderer } from 'electron';
import type {
  TPlusTrialOutcome,
  TPlusTrialSettingsOutcome,
} from '../common/plusTrial';
import type { TTrialExitReason } from '../common/trialExit';
import type {
  TTrialExitOutcome,
  TTrialExitReportOutcome,
} from './plus/trialExitApi';

export const plusTrialBridge = {
  getPlusTrialOffer: (): Promise<TPlusTrialOutcome> =>
    ipcRenderer.invoke('plus-trial-offer'),
  getPlusTrialSettings: (): Promise<TPlusTrialSettingsOutcome> =>
    ipcRenderer.invoke('plus-trial-settings'),
  setPlusTrialOffer: (enabled: boolean): Promise<TPlusTrialSettingsOutcome> =>
    ipcRenderer.invoke('plus-trial-set-offer', enabled),
  // Why a trial ended without Plus (premium 0054): what is asked, the answer.
  getTrialExit: (): Promise<TTrialExitOutcome> =>
    ipcRenderer.invoke('plus-trial-exit'),
  reportTrialExit: (
    reason: TTrialExitReason,
    note?: string,
  ): Promise<TTrialExitReportOutcome> =>
    ipcRenderer.invoke('plus-trial-exit-report', reason, note),
};
