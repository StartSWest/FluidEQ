/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The service's log, and the few things it needs that Node gave the
 * TypeScript for free: a random UUID (`crypto.randomUUID`) and
 * `encodeURIComponent`.
 *
 * A log line is one line of JSON on stderr — `{"message":…,"detail":…}` —
 * which main writes into the app's log under the service's name, the way
 * the Node service's `log.info` reached it. Nothing a pairing or an
 * authentication carries is ever put in one.
 */

#include <functional>
#include <string>
#include <string_view>

#include "fluideq/share/json.h"

namespace feq::share::service {

void log_info(std::string_view message, const share::json::Value& detail);
/** Where log lines go; stderr unless a test listens instead. */
void set_log_sink(std::function<void(const std::string& line)> sink);

/** A version 4 UUID in lower-case hex, as `crypto.randomUUID()` makes. */
std::string random_uuid();

/** `encodeURIComponent` of UTF-8 text. */
std::string encode_uri_component(std::string_view text);

}  // namespace feq::share::service
