import { powerMonitor } from 'electron';

export interface IDesktopConditions {
  locked: boolean;
  suspended: boolean;
  battery: boolean;
}

/**
 * The lock, sleep and battery states every monitor's background answers to,
 * kept from the power monitor's own events. Only after Electron's `ready`.
 */
export const watchDesktopConditions = (
  onChange: () => void,
): { conditions: Readonly<IDesktopConditions>; dispose(): void } => {
  const conditions: IDesktopConditions = {
    locked: powerMonitor.getSystemIdleState(1) === 'locked',
    suspended: false,
    battery: powerMonitor.isOnBatteryPower(),
  };
  const set = (key: keyof IDesktopConditions, value: boolean) => () => {
    conditions[key] = value;
    onChange();
  };
  const lock = set('locked', true);
  const unlock = set('locked', false);
  const suspend = set('suspended', true);
  const resume = set('suspended', false);
  const battery = set('battery', true);
  const ac = set('battery', false);
  powerMonitor.on('lock-screen', lock);
  powerMonitor.on('unlock-screen', unlock);
  powerMonitor.on('suspend', suspend);
  powerMonitor.on('resume', resume);
  powerMonitor.on('on-battery', battery);
  powerMonitor.on('on-ac', ac);
  return {
    conditions,
    dispose: () => {
      powerMonitor.removeListener('lock-screen', lock);
      powerMonitor.removeListener('unlock-screen', unlock);
      powerMonitor.removeListener('suspend', suspend);
      powerMonitor.removeListener('resume', resume);
      powerMonitor.removeListener('on-battery', battery);
      powerMonitor.removeListener('on-ac', ac);
    },
  };
};
