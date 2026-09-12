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
package. Server-side access hardening and previews that do not deliver shaders
are separate work; neither should be represented as solved by local encryption.
