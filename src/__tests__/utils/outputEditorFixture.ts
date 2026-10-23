import { getDefaultState, type IAudioDevice } from 'common/constants';
import type { IEqualizerSnapshot } from 'common/outputSettings';
import { updateOutputEditor } from 'renderer/utils/outputEditor';

export const mainOutput: IAudioDevice = {
  id: 'headphones',
  guid: '{HEADPHONES}',
  name: 'Main headphones',
  isDefault: true,
  isActive: true,
  isEqualizerApoAttached: true,
  isFluidEngineAttached: true,
};

export const secondOutput: IAudioDevice = {
  ...mainOutput,
  id: 'speakers',
  guid: '{SPEAKERS}',
  name: 'Second speakers',
  isDefault: false,
};

/** The same ownership-bearing snapshot main publishes after a state read. */
export const showOutputEditor = (
  main = mainOutput,
  editor = main,
  generation = 1,
): IEqualizerSnapshot => {
  const snapshot = {
    ...getDefaultState(),
    outputEditor: {
      device: { ...editor, isDefault: main.id === editor.id },
      generation,
    },
    playbackOutput: { ...main, isDefault: true },
  };
  updateOutputEditor(snapshot);
  return snapshot;
};

interface IDeferred<Value> {
  promise: Promise<Value>;
  resolve(value: Value): void;
  reject(reason: unknown): void;
}

/** Resolve the actual boundary being exercised, without a clock or polling. */
export const deferred = <Value>(): IDeferred<Value> => {
  const settle: Omit<IDeferred<Value>, 'promise'> = {
    resolve: () => undefined,
    reject: () => undefined,
  };
  const promise = new Promise<Value>((resolve, reject) => {
    settle.resolve = resolve;
    settle.reject = reject;
  });
  return { promise, ...settle };
};
