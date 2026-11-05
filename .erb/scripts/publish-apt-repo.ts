/**
 * pnpm package:linux:release && pnpm publish:apt --site-dir ../FluidEQ-Site
 * Metadata lives on fluideq.com's existing Cloudflare host; large installers
 * stay immutable GitHub Release assets. No private key enters either checkout.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import {
  aptSetup,
  atomicWrite,
  authorizeDeb,
  debRecord,
  packageUrl,
  releaseAsset,
  RELEASE_REPO,
  retainPackages,
  writeMetadata,
  type IAptPackage,
} from './apt-repository';
import {
  initializeAptKey,
  signingFingerprint,
  signRepository,
  verifyRepository,
} from './apt-signing';
import { checkLiveApt } from './check-apt-repo';
import { publishLinuxGitHubRelease } from './apt-github';
import updateLinuxDownloads from './apt-website';
import { readFeed } from './sign-update-feed';

const ROOT = path.resolve(__dirname, '../..');
const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return path.resolve(value);
};
const run = (command: string, args: string[], cwd = ROOT): string =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  }).trim();

/** Refuse redirects to a login/error page or a release asset with changed bytes. */
const verifyPublishedAsset = async (
  url: string,
  expectedSize: number,
  sha512: string,
): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(
      'The GitHub Debian release asset is not publicly available.',
    );
  }
  const hash = createHash('sha512');
  const reader = response.body.getReader();
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    size += chunk.value.length;
    hash.update(chunk.value);
  }
  if (size !== expectedSize || hash.digest('hex') !== sha512) {
    throw new Error(
      'The published GitHub Debian asset differs from the signed local installer.',
    );
  }
};

const writeSetupDocumentation = (directory: string) => {
  const notes = `## Ubuntu and Debian\n\nAdd the signed FluidEQ repository once:\n\n\`\`\`bash\n${aptSetup()}\n\`\`\`\n\nAfter that, use \`sudo apt upgrade\` for new Linux releases.\n`;
  atomicWrite(path.join(directory, 'install.md'), notes);
  atomicWrite(path.join(directory, 'install.txt'), `${aptSetup()}\n`);
};

const requireUnchanged = (directory: string, revision: string) => {
  if (
    run('git', ['rev-parse', 'HEAD'], directory) !== revision ||
    run('git', ['status', '--porcelain'], directory)
  ) {
    throw new Error(`The checkout changed during publication: ${directory}`);
  }
};

