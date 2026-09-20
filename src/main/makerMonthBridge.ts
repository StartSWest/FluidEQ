import { ipcRenderer } from 'electron';
import type { TMakerMonthOutcome } from '../common/makerMonth';

export const makerMonthBridge = {
  getMakerMonth: (): Promise<TMakerMonthOutcome> =>
    ipcRenderer.invoke('maker-month'),
};
