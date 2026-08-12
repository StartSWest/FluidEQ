# FluidEQ Karaoke — commercial licensing strategy

Status: engineering licensing plan, not legal advice
Reviewed: 2026-08-10

## 1. Selected commercial model

FluidEQ's repository is licensed under GPL-3.0-or-later and `NOTICE.md` records
that it is a modified version of AQUA, also GPL-3.0-or-later. The history has
multiple contributors. FluidEQ also distributes Equalizer APO as a separate
GPL-2.0-or-later program and already maintains a corresponding-source release
process for it.

The GPL permits selling copies. It also requires compliant distribution of the
corresponding source and preserves the recipient's rights to modify and
redistribute the program. A customer who buys a GPL build may lawfully share
that build under the GPL; a seller cannot require every recipient to pay again.
See the [GNU GPL FAQ on selling copies](https://www.gnu.org/licenses/gpl-faq.en.html#DoesTheGPLAllowMoney)
and [commercial distribution](https://www.gnu.org/licenses/gpl-faq.en.html#DoesTheGPLRequireAvailabilityToPublic).

FluidEQ will use one commercial model:

- `fluideq.com` sells the official signed installer and may include updates,
  support, installation, and other services in the price;
- the complete corresponding source for every sold release remains publicly
  available in the FluidEQ GitHub repository under GPL-3.0-or-later;
- customers retain the GPL rights to inspect, modify, build, and redistribute
  the covered software;
- website terms, an installer agreement, or an EULA must not add restrictions
  that contradict those GPL rights.

The value sold is the trusted official build, signing, delivery, updates,
support, and FluidEQ service/brand experience—not exclusive access to source
code. The public repository does not require the official compiled installer to
be offered without charge.

Every binary release gets an immutable Git tag and a source archive matching
that exact binary. A moving `main` branch is not sufficient release evidence.
The download page on `fluideq.com` links the paid binary/version to that exact
source tag/archive, license, notices, and reproducible build instructions.

## 2. Dependency acceptance policy

### Preferred permissive licenses

- MIT
- ISC
- BSD-2-Clause / BSD-3-Clause
- Apache-2.0
- CC0 / verified public domain

These generally permit commercial use and redistribution while requiring
notices and, for Apache-2.0, its license/NOTICE and patent-related terms.
Every exact package version and its complete transitive dependency tree still
needs review.

### Accepted GPL-compatible copyleft licenses

- GPL-3.0 / GPL-3.0-or-later.
- GPL-2.0-or-later when the selected version can be conveyed compatibly with
  FluidEQ under GPLv3.
- LGPL-2.1 and LGPL-3.0 variants, with exact replacement/relinking, modification
  source, notice, and reverse-engineering requirements implemented.
- MPL-2.0 only after verifying that the selected files do not disable compatible
  secondary licensing and after preserving its file-level source obligations.
- A separate GPL/LGPL executable only with its exact source, build configuration,
  license, notices, and a documented process boundary.

Copyleft is not a commercial-use problem for this model because FluidEQ itself
is publicly distributed under GPL. It is still an engineering/release
obligation and must be audited before installation.

### Rejected or separately escalated

- GPL-2.0-only code combined with the GPL-3.0-or-later application. A genuinely
  separate program is evaluated on its own boundary, as Equalizer APO already is.
- AGPL dependencies without explicit approval. AGPL can add network-source
  obligations that this desktop product does not need.
- “Noncommercial”, “personal use”, research-only, or field-of-use restrictions.
- Proprietary/freeware/source-available code without explicit rights to use,
  sell, redistribute, and ship it with GPL-covered software.
- Repositories or snippets with no license.
- Assets marked “free download” without explicit commercial redistribution
  rights.
- Any dependency whose EULA prohibits GPL-required redistribution,
  modification, reverse engineering for debugging modifications, or source
  delivery.

## 3. Candidate library audit

This is a shortlist for spikes, not permission to add packages blindly.

| Need                            | Candidate                                                                             | Reported license                                            | Decision                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ZIP packages for CD+G           | [`fflate`](https://github.com/101arrowz/fflate)                                       | MIT                                                         | Preferred. Pure JS and worker-capable; add archive bomb/traversal limits.                                                                                                                                     |
| Live monophonic pitch           | [`pitchy`](https://www.npmjs.com/package/pitchy)                                      | MIT                                                         | Preferred candidate. Benchmark inside AudioWorklet; fork/copy only with retained notice.                                                                                                                      |
| MIDI structure                  | [`@tonejs/midi`](https://github.com/Tonejs/Midi)                                      | MIT                                                         | Preferred parser candidate, but verify that lyric/KAR metadata coverage is sufficient.                                                                                                                        |
| MIDI/KAR + SoundFont/DLS engine | [`spessasynth_core`](https://github.com/spessasus/spessasynth_core) / browser wrapper | Apache-2.0                                                  | Strong candidate because the project explicitly supports MIDI, KAR lyrics, SoundFont/DLS, and worker playback. Audit exact packages/transitives and import only library modules, not demo content/UI.         |
| XML/TTML                        | [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser)           | MIT                                                         | Preferred with DTD/entity defenses and a version at or above the fix for GHSA-8r6m-32jq-jx6q (5.10.1 at review time).                                                                                         |
| Audio metadata/embedded lyrics  | [`music-metadata`](https://www.npmjs.com/package/music-metadata)                      | MIT                                                         | Preferred candidate after browser/Electron bundle and transitive audit.                                                                                                                                       |
| Faithful ASS/SSA rendering      | [`libass`](https://github.com/libass/libass)                                          | ISC                                                         | License is permissive, but native packaging is heavy. First parse the karaoke timing subset in pure TypeScript; evaluate libass only if style fidelity becomes a requirement.                                 |
| Tempo/pitch DSP                 | [SoundTouch](https://surina.net/soundtouch/index.html)                                | LGPL-2.1                                                    | Permitted for the selected GPL model after its WASM/static-linking, user-replacement/relinking, source, and notice obligations are implemented.                                                               |
| High-quality tempo/pitch DSP    | [Rubber Band](https://breakfastquay.com/rubberband/license.html)                      | GPL-2.0-or-later or paid commercial license                 | The free GPL-2.0-or-later edition permits the selected public-source commercial model. If shipped, include exact source/build/notices and convey the combined work compatibly under GPLv3.                    |
| Broad codec/container fallback  | [FFmpeg](https://ffmpeg.org/legal.html)                                               | LGPL-2.1+ by default; GPL if optional GPL parts are enabled | Permitted only after a reproducible build audit. LGPL or GPL-compatible components may be used, but never `--enable-nonfree`; publish exact source/configuration/notices and separately assess codec patents. |

No dependency is accepted only because npm labels it MIT. The lockfile, source
repository license at the selected tag, package contents, transitives, models,
demo assets, and generated binaries must agree.

## 4. Format strategy without license shortcuts

- LRC/eLRC, UltraStar, SRT/VTT, ASS karaoke tags, TTML, and CD+G command parsing
  can be implemented as small pure TypeScript adapters if candidate libraries
  do not provide the required behavior cleanly. Do not copy a GPL parser into a
  permissive module.
- KAR/MIDI synthesis should prefer the Apache-2.0 SpessaSynth libraries if the
  spike validates quality, API stability, and transitive licenses.
- A synthesizer library's license does not grant a SoundFont license. Initially
  require a user-supplied `.sf2`, `.sf3`, or `.dls`, or bundle one only after
  explicit commercial redistribution evidence is archived.
- KFN/KOK or other proprietary containers are imported only where the structure
  is documented or lawfully readable and the payload is not encrypted. No DRM,
  password, or access-control circumvention is implemented.
- Codec support through Chromium/Electron is tested, not inferred. An FFmpeg
  fallback is a separate source-compliance and patent milestone, not an
  incidental npm dependency.

## 5. Content is a separate rights layer

Code licenses do not cover songs, lyrics, album art, videos, fonts, SoundFonts,
or machine-learning models. For a paid product:

- ship no commercial song or lyric without a redistribution agreement;
- do not download content from third-party services on the user's behalf;
- keep user imports local and state that the user must have rights to use them;
- treat a locally selected noncommercial-licensed song as user content, never
  as a FluidEQ redistributable asset: do not copy it into fixtures, installers,
  downloads, demos, screenshots used for marketing, or product repositories;
- create tests with original/generated tones and original short lyric fixtures;
- archive the license and source URL/version for every bundled SoundFont, font,
  icon, impulse response, or model;
- reject “free for personal use” assets.

FFmpeg's own legal page also warns that commercial products may face codec
patent issues even when open-source license compliance is correct. Container
decoding and patent licensing are separate questions.

## 6. Required release controls

1. Maintain a machine-readable production SBOM with exact versions and hashes.
2. Run `pnpm licenses list --prod --json` and an independent lockfile license
   scan in CI; fail unknown, noncommercial, GPL-2.0-only, unapproved AGPL,
   incompatible, or changed licenses.
3. Review every transitive dependency and bundled binary, not just direct npm
   packages.
4. Add exact copyright/license texts to the installed third-party notices and
   the About dialog where required.
5. Create an immutable release tag and source archive for the exact code used to
   build each installer, including scripts, worklets, wrappers, patches, and
   other Corresponding Source needed to rebuild it.
6. Link the exact source archive/tag, GPL text, build instructions, and
   third-party notices from the matching product/download page on `fluideq.com`.
7. Publish exact corresponding source and build configuration for every shipped
   GPL/LGPL component, including FFmpeg or DSP components when used.
8. Ensure the website terms/EULA do not prohibit GPL redistribution,
   modification, or reverse engineering needed to debug modifications.
9. Keep content/SoundFont/model provenance in a separate asset manifest.
10. Map every auto-update version to the same immutable source release and keep
    old source releases available with old binaries.
11. Re-run the audit on every version bump; licenses and dependency trees can
    change.
12. Obtain legal review before the first paid release and before adding FFmpeg,
    LGPL/GPL DSP, a bundled SoundFont, or a proprietary container importer.
