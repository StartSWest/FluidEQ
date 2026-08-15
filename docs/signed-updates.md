# Signed update boundary

FluidEQ updates are a capability of the official Windows build, not a general
feature of every package made from the source.

`pnpm package` has no publish provider and produces an unsigned installer. That
build never loads `electron-updater`, installs update listeners or timers, or
makes an update request. `pnpm package:signed` is the only path that adds a
provider. It requires all of these values in the packaging process:

- `FLUIDEQ_SIGN_ENDPOINT`
- `FLUIDEQ_SIGN_ACCOUNT`
- `FLUIDEQ_SIGN_PROFILE`
- `FLUIDEQ_SIGN_PUBLISHER`
- `FLUIDEQ_UPDATE_URL`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`

The first five values identify public release infrastructure. The three Azure
values are credentials and must remain only in the release environment. They
must never be added to webpack's environment plugin, `.env`, application source,
`app-update.yml`, or a Vercel client bundle.

At runtime the app asks Windows to validate `process.execPath` with
`Get-AuthenticodeSignature`, then requires an exact match with the publisher
compiled into the signed build. Only after that succeeds does it load the NSIS
updater. The updater is explicitly set to the compiled generic HTTPS feed; it
does not infer or fall back to GitHub. The same strict Authenticode check is
installed as `verifyUpdateCodeSignature`, so a missing signer, wrong signer, or
verification error rejects a downloaded installer before it can be installed.

## Vercel feed shape

The public form needs no app credential. `FLUIDEQ_UPDATE_URL` is the HTTPS base
URL at which electron-updater can read `latest.yml`, the `.exe`, and its
`.blockmap`. The packaging script validates that generated `app-update.yml`
contains that exact URL, the `generic` provider, and the exact publisher.

If the feed becomes private, the app-side boundary is the optional
`UpdateBearerTokenProvider` in `src/main/signedAutoUpdates.ts`. The website/API
implementation should use this minimal contract:

1. The app sends an HTTPS request to the product API using a device credential
   provisioned after entitlement is established. Store that credential with a
   Windows OS facility such as Credential Manager or DPAPI, not in the binary.
2. The API validates the entitlement and device, then returns an opaque token
   scoped only to reading one update feed. A suitable response is
   `{ "accessToken": "...", "expiresAt": "<ISO-8601>" }`.
3. The token should be short-lived (long enough for the installer download;
   normally 10-15 minutes), audience-bound to the update feed, and incapable of
   upload, delete, listing unrelated objects, purchase, or account operations.
4. Adapt the response to `UpdateBearerTokenProvider`, returning only the raw
   `accessToken`. FluidEQ refreshes it before each update check and supplies it
   through `autoUpdater.addAuthHeader("Bearer ...")`. If minting fails, the
   check is cancelled; it does not retry without authentication.
5. The same bearer header must authorize `latest.yml`, blockmaps, full and range
   requests for the installer, and redirects must remain on trusted HTTPS
   origins that preserve the authorization policy.

Never return or embed `BLOB_READ_WRITE_TOKEN`, an Azure signing credential,
Paddle credentials, a Vercel account token, or any other server secret. A Blob
read-write token grants far more authority than an updater needs and a secret in
an Electron application is recoverable by its user.
