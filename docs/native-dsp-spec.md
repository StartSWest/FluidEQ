# The native DSP host

FluidEQ's library audio is processed by a separate native executable rather
than by the renderer. This is the contract between them.

The authority for every name and number here is code, not this file:

- `src/main/dspHost/wire.ts` — the protocol version, the command table and
  every frame encoder and decoder
- `native/dsp-host/src/wire.h` — the same layout on the C++ side, pinned with
  `static_assert` and checked against the TypeScript by
  `dspHostWireLayout.test.ts`
- `src/common/dsp/analysisWire.ts` — the analysis frame, whose payload is sized
  by constants held in `native/dsp-core/include/fluideq/meters.h`
- `src/common/dsp/nativeParameters.ts` — the numeric parameter table
- `src/common/dsp/diagnostics.ts` — the diagnostic codes, shared with the
  current AudioWorklet engine

Where this document and those modules disagree, the modules are right.

## Why a process and not an addon

A Node addon would put the real-time audio thread inside the renderer's own
process, which defeats three of the four things the split is for. A separate
executable is isolated from a renderer crash, does not depend on Electron's
Node ABI, can hold real-time thread priority and own the audio device
directly, and can be restarted and health-checked on its own. An addon remains
fine for offline tests and tools; it is not the real-time path.

The decisive constraint is that **PCM never crosses a process boundary**. The
host decodes, processes and plays. Only control packets and telemetry travel.

## Shape

```text
renderer ──control──▶ Electron main ──control──▶ dsp-host
         ◀telemetry──              ◀telemetry──
```

Main supervises the host and is the only side trusted with file paths and
device handles. The renderer never addresses the host directly and never holds
a synchronous handle to it.

Inside the host:

| Thread              | Work                                                  |
| ------------------- | ----------------------------------------------------- |
| audio callback      | decks → crossfade → dsp-core → device                 |
| control             | validates settings, builds immutable snapshots        |
| decode / read-ahead | current and next track, bounded ahead of the playhead |
| analysis            | whole-track LUFS, true peak, FFT for graphs           |
| kernel              | linear-phase kernels and partition preparation        |
| telemetry           | drains lock-free rings, formats diagnostics           |

The callback is **one** thread. Splitting a 128-frame block across workers
creates synchronisation deadlines shorter than the DSP they are meant to
accelerate. Other cores do work that is allowed to finish late.

## What the callback may not do

No allocation, no free, no growing a container, no string formatting, no
logging, no filesystem, no mutex another thread can hold, no waiting on a
future, no settings parsing, no exception, no OS IPC, and no call into
Electron, Node or JavaScript. Every buffer is sized at stream start against
the maximum negotiated block, and block size is treated as variable up to that
maximum.

Coefficients and sensitive filter state stay double precision, matching the
`Float64Array` the TypeScript reference uses. The host boundary is planar
float.

Global fast-math stays off: invalid-sample repair and true-peak safety depend
on IEEE behaviour. `-ffast-math` tells the compiler a NaN cannot occur, which
deletes the very branch that catches one.

RTTI is disabled. **Exceptions are not** — this document originally asked for
both, and both was wrong: the MSVC standard library is unsupported with
exceptions off, and `std::vector`'s allocation failure has nowhere to go
without them. The invariant that actually matters is narrower and is held by
hand: nothing inside `feq_engine_process_planar` allocates, so nothing in it
can throw. The allocating entry points are `create` and `prepare`, and neither
runs on the audio thread.

## Control

Every request is asynchronous, versioned, and ordered within one engine
session. The envelope is `INativeControlRequest`; the reply is
`INativeControlAck`.

`engineSessionId` identifies one run of the host. A reply carrying a stale
session id, or a revision older than what the store already holds, is dropped
— that is what stops a slow reply from undoing a fast one.

Two paths, and the difference matters:

- **`dsp.applySnapshot`** — presets, imports, reset, any multi-control change.
  The whole clamped chain is prepared off the audio thread and becomes audible
  at one block boundary. No stage may ever observe half a preset.
- **`dsp.setParameter`** — one control moving. Carries a numeric id, an
  optional band index and a value. The host keeps only the newest update per
  `(id, index)` and the processor smooths toward it. A drag publishes at most
  once per animation frame and always publishes its final value.

The UI updates its own store optimistically and never blocks a pointer event
on an acknowledgement. A rejection publishes the host's sanitized value back,
so a dial cannot be left showing a number the engine is not using.

Commands are numbered, not named: `HOST_COMMANDS` in
`src/main/dspHost/wire.ts` and `FeqWireCommand` in
`native/dsp-host/src/wire.h` hold the same table, and the frame carries the
number. Ids are append-only for the reason `FEQ_WIRE_PROTOCOL_VERSION` exists —
an added kind is a breaking change here, because an unknown magic is fatal to
the reader by design.

