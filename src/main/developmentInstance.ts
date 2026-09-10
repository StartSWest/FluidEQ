import fs from 'fs';
import path from 'path';
import type { App } from 'electron';

/** Packaged builds must never opt out of the shared system-EQ lock. */
export const getDevelopmentInstance = (
  isPackaged: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  if (isPackaged || environment.NODE_ENV !== 'development') {
    return undefined;
  }
  const instance = environment.FLUIDEQ_DEV_INSTANCE;
  if (!instance) {
    return undefined;
  }
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(instance)) {
    throw new Error(
      'FLUIDEQ_DEV_INSTANCE must be a lowercase name of 1–48 letters, digits or hyphens.',
    );
  }
  return instance;
};

export const getDevelopmentDebugPort = (
  isPackaged: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  if (isPackaged || environment.NODE_ENV !== 'development') {
    return undefined;
  }
  const value = environment.FLUIDEQ_DEVTOOLS_PORT ?? '9222';
  const port = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'FLUIDEQ_DEVTOOLS_PORT must be an integer from 1 to 65535.',
    );
  }
  return String(port);
};

/** Run before importing main: stores and Chromium read these paths on import. */
export const configureDevelopmentInstance = (
  app: Pick<App, 'isPackaged' | 'getPath' | 'setPath'>,
): void => {
  const instance = getDevelopmentInstance(app.isPackaged);
  if (!instance) {
    return;
  }
  const userData = path.join(app.getPath('appData'), 'FluidEQ-dev', instance);
  const sessionData = path.join(userData, 'chromium');
  fs.mkdirSync(sessionData, { recursive: true });
  app.setPath('userData', userData);
  app.setPath('sessionData', sessionData);
};