const bootstrapBuild = (build: string, version: string, revision: string) => {
  const marker = path.join(ROOT, 'release/.apt-bootstrap-build.json');
  const files = [
    releaseAsset(version),
    `FluidEQ-${version}-x86_64.AppImage`,
    'latest-linux.yml',
  ];
  const identity = () =>
    JSON.stringify({
      revision,
      files: files.map((name) => ({
        name,
        sha256: createHash('sha256')
          .update(fs.readFileSync(path.join(build, name)))
          .digest('hex'),
      })),
    });
  // Retrying after a deploy/login failure must reuse immutable release bytes.
  // Rebuilding a published version can change archive timestamps and hashes.
  if (
    fs.existsSync(marker) &&
    files.every((name) => fs.existsSync(path.join(build, name))) &&
    fs.readFileSync(marker, 'utf8') === identity()
  ) {
    return;
  }
  execFileSync('pnpm', ['package:linux:release'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  requireUnchanged(ROOT, revision);
  atomicWrite(marker, identity());
};

export default async function publishApt(): Promise<void> {
  const assets = path.join(ROOT, 'assets/apt');
  const site = argument('--site-dir', path.resolve(ROOT, '../FluidEQ-Site'));
  const output = argument(
    '--output',
    path.join(ROOT, 'release/apt-repository'),
  );
  const build = path.join(ROOT, 'release/build');
  const prepareOnly = process.argv.includes('--prepare-only');
  const bootstrap = process.argv.includes('--bootstrap');
  if (prepareOnly && bootstrap) {
    throw new Error('Use --prepare-only or --bootstrap, not both.');
  }
  if (run('git', ['branch', '--show-current']) !== 'linux') {
    throw new Error('Publish apt from the linux branch.');
  }
  if (!prepareOnly && run('git', ['status', '--porcelain'])) {
    throw new Error('Commit the Linux release changes before publishing apt.');
  }
  if (process.argv.includes('--init-key')) {
    initializeAptKey(assets);
    return;
  }
  if (bootstrap && !fs.existsSync(site)) {
    run('git', [
      'clone',
      'https://github.com/StartSWest/FluidEQ-Site.git',
      site,
    ]);
  }
  if (bootstrap) {
    execFileSync('pnpm', ['install', '--frozen-lockfile'], {
      cwd: site,
      stdio: 'inherit',
    });
  }
  if (!prepareOnly) {
    if (run('git', ['status', '--porcelain'], site)) {
      throw new Error('Use a clean FluidEQ website checkout.');
    }
    if (
      !run('git', ['remote', 'get-url', 'origin'], site).includes(
        'StartSWest/FluidEQ-Site',
      )
    ) {
      throw new Error('This is not the FluidEQ website checkout.');
    }
    // Read history only after incorporating concurrent website releases.
    run('git', ['pull', '--ff-only'], site);
  }
  const siteRevision = prepareOnly
    ? ''
    : run('git', ['rev-parse', 'HEAD'], site);
  if (bootstrap && !fs.existsSync(path.join(assets, 'key.json'))) {
    initializeAptKey(assets);
    run('git', ['diff', '--cached', '--quiet']);
    run('git', [
      'add',
      'assets/apt/key.json',
      'assets/apt/fluideq-archive-keyring.asc',
      'assets/apt/fluideq-archive-keyring.gpg',
    ]);
    run('git', [
      'commit',
      '-m',
      'Trust the dedicated protected apt repository signing key',
    ]);
    run('git', ['push', 'origin', 'linux']);
  }
  const fingerprint = signingFingerprint(assets);
  const revision = run('git', ['rev-parse', 'HEAD']);
  const { version }: { version: unknown } = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'release/app/package.json'), 'utf8'),
  );
  if (typeof version !== 'string') {
    throw new Error('No app release version.');
  }
  if (bootstrap) {
    bootstrapBuild(build, version, revision);
  }
  if (!prepareOnly) {
    requireUnchanged(ROOT, revision);
    requireUnchanged(site, siteRevision);
  }
  const feed = argument('--feed', path.join(build, 'latest-linux.yml'));
  const deb = argument('--deb', path.join(build, releaseAsset(version)));
  const authorized = authorizeDeb(
    fs.readFileSync(feed, 'utf8'),
    fs.readFileSync(deb),
    path.basename(deb),
  );
  if (version !== authorized) {
    throw new Error('Build the current app version before publishing apt.');
  }
  const record = debRecord(deb, authorized);
  const appImageName = `FluidEQ-${version}-x86_64.AppImage`;
  const appImage = path.join(build, appImageName);
  const appImageBytes = fs.readFileSync(appImage);
  const appImageHash = createHash('sha512').update(appImageBytes).digest();
  if (
    !readFeed(fs.readFileSync(feed, 'utf8')).sha512s.includes(
      appImageHash.toString('base64'),
    )
  ) {
    throw new Error('The AppImage differs from the signed Linux feed.');
  }
  const publicKey = path.join(assets, 'fluideq-archive-keyring.gpg');
  const siteApt = path.join(site, 'src/static/apt');
  const previous = fs.existsSync(path.join(siteApt, 'dists/stable/Release'))
    ? siteApt
    : output;
  let history: IAptPackage[] = [];
  if (fs.existsSync(path.join(previous, 'dists/stable/Release'))) {
    verifyRepository(previous, publicKey);
    const parsed: unknown = JSON.parse(
      fs.readFileSync(
        path.join(previous, 'dists/stable/repository.json'),
        'utf8',
      ),
    );
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid signed repository history.');
    }
    history = parsed as IAptPackage[];
  }
  const records = retainPackages(history, record);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-apt-stage-'));
  try {
    // Retain old content-addressed indexes while cached Release files can be
    // in flight. New release signatures/indexes replace only the staged copy.
    if (fs.existsSync(previous)) {
      fs.cpSync(previous, stage, { recursive: true });
    }
    writeMetadata(stage, records);
    ['fluideq-archive-keyring.asc', 'fluideq-archive-keyring.gpg'].forEach(
      (name) => {
        atomicWrite(
          path.join(stage, name),
          fs.readFileSync(path.join(assets, name)),
        );
      },
    );
    writeSetupDocumentation(stage);
    signRepository(stage, fingerprint, publicKey);
    if (!prepareOnly) {
      requireUnchanged(ROOT, revision);
      requireUnchanged(site, siteRevision);
      if (bootstrap) {
        publishLinuxGitHubRelease(
          version,
          build,
          path.join(stage, 'install.md'),
          revision,
          ROOT,
        );
      }
      await verifyPublishedAsset(
        packageUrl(record),
        record.size,
        record.sha512,
      );
      await verifyPublishedAsset(
        `https://github.com/${RELEASE_REPO}/releases/download/v${version}/${appImageName}`,
        appImageBytes.length,
        appImageHash.toString('hex'),
      );
      const remoteFeed = await fetch(
        `https://github.com/${RELEASE_REPO}/releases/download/v${version}/latest-linux.yml`,
      );
      if (!remoteFeed.ok) {
        throw new Error('No public signed Linux feed for this release.');
      }
      const publishedFeed = await remoteFeed.text();
      authorizeDeb(publishedFeed, fs.readFileSync(deb), path.basename(deb));
      if (
        !readFeed(publishedFeed).sha512s.includes(
          appImageHash.toString('base64'),
        )
      ) {
        throw new Error(
          'The public Linux feed names different AppImage bytes.',
        );
      }
    }
    // All authorization/signing checks finish before any served file changes.
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const next = `${output}.next`;
    fs.cpSync(stage, next, { recursive: true });
    if (fs.existsSync(output)) {
      fs.renameSync(output, `${output}.previous`);
    }
    fs.renameSync(next, output);
    fs.rmSync(`${output}.previous`, { recursive: true, force: true });
    if (!prepareOnly) {
      requireUnchanged(ROOT, revision);
      requireUnchanged(site, siteRevision);
      const nextSite = `${siteApt}.next`;
      fs.cpSync(stage, nextSite, { recursive: true });
      if (fs.existsSync(siteApt)) {
        fs.renameSync(siteApt, `${siteApt}.previous`);
      }
      fs.renameSync(nextSite, siteApt);
      fs.rmSync(`${siteApt}.previous`, { recursive: true, force: true });
      updateLinuxDownloads(site, version, build);
      execFileSync('pnpm', ['verify'], { cwd: site, stdio: 'inherit' });
      run('git', ['add', 'src/static/apt', 'site.config.json'], site);
      run(
        'git',
        [
          '-c',
          `user.name=${run('git', ['config', 'user.name'])}`,
          '-c',
          `user.email=${run('git', ['config', 'user.email'])}`,
          'commit',
          '-m',
          `Publish signed apt metadata for FluidEQ ${version}`,
        ],
        site,
      );
      run('git', ['push'], site);
      // The site's umbrella deploy also publishes its unrelated admin Worker.
      // Only the public site's assets belong to a Linux repository release.
      execFileSync('pnpm', ['cf', 'deploy'], {
        cwd: site,
        stdio: 'inherit',
      });
      if (bootstrap) {
        await checkLiveApt();
      }
    }
    process.stdout.write(
      `Signed apt repository ready at ${output}${prepareOnly ? ' (not published)' : '; published at https://fluideq.com/apt/'}\n`,
    );
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const reportFailure = (error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  };
  // Linux releases share build/output paths. An OS lock is released even if
  // signing is cancelled or the process dies; no stale application lock remains.
  if (process.argv.includes('--locked')) {
    publishApt().catch(reportFailure);
  } else {
    fs.mkdirSync(path.join(ROOT, 'release'), { recursive: true });
    try {
      execFileSync(
        'flock',
        [
          '--nonblock',
          path.join(ROOT, 'release/.apt-publish.lock'),
          process.execPath,
          '-r',
          require.resolve('ts-node/register'),
          __filename,
          ...process.argv.slice(2),
          '--locked',
        ],
        { cwd: ROOT, stdio: 'inherit' },
      );
    } catch (error: unknown) {
      reportFailure(error);
    }
  }
}
