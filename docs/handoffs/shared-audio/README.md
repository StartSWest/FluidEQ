# Share Audio: shared group proposal and working preview

Based on `main` at `4acdc53e4`, pulled on October 23, 2026.

This is the design step requested before implementing the shared and Windows
changes. Production capture, playback, pairing, IPC and settings are unchanged.
The English preview lives outside the application entry points. Its controls,
connections and waveforms are simulated; it does not establish real connections
or capture/play audio. Localization of the selected production design belongs in
all ten dictionaries when that implementation is made.

Run from the repository root:

```powershell
node docs/handoffs/shared-audio/preview.cjs
```

Open <http://localhost:4317>. `--build` compiles without starting the server.
Build output goes into the ignored `build/` directory. No new dependencies.

The preview imports the current app's `App.scss`, `Button.scss`, `RemoteAudio.scss`,
`MenuIcon`, `Switch`, `RemoteAudioLane` and `RemoteAudioLinkCard`. **Current app
cards** renders the actual current card component with simulated inputs.
**Proposed group** adds the local card, shared roster and group overview using
those same controls and surfaces.

Try these interactions:

1. Change **Viewing as** among Windows, macOS and Linux. The local computer moves
   to the top; all others retain their relative canonical order. Offline members
   stay visible in their ordinary position.
2. Lower the Mac's receive volume on Windows. Switch to Linux: its receive
   volume is independent. Switch back to Windows: its setting is retained.
3. Stop sending Windows audio to Mac. In the Mac view, Windows says **Sender
   switched off**. Mac-to-Windows and the other routes continue.
4. Pause a pair or the local computer. Resume restores the existing switches
   and levels. A pause at the other end cannot be undone by resuming here.
5. Add a simulated computer. It appears in every view, with receiving off until
   each listener opts in. Remove it and it disappears from the shared roster.
6. Try offline, missing capture access, a long name and **Narrow panel**. Capture
   access affects outgoing sound; receiving can continue independently.

## What the updated application actually has

The pulled commits replace the previous single host/joiner role with simultaneous
listening and multiple joins. One permanent code can already accept several
computers; duplicate connections are reduced and unlinking targets one computer.
The sender lifecycle also received fixes in the second pulled commit.

That is a useful foundation, but **multiple direct links are not a shared group**.
If A links to B and B links to C, A and C do not acquire each other's membership
or connection information. The transport sends audio only to an explicitly
selected connected peer; it does not forward other computers' sound.

Current gaps visible in the code:

| Current behavior                                                           | Proposed change                                                              |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Each PC stores its own identity, pasted codes and revocations              | One authenticated group roster replicated to every member                    |
| The page renders connected links, then separately remembered missing joins | Render membership first, including this PC and offline members               |
| Link views follow map insertion order                                      | One locale-independent canonical ordering rule, with local pinned first      |
| Switch changes and remembered preferences match a display name             | Key everything by lasting computer ID and directed route IDs                 |
| Received level is local; source level has no group control                 | Keep per-source local receive levels, add one local send master              |
| Old peers can lack duplex capabilities                                     | Negotiate group capability; keep incompatible peers in explicit legacy links |

Evidence: `src/main/remoteAudioLan.ts`, `remoteAudioLanJoins.ts`,
`remoteAudioTransport.ts`, `remoteAudioCredentials.ts`,
`src/renderer/remoteAudio/linkRecords.ts`, `RemoteAudioContext.tsx`,
`RemoteAudioPanel.tsx` and `src/common/remoteAudio.ts`.

## Recommended connection model

**A shared group for identity and membership; direct connections for audio.**
Joining the group once gives a computer the authenticated membership list.
Every member then establishes its own authenticated direct links to the others.
The computer used to invite it does not relay its audio.

Start with one membership authority: the group creator. This computer approves
admission/removal and signs monotonically versioned roster snapshots. Peers
replicate and exchange those signed snapshots, reject stale versions and retain
removal records. If that computer goes offline, established members keep their
direct audio connections; membership changes wait for its return. The product
must show that state on Add/Remove. Transfer authority explicitly before removing
the owner. Automatic authority failover is a separate design problem, not an
implicit promise of this first version. This avoids inventing an unreliable
distributed consensus mechanism while fixing the actual pairing problem.

