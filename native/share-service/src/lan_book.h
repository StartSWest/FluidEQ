/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * What the link asks of storage about other computers (`ILanLinkBook`):
 * which were unlinked here (refused unless they paste the code again), the
 * links the group handshake saved, and which saved codes to drop when the
 * other computer says so. The runtime keeps it and tells main of every
 * change, which writes it down.
 *
 * A group link is kept as the JSON it travels as (`IAudioGroupLink`), so
 * that what one computer was told is what it passes on, field for field.
 */

#include <functional>
#include <string>
#include <vector>

#include "fluideq/share/json.h"

namespace feq::share::service {

struct LinkBook {
  std::function<std::vector<share::json::Value>()> group_links;
  std::function<void(const share::json::Value& link)> save_group_link;
  std::function<bool(const std::string& computer_id)> is_revoked;
  std::function<void(const std::string& computer_id)> revoke;
  std::function<void(const std::string& computer_id)> unrevoke;
  std::function<void(const std::string& computer_id)> forget_join;
};

}  // namespace feq::share::service
