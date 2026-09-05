/* FluidEQ — GPL-3.0-or-later */
import { app, utilityProcess, type UtilityProcess } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import {
  IInferenceTensor,
  TInferenceCommand,
  TInferenceResponse,
} from './inferenceProtocol';

interface IWorker {
  child: UtilityProcess;
  pending: Map<
    number,
    { resolve: (result: unknown) => void; reject: (error: Error) => void }
  >;
  exited: Promise<void>;
  stopping: boolean;
}
let worker: IWorker | undefined;
let nextRequest = 0;
let crashes = 0;
let quitting = false;
const invalidated = new Set<() => void>();

export const onInferenceInvalidated = (callback: () => void) => {
  invalidated.add(callback);
};

const startWorker = (): IWorker => {
  if (quitting) {
    throw new Error('Native inference is shutting down');
  }
  if (worker) {
    if (worker.stopping) {
      throw new Error('Native inference is stopping');
    }
    return worker;
  }
  if (crashes >= 2) {
    throw new Error(
      'Native inference recovery limit reached; restart FluidEQ to retry',
    );
  }
  const entry = app.isPackaged
    ? path.join(__dirname, 'inference-worker.js')
    : path.join(__dirname, '../../.erb/dll/inference-worker.js');
  // No in-process fallback: that would silently put the fatal native code
  // back inside the process this boundary exists to protect.
  if (!fs.existsSync(entry)) {
    throw new Error('Native inference worker bundle is missing');
  }
  const child = utilityProcess.fork(entry, [], {
    serviceName: 'FluidEQ Native Inference',
  });
  const pending: IWorker['pending'] = new Map();
  const exited = new Promise<void>((resolve) => {
    child.once('exit', (code) => {
      const intentional = current.stopping;
      if (!intentional) {
        crashes += 1;
        log.error('Native inference process exited unexpectedly', {
          code,
          crashes,
        });
      }
      pending.forEach(({ reject }) =>
        reject(
          new Error(
            intentional
              ? 'Native inference stopped'
              : 'Native inference crashed; the app is still running',
          ),
        ),
      );
      pending.clear();
      if (worker === current) {
        worker = undefined;
        invalidated.forEach((callback) => callback());
      }
      resolve();
    });
  });
  const current: IWorker = { child, pending, exited, stopping: false };
  worker = current;
  child.on('message', (message: TInferenceResponse) => {
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    pending.delete(message.id);
    if (message.ok) {
      request.resolve(message.result);
    } else {
      request.reject(new Error(message.error));
    }
  });
  return current;
};

const send = (owner: IWorker, command: TInferenceCommand): Promise<unknown> => {
  if (owner !== worker || owner.stopping) {
    return Promise.reject(
      new Error('Native inference session was interrupted'),
    );
  }
  nextRequest += 1;
  const id = nextRequest;
  return new Promise((resolve, reject) => {
    owner.pending.set(id, { resolve, reject });
    try {
      owner.child.postMessage({ ...command, id });
    } catch (error) {
      owner.pending.delete(id);
      reject(error);
    }
  });
};

class Tensor implements IInferenceTensor {
  readonly type: 'float32';

  readonly data: Float32Array;

  readonly dims: readonly number[];

  constructor(type: 'float32', data: Float32Array, dims: readonly number[]) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}

const createSession = async (
  modelPath: string,
  options: { executionProviders: string[] },
) => {
  const owner = startWorker();
  const sessionId = await send(owner, {
    type: 'create',
    modelPath,
    providers: options.executionProviders,
  });
  if (typeof sessionId !== 'number') {
    throw new Error('Invalid native inference session');
  }
  return {
    release: () =>
      send(owner, { type: 'release', sessionId }).then(() => undefined),
    run: async (
      feeds: Record<string, unknown>,
    ): Promise<Record<string, IInferenceTensor>> => {
      const tensors: Record<string, IInferenceTensor> = {};
      Object.entries(feeds).forEach(([name, tensor]) => {
        if (!(tensor instanceof Tensor)) {
          throw new Error('Invalid inference tensor');
        }
        tensors[name] = { data: tensor.data, dims: tensor.dims };
      });
      const result = await send(owner, {
        type: 'run',
        sessionId,
        feeds: tensors,
      });
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid native inference response');
      }
      return result as Record<string, IInferenceTensor>;
    },
  };
};

export const shutdownNativeInference = async () => {
  const current = worker;
  if (!current) {
    return;
  }
  if (!current.stopping) {
    current.stopping = true;
    if (!current.child.kill()) {
      current.stopping = false;
      throw new Error('Could not stop native inference');
    }
  }
  await current.exited;
};

app.on('before-quit', () => {
  quitting = true;
  shutdownNativeInference().catch((error) =>
    log.error('Could not stop inference on quit', error),
  );
});

export default { Tensor, InferenceSession: { create: createSession } };
