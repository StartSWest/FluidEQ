/* FluidEQ — GPL-3.0-or-later */
// This is the only process allowed to load the native ONNX addon. An access
// violation or GPU-driver abort here must never kill the settings writer.
import * as ort from 'onnxruntime-node';
import {
  IInferenceTensor,
  TInferenceRequest,
  TInferenceResponse,
} from './inferenceProtocol';

const port = (
  process as NodeJS.Process & {
    parentPort?: {
      on: (
        event: 'message',
        callback: (event: { data: TInferenceRequest }) => void,
      ) => void;
      postMessage: (message: TInferenceResponse) => void;
    };
  }
).parentPort;
if (!port) {
  throw new Error('Native inference requires a parent process');
}
const sessions = new Map<number, ort.InferenceSession>();
let nextSessionId = 0;

const execute = async (request: TInferenceRequest): Promise<unknown> => {
  if (request.type === 'create') {
    const session = await ort.InferenceSession.create(request.modelPath, {
      executionProviders: request.providers,
    });
    nextSessionId += 1;
    sessions.set(nextSessionId, session);
    return nextSessionId;
  }
  const session = sessions.get(request.sessionId);
  if (!session) {
    throw new Error('Native inference session is no longer available');
  }
  if (request.type === 'release') {
    sessions.delete(request.sessionId);
    await session.release();
    return null;
  }
  const feeds: Record<string, ort.Tensor> = {};
  Object.entries(request.feeds).forEach(([name, tensor]) => {
    feeds[name] = new ort.Tensor('float32', tensor.data, tensor.dims);
  });
  const output = await session.run(feeds);
  const result: Record<string, IInferenceTensor> = {};
  Object.entries(output).forEach(([name, tensor]) => {
    if (!(tensor.data instanceof Float32Array)) {
      throw new Error(`Unexpected inference output type for ${name}`);
    }
    result[name] = { data: tensor.data, dims: tensor.dims };
  });
  return result;
};

// Serialize native operations: release cannot race an in-flight run, and
// concurrent pitch/separation requests do not double-book the GPU allocator.
let queue = Promise.resolve();
port.on('message', ({ data }) => {
  queue = queue.then(async () => {
    try {
      const result = await execute(data);
      port.postMessage({ id: data.id, ok: true, result });
    } catch (error) {
      port.postMessage({
        id: data.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return undefined;
  });
});