The preview models the resulting roster and routing behavior in one process.
It does not implement admission, authority transfer, replication or partitions.

### Stable identity and admission

- Give each installation a lasting random ID and identity key independent of its
  hostname, address, port and rotatable invitation secret. A display name is
  never an authorization identity or settings key.
- A group invitation identifies the group and its pinned authority key, is
  bounded in use, and requires approval of the joining computer's identity.
  Exchanging the invitation is the bootstrap; discovering a hostname is not.
- The signed roster contains public identity keys, IDs, display names, platform,
  capability versions and address candidates. Never copy another computer's
  permanent pairing secret or private identity key into a roster or discovery
  announcement.
- Authenticate a new direct connection against both membership identities and
  derive a fresh pair session key through a standard reviewed handshake.
  Existing AES-GCM packet framing can remain where compatible; the current
  pairing-secret handshake is not automatically group authentication.
- Deduplicate on the unordered ID pair, using one deterministic connection
  initiator and the existing authenticated-address racing. Session peer IDs
  remain connection-local and may change on reconnect.
- Removing a member revokes group admission. Close its direct connections on
  receipt of the newer signed roster; refuse its old credentials. During a
  network partition immediate global revocation cannot be guaranteed. Do not
  advertise it as immediate on an unreachable PC.

### Membership, discovery and order

Keep **membership**, **reachability**, **connection** and **audio activity** as
different facts. An offline member remains in the roster and keeps its controls.
A connected computer can be silent, denied capture access, sending to nobody or
receiving only. A shared roster is not proof of a working direct audio path.

For a canonical order, compare the shared display name after NFKC normalization
and locale-independent lowercase, then the persistent ID as a tie-breaker.
Pin the local ID first only in that computer's list. Do not sort by platform,
online status, local locale, connection time or recent activity. The group
overview uses the canonical order without pinning so it is identical everywhere.

Keep the existing private-LAN discovery for the first implementation. Resolve
the address candidates of authenticated members across adapters and DHCP changes;
retain explicit/manual addressing when broadcast is blocked. DNS-SD is a later
interoperability option, not a prerequisite for the roster change. Its service
discovery specification does not supply group authorization.

### Routes, levels and ownership

One route is `(sourceComputerId, destinationComputerId)`. A and B have two
independent routes. The source owns **Send**; the destination owns **Receive**
and its receive volume. Each side publishes its own versioned settings; a peer
cannot overwrite another computer's choice. Reconnection descriptions must not
be treated as fresh user actions.

An audible route requires both members online, a ready capture source, the
source's master sharing switch, its route Send switch, the destination's Receive
switch, and no pause at either end. A blocked route says whose choice or failure
stopped it. Zero volume is a mute, distinct from forgetting the route.

**Send level** changes this computer's shared source for all destinations. A
remote receive fader changes only that source in this listener's mix. Local
speaker/headphone output volume remains separate. Apply gain smoothly, retain
Float32 transport, keep the original source available to the local speaker, and
do not describe attenuated/resampled/mixed playback as bit-identical to capture.

Pause preserves switches and levels. Each computer owns its pause; resuming here
cannot undo a pause over there. The preview's pair pause stops both directions
for that local pair. Its local pause stops this computer's group sends/receives.
New members are known to everyone immediately after roster propagation, but
receiving their sound starts only after each listener enables it.

## Shared code and Windows implementation map

