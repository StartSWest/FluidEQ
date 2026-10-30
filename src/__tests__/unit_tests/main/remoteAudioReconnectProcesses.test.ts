/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

it('recovers real encrypted PCM between independent processes after rediscovery and cold restarts', async () => {
  const root = path.resolve(__dirname, '../../../..');
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      '--unhandled-rejections=strict',
      '.erb/scripts/check-share-audio-reconnect.cjs',
    ],
    { cwd: root, maxBuffer: 1024 * 1024 },
  );
  expect(stdout).toContain(
    'real authenticated TCP and unchanged PCM in both directions',
  );
  expect(stdout).toContain('3 cold restarts with changed ports');
}, 30_000);
