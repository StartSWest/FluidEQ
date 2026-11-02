/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lan_group.h"

#include <algorithm>

#include "fluideq/share/crypto.h"
#include "fluideq/share/lan_protocol.h"
#include "fluideq/share/signals.h"
#include "link_error.h"

namespace feq::share::service {
namespace {

namespace json = feq::share::json;

std::string text_at(const json::Value& record, std::string_view key) {
  const std::string* found = json::string_at(record, key);
  return found != nullptr ? *found : std::string();
}

std::vector<std::string> strings_at(const json::Value& record,
                                    std::string_view key) {
  std::vector<std::string> out;
  const json::Value* list = record.get(key);
  if (list != nullptr && list->is_array()) {
    for (const auto& item : list->items()) {
      if (item.is_string()) {
        out.push_back(item.as_string());
      }
    }
  }
  return out;
}

bool all_private(const json::Value& endpoint) {
  const json::Value* list = endpoint.get("addresses");
  if (list == nullptr || !list->is_array()) {
    return false;
  }
  return std::all_of(list->items().begin(), list->items().end(),
                     [](const json::Value& item) {
                       return item.is_string() &&
                              lan::is_private_ipv4(item.as_string());
                     });
}

/** `{...base, ...over}`: every member of `over` set on a copy of `base`. */
json::Value spread(json::Value base, const json::Value& over) {
  for (const auto& [name, value] : over.members()) {
    base.set(name, value);
  }
  return base;
}

/** The same JSON, as `!==` on numbers and `join(',')` on lists compare it. */
bool same_endpoint(const json::Value& known, const json::Value& endpoint) {
  const json::Value* known_port = known.get("port");
  const json::Value* port = endpoint.get("port");
  return text_at(known, "deviceName") == text_at(endpoint, "deviceName") &&
         known_port != nullptr && port != nullptr && known_port->is_number() &&
         port->is_number() && known_port->as_number() == port->as_number() &&
         strings_at(known, "addresses") == strings_at(endpoint, "addresses");
}

}  // namespace

LanGroup::Peer* LanGroup::find(const std::string& peer_id) {
  for (auto& [id, peer] : peers_) {
    if (id == peer_id) {
      return &peer;
    }
  }
  return nullptr;
}

void LanGroup::send(const std::string& peer_id, json::Value signal) {
  deps_.send(json::Value::object({
      {"peerId", json::Value::string(peer_id)},
      {"signal", std::move(signal)},
  }));
}

void LanGroup::hello(const std::string& peer_id) {
  const auto self = deps_.self();
  if (!self) {
    return;
  }
  std::vector<std::string> known;
  const auto add = [&known](const std::string& id) {
    if (std::find(known.begin(), known.end(), id) == known.end()) {
      known.push_back(id);
    }
  };
  for (const auto& id : deps_.known()) {
    add(id);
  }
  for (const auto& [id, peer] : peers_) {
    add(peer.computer_id);
  }
  if (known.size() > signals::kMaxGroupComputers) {
    known.resize(signals::kMaxGroupComputers);
  }
  std::vector<json::Value> listed;
  for (const auto& id : known) {
    listed.push_back(json::Value::string(id));
  }
  send(peer_id,
       json::Value::object({
           {"kind", json::Value::string("stream-mode")},
           {"mode", json::Value::string("video")},
           {"group", json::Value::object({
                         {"version", json::Value::number(1)},
                         {"endpoint", self->endpoint},
                         {"known", json::Value::array(std::move(listed))},
                     })},
       }));
}

void LanGroup::remember(const json::Value& link) {
  const auto self = deps_.self();
  const std::string computer_id = text_at(link, "computerId");
  if (!self || computer_id == text_at(self->endpoint, "computerId") ||
      deps_.revoked(computer_id) || !all_private(link)) {
    return;
  }
  const auto saved = deps_.saved();
  const auto previous =
      std::find_if(saved.begin(), saved.end(), [&computer_id](const auto& item) {
        return text_at(item, "computerId") == computer_id;
      });
  if (previous == saved.end() && saved.size() >= signals::kMaxGroupComputers) {
    return;
  }
  if (previous != saved.end()) {
    const std::string previous_issuer = text_at(*previous, "issuer");
    const std::string issuer = text_at(link, "issuer");
    if (previous_issuer < issuer ||
        (previous_issuer == issuer &&
         text_at(*previous, "secret") != text_at(link, "secret"))) {
      return;
    }
  }
  deps_.save(link);
  deps_.join(link);
}

std::string LanGroup::secret_for(const std::string& first,
                                 const std::string& second) {
  const auto self = deps_.self();
  if (!self) {
    throw LinkError("Share Audio is not listening.");
  }
  const auto& [low, high] = std::minmax(first, second);
  std::string input("FluidEQ group pair v1");
  input.push_back('\0');
  input += low;
  input.push_back('\0');
  input += high;
  return crypto::base64url(crypto::hmac_sha256(crypto::bytes_of(self->secret),
                                               crypto::bytes_of(input)));
}

void LanGroup::introduce() {
  const auto self = deps_.self();
  if (!self) {
    return;
  }
  std::vector<std::string> ready;
  for (const auto& [id, peer] : peers_) {
    if (peer.hello) {
      ready.push_back(id);
    }
  }
  const std::string issuer = text_at(self->endpoint, "computerId");
  for (std::size_t index = 0; index < ready.size(); index += 1) {
    for (std::size_t later = index + 1; later < ready.size(); later += 1) {
      Peer* first = find(ready[index]);
      Peer* second = find(ready[later]);
      if (first == nullptr || second == nullptr || !first->hello ||
          !second->hello || first->computer_id == second->computer_id) {
        continue;
      }
      const auto& [low, high] =
          std::minmax(first->computer_id, second->computer_id);
      const std::string key = low + ":" + high;
      const auto first_known = strings_at(*first->hello, "known");
      const auto second_known = strings_at(*second->hello, "known");
      const bool each_knows =
          std::find(first_known.begin(), first_known.end(),
                    second->computer_id) != first_known.end() &&
          std::find(second_known.begin(), second_known.end(),
                    first->computer_id) != second_known.end();
      if (introduced_.contains(key) || each_knows) {
        continue;
      }
      introduced_.insert(key);
      const std::string secret =
          secret_for(first->computer_id, second->computer_id);
      const json::Value extra = json::Value::object({
          {"issuer", json::Value::string(issuer)},
          {"secret", json::Value::string(secret)},
      });
      const json::Value* first_endpoint = first->hello->get("endpoint");
      const json::Value* second_endpoint = second->hello->get("endpoint");
      const std::string first_id = ready[index];
      const std::string second_id = ready[later];
      send(first_id,
           json::Value::object({
               {"kind", json::Value::string("group-link")},
               {"link", spread(*second_endpoint, extra)},
           }));
      send(second_id,
           json::Value::object({
               {"kind", json::Value::string("group-link")},
               {"link", spread(*first_endpoint, extra)},
           }));
    }
  }
}

void LanGroup::connected(const std::string& peer_id,
                         const std::optional<std::string>& computer_id) {
  if (!computer_id || computer_id->empty()) {
    return;
  }
  if (Peer* peer = find(peer_id)) {
    *peer = Peer{*computer_id, std::nullopt};
  } else {
    peers_.emplace_back(peer_id, Peer{*computer_id, std::nullopt});
  }
  // A known message kind; old apps ignore its new field.
  hello(peer_id);
}

void LanGroup::disconnected(const std::string& peer_id) {
  std::erase_if(peers_, [&peer_id](const auto& entry) {
    return entry.first == peer_id;
  });
  introduced_.clear();
}

bool LanGroup::receive(const json::Value& message) {
  const std::string peer_id = text_at(message, "peerId");
  const json::Value* signal = message.get("signal");
  if (signal == nullptr) {
    return false;
  }
  const std::string kind = text_at(*signal, "kind");
  Peer* peer = find(peer_id);
  if (peer == nullptr) {
    return kind == "group-link";
  }
  const json::Value* group = signal->get("group");
  if (kind == "stream-mode" && group != nullptr && group->is_object()) {
    const json::Value* endpoint = group->get("endpoint");
    if (endpoint == nullptr ||
        text_at(*endpoint, "computerId") != peer->computer_id ||
        !all_private(*endpoint)) {
      return false;
    }
    const bool first = !peer->hello.has_value();
    peer->hello = *group;
    const std::string computer_id = peer->computer_id;
    const auto saved = deps_.saved();
    const auto known = std::find_if(
        saved.begin(), saved.end(), [&computer_id](const auto& link) {
          return text_at(link, "computerId") == computer_id;
        });
    const json::Value endpoint_copy = *endpoint;
    if (known != saved.end() && !same_endpoint(*known, endpoint_copy)) {
      deps_.save(spread(*known, endpoint_copy));
    }
    const auto self = deps_.self();
    // The listener's first description can follow auth-accepted in the same
    // TCP read, before a joiner's transport listener is attached. Answer the
    // first hello explicitly; the joiner's hello is sent only after
    // attachment. This is a handshake, never a timed retry.
    if (first) {
      hello(peer_id);
    }
    if (first && self && known == saved.end()) {
      // Also save the reverse direction of a manually paired link. An
      // inbound-only member must survive a restart and appear offline.
      const std::string own_id = text_at(self->endpoint, "computerId");
      const std::string secret = secret_for(own_id, computer_id);
      remember(spread(endpoint_copy,
                      json::Value::object({
                          {"secret", json::Value::string(secret)},
                          {"issuer", json::Value::string(own_id)},
                          {"introduced", json::Value::boolean(false)},
                      })));
      send(peer_id,
           json::Value::object({
               {"kind", json::Value::string("group-link")},
               {"link", spread(self->endpoint,
                               json::Value::object({
                                   {"secret", json::Value::string(secret)},
                                   {"issuer", json::Value::string(own_id)},
                               }))},
           }));
    }
    introduce();
  } else if (kind == "group-link") {
    const json::Value* link = signal->get("link");
    if (peer->hello && link != nullptr &&
        text_at(*link, "issuer") == peer->computer_id) {
      remember(spread(*link,
                      json::Value::object({
                          {"introduced",
                           json::Value::boolean(text_at(*link, "computerId") !=
                                                peer->computer_id)},
                      })));
    }
    // Credentials stay in main; never in the renderer.
    return true;
  }
  return false;
}

void LanGroup::reset() {
  peers_.clear();
  introduced_.clear();
}

}  // namespace feq::share::service