A command that carries a variable-length payload states its own length in
`parameter_id` (or, for `RENDER_TO_FILE`, in `value`). The host checks every
one of those against the ceiling the encoder can produce before allocating for
it; a length outside its range means the two sides disagree about where the
frame ends, and the stream is not recoverable from that.

### Structural versus continuous

A parameter marked `structural` in the table rebuilds something — a
coefficient set, a linear-phase kernel and its partitions, a resampler, a
routing topology. Those are prepared on a worker and swapped whole. Everything
else is a value the running processor ramps toward within a block.

`prepare` may allocate. `commit` publishes an immutable snapshot the audio
thread adopts at a block boundary. Retiring the old snapshot happens outside
the callback.

### What stays in TypeScript

Presets are data and resolve in the renderer. Selecting one produces a single
`dsp.applySnapshot`, never twenty parameter calls. `clampDspSettings` in
`chain.ts` remains the only authority on what a value may be, and the native
core is promised a snapshot that has already been through it — which is why
the parameter table carries no ranges of its own.

Also staying: UI, localization, the library queue, persistence and
import/export, and static response curves that are cheaper to derive from
settings than to measure.

## The renderer boundary

The renderer reaches the host only through main, on `dsp-host-*` channels
registered by `src/main/ipc/dspHost.ts`. It never sees the executable's path —
not as an argument, not in a reply. A channel that accepted one would be a
channel for running any program on the machine, and the renderer is the half of
this app that loads remote content.

Everything arriving at those channels is validated again even though the
renderer already clamped it. `clampDspSettings` runs in a process that also
renders a web page, and the process boundary is exactly where "already checked"
stops being a fact and becomes an assumption. A snapshot with one bad value is
refused whole rather than repaired: guessing which value was meant is how a
preset silently becomes a different preset.

Registering the channels starts nothing. The host is spawned when the renderer
asks, which it does when something is about to be heard, and it is stopped on
`before-quit` — `will-quit` is already too late to wait for anything
asynchronous. A checkout that has never built the native target reports the
engine unavailable and the TypeScript one carries on.

Telemetry is not forwarded to a minimised window. Forty frames a second would
each become an IPC message, a deserialisation and a store write for a surface
Chromium is not compositing — the same reasoning that stopped the AudioWorklet
building meter frames behind a hidden window, one boundary further out.

The preload bundle imports only types from the supervisor, so it does not pull
`child_process` in behind them. That is asserted by grepping the built bundle,
because it is the kind of thing that regresses silently on an import nobody
looked at.

## Telemetry

The audio thread accumulates fixed-size statistics into a preallocated
single-producer/single-consumer ring. The telemetry thread drains it and
publishes at a bounded rate, 20–30 Hz initially. React receives one external
store publication per frame — never one state update per field — and graphs
interpolate between frames.

`INativeTelemetryFrame` covers every meter the app currently draws. Two fields
exist because of specific past failures:

- The Master gains are published **separately** — manual output, loudness
  correction, auto headroom, and the applied result. Added together, a ceiling
  winning and a target being met are indistinguishable, and the panel cannot
  answer "why is it quieter than I asked for".
- Callback cost is published as p50 and p99 against the device deadline, not
  as a mean. One block in a thousand overrunning is an audible click and moves
  a mean by nothing.

A frame that fails validation is dropped, never repaired. A repaired frame is
a reading nobody took, and a meter must not invent one.

## Device lifecycle

The host process may stay alive with its device stream closed. Opening the
stream is what wakes the endpoint, so it opens on playback and not before.
This mirrors the rule the renderer engine now follows: a graph built at mount
stays suspended until a deck is actually playing.

`open` and `start` are separate calls. The negotiated rate is not known until
the device has been asked, and the engine has to be rebuilt around it before a
single callback arrives — fused into one call, the first period would run
against an engine still sized for whatever the last device wanted. The chain
snapshot is re-applied across that rebuild; a device preferring 44.1 kHz is not
the user asking for their settings back at defaults.

### Windows: shared-mode WASAPI

Nothing is installed and nothing is privileged. WASAPI is a user-mode COM API
that ships with Windows, `ole32` and `avrt` are already on every machine, and
the host opens the default endpoint exactly the way any media player does.
**Equalizer APO lives further down**, inside the endpoint's own processing
chain, so audio written here passes through it afterwards — the same
relationship the Web Audio path already has, unchanged.

Exclusive mode is deliberately not used: it would take the endpoint away from
every other application, which for a system equaliser is precisely backwards.

