# Share Audio group implementation

Rollback checkpoint: `2f8bb10d9` on `main`, pushed before implementation. It preserves
all source changes present at the start, including the existing Studio work.

## User interface

The application keeps its existing navigation. Share Audio now presents:

- **The whole group**: this computer first, then connected and offline computers
  in one canonical order. Names use NFKC normalization and code-point comparison,
  with the lasting computer ID breaking ties; connection order and OS locale do
  not change the order. A brief duplicate connection renders only one row.
- One real source waveform per computer, independent **Receive** and **Send**
  switches, and a three-dot anchored app menu with **Pause/Resume** and **Unlink**.
- **Your mix**: the OS default-output picker, **This PC** system volume, and
  independent incoming gains. Speaker buttons mute each mix and restore its
  remembered level. The slider/readout shows zero while muted. Moving a muted
  slider above zero unmutes it. There is no outgoing volume multiplier.

The page uses the existing Share Audio, Dropdown, Switch, AnchoredMenu, player
speaker icon and now-playing fader components/styles. The new stylesheet defines
geometry only. It stacks and scrolls in narrow panels. New text is translated in
all ten dictionaries.

## Connection and trust model

The implemented model is a mesh of trusted computers. It does not require an
online group owner, a relay or a new cloud service. A code still establishes the
first authenticated pair. Updated members negotiate group support using an
optional field on the existing `stream-mode` message; older versions ignore it
and retain their existing direct links. New message kinds are sent only after
negotiation.

Each linked member may introduce its other linked members. Introductions carry
public private-LAN coordinates and a credential scoped to one pair, never an
existing computer's permanent pairing secret/code. Pair credentials are derived
with HMAC-SHA256 from the introducing installation's secret and the two sorted
computer IDs. Concurrent introductions select the lowest issuer ID, and an active
session stays connected while its replacement credential is learned. Both sides
save pair credentials through the existing OS-encrypted credential store.

This is transitive trust: a linked, upgraded computer can admit the computers it
trusts. It is not a signed central membership authority. The original design
notes proposed an owner-controlled roster; the implementation instead uses
trusted introductions so membership and reconnects keep working when the first
computer leaves. A separately administered group with an owner and global
revocation would need an explicit product flow and separate authorization model.

A chain A–B–C–D grows direct links until each computer knows the other three.
Subsequent audio travels directly between pairs. Missing members remain in the
protected local book, and reconnect using their pair credentials and existing
LAN discovery. The first group description is explicitly answered, because the
listener's initial message may otherwise arrive before the joining transport
listener is attached. The current duplex description is repeated with that
handshake so a window reload retains Send/Receive state.

Network return and OS resume trigger fresh discovery and audio recovery without
button presses. Pending connection attempts are cancelled before a fresh probe;
healthy links stay up. Windows reacquires its capture lease after suspend. The
renderer reopens its mixer/sender on wake and retries failed audio when devices
return or the window is shown again. There are no timer loops. Paused connections
resume on reconnect, while Send, Receive, level and mute choices remain saved.

Introduced computers appear with **Receive off** until the listener enables it.
Direct manual pairing retains the app's existing initial behavior. Settings are
keyed by lasting computer ID, with a one-time migration of old name-keyed choices.
Two PCs with the same name no longer share a volume or switch setting.

Unlink acts on this computer's pair with the selected computer and leaves other
pairs running. Each end forgets that pair and refuses automatic reintroductions;
manual pairing is required to authorize it again. It does not remotely evict
that computer from everybody else's pairs. No permanent credential is exposed
through the renderer. Endpoint lists and group sizes are bounded, and introduced
addresses must pass the existing private-IPv4 policy.

## Audio and Windows behavior

Source capture remains local-origin audio only. Received audio is not relayed.
Windows retains the existing process-tree exclusion for the LAN playback helper
and its descendants. The Library's raw-sharing path and receiver-side DSP remain
in place. Platform capture/playback capability checks are preserved; this change
does not claim that an unimplemented platform backend can run both ways.

The local Share switch gates all outgoing targets without changing each pair's
Send setting or receiving. New links respect that gate. Receiver gain/mute is
applied independently per incoming stream. Muting one computer never scales the
raw source or another listener's mix.

The output picker changes the actual default output through the existing app
API. This keeps **This PC** aligned with the endpoint controlled by the Windows
volume helper, rather than displaying a different output while moving default
system volume.

The volume helper negotiates an `applied` response after querying the OS output.
Main sends one command at a time, coalescing queued drag positions and preserving
the order of mute and level changes. Renderer request IDs prevent older replies
from moving either the Share Audio slider or bottom-bar slider backward. A driver
may quantize the final level; its actual answer wins after acknowledgment.
Helper replacement changes the session ID so an abandoned write cannot pin a
slider forever. Old helpers retain the old protocol. Native notifications query
the current endpoint rather than replaying a stale callback snapshot. There are
no timer retries. Incoming mix writes similarly coalesce per computer while IPC
applies the previous change.

## Platform integration contract

Linux/macOS agents should retain the shared group protocol, stable computer IDs,
receiver gain/mute fields and independent local source gate. Keep their platform
capabilities truthful: system volume is unavailable until a backend reports a
real level, and receiving must never enter the capture stream. The shared layout
does not infer audio capability from a displayed OS name.

This change promises neither acoustic synchronization nor zero latency. Actual
cross-machine listening, capture exclusion on each OS and device-switch behavior
must be checked on the respective real computers.

## Browser preview and verification

Run `node docs/handoffs/shared-audio/preview.cjs`, then open
<http://localhost:4317>. `--build` compiles without starting the server. The
preview now renders the actual production Group and Mix components with simulated
I/O; it never captures audio or changes system volume. Its perspective picker and
Design tools are harness controls, not additions to the app menu.

Regression coverage includes a four-computer chain over real loopback TCP,
challenge authentication, encrypted PCM, concurrent introductions, loss of the
introducer, restart from saved pair credentials and unlink. Only discovery and
the private-address boundary are substituted in that test. Separate checks cover
untrusted introductions, bounds, canonical order, duplicate names, settings
migration, source gating, independent mute, queued mix writes and stale Windows
volume replies reaching two faders. Existing Share Audio transport, playback,
provider, wake/recovery, security and credential regressions remain in the verification set.

Loopback tests do not establish acoustic performance on multiple physical PCs.
The browser render verifies the actual components but does not replace checking
the Electron window and real sound after the user launches the rebuilt app.

## Verification recorded on October 24, 2026

- Production/native build, renderer rebuild, root and script type checks passed.
- The 34 audio, recovery, volume, style-cascade, localization and no-timer suites
  passed: 212 tests. The final menu-focus correction also passed its 15 page tests.
- Stylesheet compilation and UTF-8/encoding checks passed; 12 design-model checks
  passed. The real production UI components were inspected at normal width and
  with long names in a narrow scrolling panel, including slider drag and mute.
- The rebuilt Windows volume helper passed a live capability/applied-response
  check using an unchanged mute setting. The current level and mute were preserved.
  The native LAN-playback pipe smoke check passed without opening an audio device.
- The full repository run had five unrelated Studio suites still failing after
  the two Share Audio contract issues were corrected. Those Studio sources/tests
  are unchanged by this implementation. The saved checkpoint already failed its
  unit-test CI step: <https://github.com/StartSWest/FluidEQ/actions/runs/40112755588>.
- Live Electron-window verification and physical multi-computer listening remain
  pending. The browser preview and loopback test are not claims of those results.
