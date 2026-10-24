/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include "bus_api.h"
#include "../../media-watch/src/media_line.h"

namespace fluideq_linux::media {
struct Player {
  fluideq_media::Reading reading;
  std::string track;
  std::string artwork;
  bool can_control = false;
};
bool read_player(const bus::Api& api, bus::Connection* connection,
                 const std::string& name, Player& player);
}  // namespace fluideq_linux::media