The render thread registers with MMCSS as `Pro Audio` rather than raising its
own priority. A priority bump makes a thread compete harder; MMCSS tells the
scheduler what kind of work it is, which earns a guaranteed slice and an
exemption from the throttling applied to ordinary busy threads. Failing to
register costs headroom, not correctness, and is not fatal.

Shared mode does not report render glitches, so the underrun count is a stated
proxy: the endpoint had drained completely by the time the thread was woken,
meaning it played silence nobody wrote. It is counted from the second period
onward, because the first is empty by definition.

A stereo programme on a wider endpoint fills the front pair and leaves the rest
silent, as every other stereo application does. An endpoint that does not mix
in 32-bit float is refused with a reason rather than converted quietly.

System-output loopback — the capture behind the live graphs, and the only way
FluidEQ sees Spotify or YouTube — is separate from playback and is
reference-counted by its consumers. It is analysis-only and must never be
routed back to the endpoint it captures.

Moving library DSP into C++ does **not** apply FluidEQ's filters to other
applications. That is a virtual-device project; Equalizer APO remains the
Windows system-EQ path.

## Failure

Main starts the host lazily and performs the version handshake before sending
any settings. A host whose handshake reports a different protocol version, or a
different parameter count, is refused outright rather than discovered later on
an unknown command.

The transport is the child process's **stdio**, carrying fixed-size binary
frames — not the named pipe with a per-launch token this document first
described. A supervised child's stdio is private by construction: there is no
endpoint on the machine for anything else to connect to, so there is no token
to mint, pass or leak. The host earns a real endpoint the day it needs to
outlive its parent or serve a second client, and not before.

Frames are binary rather than JSON because the alternative was a hand-written
JSON reader in C++ — a parser that fails by misreading a field rather than by
refusing it. Layouts live in `native/dsp-host/src/wire.h` under `static_assert`,
and are mirrored in `src/main/dspHost/wire.ts`; the assertions exist because
those sizes were computed by hand and two of the four were wrong.

If the host exits unexpectedly, the exit is reported and a replacement is
started — but only **three times inside a minute**. A supervisor that restarts
on every exit turns one reproducible crash into an endless loop of them,
burning CPU and filling a log with the same stack while the user watches an app
that never works. Past the budget the engine is marked failed, one diagnostic
is surfaced, and it is left alone: a failure reported once can be fixed, a
failure buried under nine hundred identical retries cannot.

A replacement is brought back to where the last one was — the chain snapshot is
re-sent and the device reopened if it was open. A host that returns with a flat
chain is indistinguishable, from the panel, from an engine ignoring every
setting on it.

Commands are never queued for a host that is not running; they are refused.
An acknowledgement carrying a request id the supervisor no longer knows is
dropped, because applying it would act on state the new host has never seen.

Diagnostics use codes 3001–3005 in `src/common/dsp/diagnostics.ts`, appended
rather than interleaved: these reach support reports, and renumbering would
make an old report describe a different fault than the one that happened.

During migration, falling back to the TypeScript engine happens only through an
explicit transport handoff — the two backends must never both be playing.

Heartbeats and health checks are control-thread work. The host's stderr is kept
in a bounded tail apart from the renderer's log, and its pid is exposed, because
a crash dump on the machine is only matchable to a session by that number.

## Acceptance

Native does not become the default until all of this holds:

- zero underruns in a 30-minute stress run
- no renderer long tasks attributable to DSP
- UI responsive during 15-band dragging, preset changes, analysis, crossfade
  and linear-phase updates
- p99 callback under 50% of the device deadline on the low-end reference
  machine
- no allocation and no lock contention in an instrumented callback build
- rapid Next/Previous cancels obsolete decode and analysis
- memory plateaus across repeated track changes
- parity against the TypeScript reference within agreed per-processor
  tolerances

Benchmark every supported rate. At 48 kHz a 128-frame block is about 2.67 ms;
at 192 kHz it is about 0.67 ms, and passing at 48 says nothing about 192.

Parity fixtures cover silence and near-denormals, impulses, sweeps and sines
at every crossover, seeded broadband and pink noise, stereo/mono/mid/side and
anti-phase, DC and invalid samples, intersample true-peak probes, transients
into silence, every shipped preset, both phase modes, isolate and root bypass,
at 44.1 through 192 kHz and 1×/2×/4×.

Bit-identical output across compilers is not required. Every null test needs a
positive control proving the harness can still detect a deliberately broken
processor — a null test that returns zero for every input passes perfectly and
means nothing.

## Not in this document

How the host is built, signed, packaged or published. That lives outside the
repository.
