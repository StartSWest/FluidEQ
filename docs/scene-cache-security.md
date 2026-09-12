# Scene files on disk

Playback copies added from Studio or the Plus gallery are encrypted with the
operating system's key store. Official envelopes, imported member envelopes,
and the user's own graph copies all use this storage. Original Studio projects
remain editable; deliberate exports of the user's own work are separate files.

The cache contains a versioned ciphertext, not an executable or an exported
scene package. Its decrypted contents are bound to the scene identity and cache
kind. Signed scenes still have their signature, author/id and scene rules
checked on every load. Encryption does not make untrusted content safe.

Existing valid plaintext cache entries migrate atomically when listed or loaded.
Migration checks the old content, verifies an encryption/decryption round trip,
and writes only ciphertext to an exclusive temporary file before replacing the
old entry. A failed migration preserves the previous file and refuses playback
through that read. There is no plaintext fallback if the OS key store is locked,
unavailable or using Linux's `basic_text` backend. A successful read later retries.
Invalid or unreadable encrypted files are retained, not mistaken for a request
to discard someone's last offline copy. This is not secure erasure of old disk
blocks, backups, exports or copies someone already made.

Encrypted copies can be read offline after restarting under the same OS profile.
Existing Plus entitlement rules still apply. Unpublishing does not erase the
copies already added. Losing the OS profile/key store can make a cache unreadable;
an encrypted cache is not a portable project backup.

Official encrypted files use `.pack.enc`; `.pack.json` is only a migration
source. Older versions enumerate and delete unrecognized `.pack.json` files,
so storing ciphertext at that old name would destroy offline copies after a
downgrade. Both plaintext and the first encrypted format migrate into the new
name, with the source removed only after an atomic encrypted write succeeds.
An existing protected copy takes precedence, even when its key is locked;
there is no fallback to a stale legacy file. Explicit removal removes both
names. Member readers already retain unrecognized files, so their encrypted
own/imported paths do not need this change.

## Security boundary

This is **encryption at rest, not an anti-copy guarantee**. There is no universal
scene decryption password or private signing key embedded in the app. On Windows,
DPAPI binds encryption to the OS user, not exclusively to FluidEQ: another process
under that user may decrypt it. The WebGL renderer also needs plaintext shader
source in memory. A user controlling that process can extract it. See
[Electron's safeStorage security model](https://www.electronjs.org/docs/latest/api/safe-storage).

This change does not alter Supabase storage policies, the signed network package,
the preview API, or the rights granted by publication terms. In particular, it
does not prevent an authorized API caller from obtaining the currently served
package. Live previews remain client-rendered by product decision: no video,
extra remote-rendering service or duplicate preview files. Signed-in non-Plus
accounts can therefore obtain a published preview's shader as well. The ten
seconds and Add-to-graph restriction are app behavior, not a server-enforced
anti-copy boundary. Requiring Plus for the same payload would remove those
live previews; obscuring URLs or rewrapping the payload does not fix that.

## Access and storage review (2026-09-12)

Reviewed the repository policies and publishing handlers, not a fresh live
database dump. Anonymous preview access is revoked; the member bucket is
private. Member reads require a published row and exclude blocked scenes and
banned authors. Official publishing requires a server-managed publisher
capability. Publishing/signing requires paid entitlement, accepted terms,
member-source validation and an account that is not banned. The app rechecks
the account and entitlement before installing a downloaded scene, and verifies
the signed author and scene ID. None of these checks make a bearer token
exclusive to the unmodified app.

Existing publication limits remain: 64 KiB shader, 6 MiB embedded WebP artwork
(bounded dimensions), 512 KiB gallery cover, and 10 MiB total publishing request.
Images are WebP; updates overwrite the same object paths instead of storing a
new full scene per version. No video objects or new storage requirements are
introduced by the cache/navigation fix. The encrypted offline copies live on
the user's computer, not as additional Supabase objects.
