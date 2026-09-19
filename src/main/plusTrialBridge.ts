import { ipcRenderer } from 'electron';
import type {
  IPlusTrialAcceptance,
  TPlusTrialOutcome,
  TPlusTrialSettingsOutcome,
} from '../common/plusTrial';

export const plusTrialBridge = {
  getPlusTrialOffer: (): Promise<TPlusTrialOutcome> =>
    ipcRenderer.invoke('plus-trial-offer'),
  startPlusTrial: (
    acceptance: IPlusTrialAcceptance,
  ): Promise<TPlusTrialOutcome> =>
    ipcRenderer.invoke('plus-trial-start', acceptance),
  getPlusTrialSettings: (): Promise<TPlusTrialSettingsOutcome> =>
    ipcRenderer.invoke('plus-trial-settings'),
  setPlusTrialOffer: (enabled: boolean): Promise<TPlusTrialSettingsOutcome> =>
    ipcRenderer.invoke('plus-trial-set-offer', enabled),
};
