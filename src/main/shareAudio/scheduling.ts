/* FluidEQ — GPL-3.0-or-later */
import path from 'path';
import { isMainThread } from 'worker_threads';

/** Only the standalone audio service's Node thread joins MMCSS Audio. No
 * process priority, registry setting, audio installation or UI thread changes. */
export const startAudioScheduling = () => {
  if (
    process.platform !== 'win32' ||
    !isMainThread ||
    (process as NodeJS.Process & { type?: string }).type === 'browser'
  ) {
    return {
      active: false,
      reason: 'outside-audio-service',
      close: () => undefined,
    };
  }
  let reason = 'module';
  try {
    // Loaded before this dedicated process creates any other JS workers.
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- Windows-only runtime dependency; never loaded in main or a Node worker
    const koffi = require('koffi') as typeof import('koffi');
    reason = 'library';
    const avrt = koffi.load(
      path.join(
        process.env.SystemRoot || 'C:\\Windows',
        'System32',
        'avrt.dll',
      ),
    );
    reason = 'exports';
    const register = avrt.func(
      'void * __stdcall AvSetMmThreadCharacteristicsW(str16 task, _Inout_ uint32_t *index)',
    );
    const revert = avrt.func(
      'int __stdcall AvRevertMmThreadCharacteristics(void *task)',
    );
    reason = 'task';
    const task: unknown = register('Audio', [0]);
    if (task === null) {
      return { active: false, reason, close: () => undefined };
    }
    let closed = false;
    return {
      active: true,
      reason: 'audio',
      close: () => {
        if (!closed) {
          closed = true;
          revert(task);
        }
      },
    };
  } catch {
    // MMCSS can be unavailable on a locked-down machine. Keep the existing
    // native audio callbacks and event-driven service running at normal priority.
    return { active: false, reason, close: () => undefined };
  }
};
