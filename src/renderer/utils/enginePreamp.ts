import { useEffect, useSyncExternalStore } from 'react';
import { IEnginePreamp } from '../../common/enginePreamp';
import { getAudioDevices } from './equalizerApi';
import { reportError } from './logger';

let snapshot: IEnginePreamp | undefined;
const listeners = new Set<() => void>();
const publish = (next?: IEnginePreamp) => {
  const rounded = next
    ? { ...next, gainDb: Math.round(next.gainDb * 100) / 100 }
    : undefined;
  if (
    snapshot?.gainDb === rounded?.gainDb &&
    snapshot?.enabled === rounded?.enabled &&
    snapshot?.active === rounded?.active
  ) {
    return;
  }
  snapshot = rounded;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useEnginePreamp = () =>
  useSyncExternalStore(subscribe, () => snapshot);

export const useEnginePreampReader = (enabled: boolean) => {
  useEffect(() => {
    const read = window.electron?.ipcRenderer?.readEnginePreamp;
    if (!enabled || !read) {
      publish();
      return undefined;
    }
    let disposed = false;
    let generation = 0;
    let animation = 0;
    let endpoint: string | undefined;
    const paint = async () => {
      const current = generation;
      if (disposed || document.hidden || !endpoint) {
        return;
      }
      try {
        const next = await read(endpoint);
        if (disposed || current !== generation) {
          return;
        }
        publish(next);
      } catch (error) {
        if (disposed || current !== generation) {
          return;
        }
        reportError('reading final output preamp', error);
        publish();
        return;
      }
      animation = requestAnimationFrame(paint);
    };
    const start = async () => {
      generation += 1;
      const current = generation;
      cancelAnimationFrame(animation);
      publish();
      if (disposed || document.hidden) {
        return;
      }
      try {
        const devices = await getAudioDevices();
        if (disposed || current !== generation) {
          return;
        }
        endpoint = devices.find((device) => device.isDefault)?.guid;
        if (endpoint) {
          animation = requestAnimationFrame(paint);
        }
      } catch (error) {
        reportError('finding final output preamp', error);
      }
    };
    start();
    window.addEventListener('fluideq-output-changed', start);
    document.addEventListener('visibilitychange', start);
    return () => {
      disposed = true;
      generation += 1;
      cancelAnimationFrame(animation);
      publish();
      window.removeEventListener('fluideq-output-changed', start);
      document.removeEventListener('visibilitychange', start);
    };
  }, [enabled]);
};
