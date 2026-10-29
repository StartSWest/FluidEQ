/* FluidEQ — GPL-3.0-or-later */
// node .erb/scripts/check-share-audio-process.cjs <built worker> <fixture resources>
// The resource directory contains only native/FluidEQ-LAN-Playback.exe.
// Starts a headless Electron harness, never FluidEQ, a window or a sound device.
// Only helper lease, close-output (7), release and owner-death are exercised.
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');

if (!process.versions.electron) {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  execFileSync(require('electron'), [__filename, ...process.argv.slice(2)], {
    windowsHide: true,
    stdio: 'inherit',
    env: environment,
  });
} else {
  require('ts-node/register/transpile-only');
  const { app } = require('electron');
  const { createAudioWorkerHost } = require('../../src/main/shareAudio/host');
  const {
    createAudioProcess,
  } = require('../../src/main/shareAudio/processHost');
  const folder = path.resolve('outputs/share-audio-process-fixture');
  fs.mkdirSync(folder, { recursive: true });
  app.setPath('userData', folder);
  app.disableHardwareAcceleration();
  const entry = path.resolve(process.argv[2]);
  const resources = path.resolve(process.argv[3]);
  const waitForOwnHelper = (pid) => {
    assert(Number.isSafeInteger(pid) && pid > 0);
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '$ErrorActionPreference = "Stop"; try { $fixtureChild = Get-Process -Id ' +
          pid +
          ' -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -like ' +
          '"NoProcessFoundForGivenId,*") { exit 0 }; throw }; ' +
          'if (!$fixtureChild.WaitForExit(5000)) { ' +
          'throw "Owned Share Audio helper did not exit" }; exit 0',
      ],
      { windowsHide: true },
    );
  };
  let host;
  app
    .whenReady()
    .then(async () => {
      process.stdout.write(
        JSON.stringify({ phase: 'headless-harness', pid: process.pid }) + '\n',
      );
      host = createAudioWorkerHost(entry, resources, createAudioProcess);
      const status = await host.request('status');
      assert.equal(
        status.scheduling,
        true,
        'built audio service did not join Audio',
      );
      const first = await host.request('helper.lease');
      const second = await host.request('helper.lease');
      process.stdout.write(
        JSON.stringify({ phase: 'helper-leases-ready', pid: first.pid }) + '\n',
      );
      assert.equal(
        first.pid,
        second.pid,
        'leases split the no-echo helper tree',
      );
      const owner = app
        .getAppMetrics()
        .find((metric) => metric.name === 'FluidEQ Share Audio');
      assert(Number.isSafeInteger(owner?.pid) && owner.pid > 0);
      const resourcesUsed = JSON.parse(
        execFileSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '$fixtureOwner = Get-Process -Id ' +
              owner.pid +
              '; $fixtureHelper = Get-CimInstance Win32_Process -Filter "ProcessId = ' +
              first.pid +
              '"; @{ privateBytes = $fixtureOwner.PrivateMemorySize64; ' +
              'workingSetBytes = $fixtureOwner.WorkingSet64; helperParent = ' +
              '$fixtureHelper.ParentProcessId } | ConvertTo-Json -Compress',
          ],
          { windowsHide: true, encoding: 'utf8' },
        ),
      );
      assert.equal(resourcesUsed.helperParent, owner.pid);
      await host.request('helper.request', first.id, 1, 7, undefined);
      await host.request('helper.release', first.id);
      await host.request('helper.request', second.id, 2, 7, undefined);
      await host.request('helper.release', second.id);
      waitForOwnHelper(first.pid);

      const replacement = await host.request('helper.lease');
      host.stop();
      waitForOwnHelper(replacement.pid);
      process.stdout.write(
        JSON.stringify({
          scheduling: status.scheduling,
          sharedHelper: true,
          remainingLeaseUsable: true,
          releaseExited: true,
          ownerDeathExited: true,
          nativeHelperParentIsService: true,
          servicePrivateMiB: resourcesUsed.privateBytes / 1048576,
          serviceRssMiB: resourcesUsed.workingSetBytes / 1048576,
          helperCommandKinds: [7],
        }) + '\n',
      );
      app.quit();
    })
    .catch((error) => {
      host?.stop();
      process.stderr.write(
        'Share Audio headless lifecycle fixture failed: ' +
          String(error) +
          '\n',
      );
      app.exit(1);
    });
}
