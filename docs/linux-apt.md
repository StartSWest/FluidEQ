# Linux apt releases

The first apt package is **2.3.0**, named `fluideq`. The application remains
`fluideq-app` internally, so existing `~/.config/fluideq-app` settings survive.
Only electron-builder's `deb.packageName` changes. `Provides`, versioned
`Replaces` and `Breaks` migrate older GitHub-installed `fluideq-app` packages.
The package still contains `resources/package-type` with `deb`.

## Hosting and trust

The existing **FluidEQ-Site Cloudflare Worker** hosts `https://fluideq.com/apt/`.
Small signed metadata/public keys live in the website's `src/static/apt/`.
Generated Cloudflare `_redirects` rules send pool requests to immutable GitHub
Release assets. No Debian installer enters either Git repository or Blob.
Old versions remain in Packages and the pool redirect list; old content-addressed
indexes remain available for clients updating across a deployment.

The **new dedicated apt GPG key** is independent of the Linux Ed25519 update
feed key and Windows' update key. Its private half stays protected in the
owner's GPG keyring. Only `assets/apt/fluideq-archive-keyring.asc`, `.gpg`, and
the fingerprint in `key.json` are committed. Never export the secret key to
either checkout, CI, chat, command arguments or environment variables.

## First publication

The implementation does not ship a test key as a production trust anchor.
After the code changes have been committed and the website integration pushed,
one command completes the protected signing setup and first publication:

```bash
pnpm publish:apt --bootstrap
```

The command generates a strong passphrase and verifies it is safely stored in
the Linux login keyring (Secret Service), separately from the app's feed key.
GPG encrypts the dedicated apt private key with that passphrase. Secrets cross
to GPG and the keyring on standard input only; none is written to arguments,
environment variables, checkout files or logs. An unavailable/locked keyring
stops setup without falling back to an unprotected key. The command
commits/pushes only the exported public key through normal hooks, builds and
signs the Linux release, creates the Linux GitHub release if absent, verifies
its public Debian bytes against `latest-linux.yml`, signs apt metadata, then
verifies/commits/pushes/deploys the website. It preserves the previous Windows
`latest.yml` and its verified Windows installer byte-for-byte, so older Windows
clients can still resolve their unchanged download from a Linux Latest release.
The command clones the sibling website checkout if missing and installs its
locked dependencies. Cloudflare may open its own browser sign-in prompt;
credentials must never be pasted into chat. Publication requires clean app and
website checkouts. An existing website checkout can be selected with
`--site-dir /path/to/FluidEQ-Site`. Only the public site is deployed, leaving
the website's separate admin service alone.

If the key is already initialized, the command reuses it. It never implicitly
rotates a key or overwrites a release asset. A failed key operation, signature,
feed verification, remote asset check or website check stops publication.

## Every later Linux release

```bash
pnpm package:linux:release
pnpm publish:apt --site-dir /path/to/FluidEQ-Site
```

Publish the matching Debian/AppImage and signed `latest-linux.yml` on GitHub
before the second command. `--bootstrap` can perform that release publication
too. `--prepare-only` writes a locally signed repository without publishing;
`--deb`, `--feed` and `--output` select explicit local inputs/outputs.
The generator rejects unsigned/unknown-key feeds, a size/SHA mismatch, a
different package/version, missing migration fields and mutated release bytes.
The exact setup block is emitted as `/apt/install.txt`, `/apt/install.md` and
GitHub release notes, and covered against the README by a regression check.

`Release` has a one-year validity. Refresh/sign/publish before it expires even
if no new application version is released. Expiry is also bounded by the GPG
key's two-year lifetime; rotate deliberately before that date, publishing both
old/new public keys during migration. An expired repository must never be
worked around with `trusted=yes` or disabled signature checks.

## Updates and removal

`sudo apt upgrade` selects the newest published version. The in-app Debian
updater installs the same signed-release bytes through apt, outside the app's
no-new-privileges process tree, without downgrade/authentication bypasses.
If apt installed a newer version while an older running app downloaded an
update, apt refuses that stale install. Password cancellation remains a failure.
The package does not silently edit apt sources on installation; the documented
setup is explicit and repeatable. Purging the app does not delete user-created
repository configuration or settings. Remove only the two files created by
setup if opting out of apt updates:

```bash
sudo rm /etc/apt/sources.list.d/fluideq.sources /usr/share/keyrings/fluideq-archive-keyring.gpg
```

An explicit downgrade is possible with `sudo apt install fluideq=<version>
--allow-downgrades`. This is an administrator's deliberate choice, not an
automatic app operation. apt/dpkg locks serialize concurrent package changes.
