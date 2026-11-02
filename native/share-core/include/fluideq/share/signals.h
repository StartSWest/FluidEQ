/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include "fluideq/share/json.h"

/*
 * What a control message between two linked computers may be: the C++ twin
 * of `isLanRemoteAudioSignal` and what it calls (`common/remoteAudio.ts`,
 * `common/remoteAudioGroup.ts`). A peer holds the key, but a peer is not
 * trusted to size this computer's memory or its bar, so each message is held
 * to exactly the shapes the TypeScript admits before anything acts on it.
 */

namespace feq::share::signals {

/** `MAX_AUDIO_GROUP_COMPUTERS`, `MAX_AUDIO_REVOKED_COMPUTERS`. */
inline constexpr std::size_t kMaxGroupComputers = 32;
inline constexpr std::size_t kMaxRevokedComputers = 64;
/** `REMOTE_NUDGE_LIMIT_MS`. */
inline constexpr double kNudgeLimitMs = 60000.0;

bool is_computer_id(const json::Value* value);
bool is_group_endpoint(const json::Value* value);
bool is_group_hello(const json::Value* value);
bool is_group_link(const json::Value* value);
bool is_now_playing(const json::Value* value);
bool is_transport_command(const json::Value& value);
bool is_duplex(const json::Value* value);
/** `isRemoteAudioSignal`. */
bool is_signal(const json::Value* value);
/** `isLanRemoteAudioSignal`: `{ peerId, signal }`. */
bool is_lan_signal(const json::Value* value);

}  // namespace feq::share::signals