| Area                                                     | Concrete change                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/remoteAudio.ts` and a new shared group model | Versioned member/capability/route contracts; ID-only selectors; canonical ordering; explicit owner of every setting                                                    |
| `src/main/remoteAudioCredentials.ts`                     | Migrate name-keyed preferences and existing links without merging duplicate names; persist group identity/roster and private keys through existing protected storage   |
| `src/main/remoteAudioLan*.ts`                            | Group admission, signed roster validation and replication, direct link formation, pair deduplication, reconnect and revocation                                         |
| `src/main/remoteAudioTransport.ts`                       | Capability negotiation before new message kinds; bounded queues; one slow peer must not stall the rest                                                                 |
| `src/main/ipc/remoteAudio.ts` and bridge                 | Snapshot/events for membership, local/remote route state and capability errors, all addressed by stable IDs                                                            |
| Renderer provider, link records and mixer                | Project group state into local/remote cards; preserve route choices on reconnect; per-source receive gain and local send gain; subscriptions separate from fast meters |
| Share Audio panel and dictionaries                       | Local-first cards, consistent peers, group actions and permission/offline states; translate final design in all ten locales                                            |
| Native Windows capture/playback                          | Retain the dedicated received-audio playback process tree, capture once, fan out only the local source, and verify independent receive streams and output changes      |

For Windows, the existing capture uses process loopback excluding the playback
helper's process tree. Preserve that topology: the received mix and mirrors must
stay in the excluded tree, and legitimate local app/Library audio must still enter
the local source once. Never fix feedback by subtracting audio waveforms or by
forwarding the received mix to the network. Microsoft explicitly supports
excluding a target process tree in its application loopback capture sample.

The Linux and Mac implementations should consume the same source contract:
**local-origin samples only**, a stable stream ID and sample format, capture
readiness/error events, and a separate sink for received sources. Advertise
`canExcludeReceivedAudio`, `canCaptureLocalAudio` and `canPlayReceivedAudio`
capabilities rather than deriving duplex support from an OS name. If a backend
cannot exclude received sound, report that limitation and prevent feedback-prone
duplex routes there. OS permission UI belongs to the respective adapter.

The preview's **Current app cards** comparison is a component comparison, not a
simulation of the old pairing protocol. The proposed group replaces the page's
direct-link list only after the shared contracts and backend are ready.

## Implementation and acceptance order

1. Agree on the visible model in this preview. Freeze member, capability and
   route contracts for the Linux/Mac adapters before implementing platform code.
2. Add shared model tests for shuffled arrivals, duplicate names, reconnect ID
   changes, each gate, pause ownership, gain independence and legacy negotiation.
3. Implement the signed roster and real three-PC join test: A invites B, B
   introduces C through the group authority; all display A/B/C and establish the
   direct A–C connection without another permanent pairing code paste.
4. Wire the renderer and gains; test output changes, source changes, capture
   access loss, sleep/wake, adapter changes and removal while one member is away.
5. Verify Windows native feedback prevention and one-capture fan-out; integrate
   the Linux/Mac source/sink adapters against the frozen capability contract.
6. Run real three-OS playback: simultaneous different sources, one-way routes,
   every direction, mute/volume/pause, process restarts and one slow peer. Record
   actual capture/playback errors, drops and queue measurements, then listen for
   feedback, clicks and unintended changes to other listeners.

Full mesh is appropriate for a small group of personal computers. At 48 kHz,
stereo Float32 is 3.072 Mbit/s per active direction before overhead. Four fully
active computers have six pair connections and twelve directed streams, or
36.864 Mbit/s of aggregate source traffic. Fan out one capture; send no unwanted
streams; budget and bound each peer independently. Larger groups or constrained
Wi-Fi may need another transport or relay design after measurement.

This design does not promise synchronized room speakers or zero latency.
Multi-computer playout synchronization needs stream timestamps, clock-offset and
drift estimation, scheduled playout and measured compensation. Queue duration
alone is not an acoustic synchronization measurement. Treat that as a separate
acceptance track if playing several speakers together is required.

## Primary references

- [Microsoft application loopback capture sample](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/)
  documents inclusion/exclusion of a target process tree.
- [RFC 6763: DNS-Based Service Discovery](https://www.rfc-editor.org/info/rfc6763/)
  defines service discovery; it does not authenticate membership in this group.

## Verification of this design artifact

The preview's model checks cover ordering, independent directed routes, gain
ownership, pause ownership, offline/access states, addition/removal and duplicate
names. Browser checks cover perspective changes, route switches, receive level,
shared addition, narrow layout and long names. These checks verify the mockup;
they do not verify networking or cross-platform audio.
