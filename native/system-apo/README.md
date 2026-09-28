# Live DSP edits

An edit prepares a new graph on the watcher thread. At the next audio block
boundary, `Graph::adopt_state` transfers the running rack's histories into that
prepared rack using `feq_chain_transfer_state`. The new settings and coefficients
stay in place; delay buffers, dynamics envelopes, filter histories and loudness
measurements move with their owning storage. Dynamic-band configuration stays
with the new settings; only its envelope and amount carry over. No audio-thread allocation, deletion,
file access or wait is needed.

This prevents the measured failure where every DSP edit produced an entirely
silent first block, in both minimum and linear phase.

An edit that leaves everything the rack is built from alone — its values, game
mode as the EQ side asks for it, the room's head, the stream's format and block
size — builds no rack at all: the new graph runs the chain already running
(`Graph`'s `rack_from`, handed in by the watcher from the graph it published
last), so nothing is transferred either. Every edit publishes a graph as it
arrives, and a Room rack takes 13 to 43 ms to build, where every other preset
takes 1 to 3 ms and a transfer costs the audio thread at most 0.4 ms: a band
dragged on a Room preset was heard only every 100 to 135 ms inside audiodg
(2026-09-26). The chain is shared rather than moved, because the graph it
comes from may be the one the audio thread is running; one audio thread and
graphs freed only by the watcher, two blocks after they were superseded, are
what make that safe (`graph.h`). A shared chain's meters are never set again
from the watcher thread, since the chain's pointer to them is a plain one.

## Transfer contract

- Both chains must be idle, on the same audio thread between processing blocks.
  Neither chain may be configured concurrently.
- The destination is newly prepared, including the silent priming block in
  `build_rack`; neither chain has an unadopted kernel update.
- Sample rate, channel count and maximum block size must match. Denoise must be
  disabled, as it always is in the system engine. A mismatch returns zero without
  changing either chain.
- The destination keeps its settings. The previous graph keeps ownership of
  replaced resources and is reclaimed by the watcher after the existing grace
  period. It must not resume processing after transfer.
- A transferred chain is not subsequently configured in place. Each further
  edit prepares another destination. A completed convolution transition retains
  its retired kernels until graph destruction, off the audio thread. At most
  two sets can retire: the audible transition and its single queued replacement.
- A pipeline reset deliberately skips transfer. Turning the rack off or changing
  the stream format is not an ordinary parameter edit.

## Linear-phase parameter changes

An unchanged kernel keeps its running convolution history and any transition
already in progress. A changed kernel runs alongside the old one until its full
partitioned history plus output pipeline is filled, then uses the existing
sample-domain crossfade. Warming only one 512-sample partition switched to a
mostly empty 16,384-tap filter and caused another measured dropout. The Library
kernel-update path uses the same kernel-dependent warm-up calculation. An edit
received during an audible fade preserves that fade and queues the latest
replacement rather than jumping back to its original filter. Mono and selected
mid/side domains settle based on the channels actually processing the filter.

This does not yet solve switching from minimum phase into linear phase: that
changes the pipeline latency and still needs a separate live-path transition.
The slider checks test each phase, not that structural switch.

## Unchanged downstream filters

Graphic EQ and file-based IR convolution also survive a rack edit. Preparation
interns the actual kernel samples using exact equality, off the audio thread.
At adoption, matching immutable identities allow swapping each kernel together
with its already-running convolvers. Replacing an IR at the same path creates
a different identity when its samples change; a filename is not the identity.

## Regression coverage

- `engine-dsp-chain`: rapid DSP changes stay audible; an untransferred fresh rack
  is the silence-producing positive control.
- `chain-transfer`: unchanged settings match uninterrupted audio sample for
  sample with multiple processors enabled; changed EQ/trim reaches the requested
  result; both phase modes stay audible; incompatible streams are refused.
- The transfer test counts C++ heap allocations and releases during handover
  and engine processing, including linear-phase retirement, with a positive
  control that exercises both counters.

These checks do not replace listening on the installed engine. Build output is
not the DLL already loaded by Windows: applying the new build requires the normal
engine update permission prompt and Windows audio restart.
