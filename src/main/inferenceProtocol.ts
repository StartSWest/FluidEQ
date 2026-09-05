/* FluidEQ — GPL-3.0-or-later */
export interface IInferenceTensor {
  data: Float32Array;
  dims: readonly number[];
}

export type TInferenceCommand =
  | { type: 'create'; modelPath: string; providers: string[] }
  | { type: 'run'; sessionId: number; feeds: Record<string, IInferenceTensor> }
  | { type: 'release'; sessionId: number };

export type TInferenceRequest = TInferenceCommand & { id: number };
export type TInferenceResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };
