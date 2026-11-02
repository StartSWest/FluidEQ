/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <cstddef>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

/*
 * JSON as the TypeScript end of Share Audio reads and writes it: every
 * message between two FluidEQs — the pairing code, the discovery datagrams,
 * the authentication and every control message — is `JSON.stringify` on one
 * side and `JSON.parse` on the other, and a computer running this has to be
 * one of them.
 *
 * So `parse` is `JSON.parse` after `Buffer.toString('utf8')`: bytes that
 * are not UTF-8 read as U+FFFD, a key given twice keeps its first place and
 * its last value. `stringify` is `JSON.stringify`: keys in the order they
 * were set, numbers as JavaScript prints them, a number that is not finite
 * as `null`. Text is UTF-8 throughout; where the TypeScript counts a
 * string's `length`, `utf16_length` counts the same thing.
 */

namespace feq::share::json {

class Value;
using Member = std::pair<std::string, Value>;

class Value {
 public:
  enum class Kind { kNull, kBool, kNumber, kString, kArray, kObject };

  Value() = default;
  static Value null() { return Value(); }
  static Value boolean(bool value);
  static Value number(double value);
  static Value string(std::string value);
  static Value array(std::vector<Value> items = {});
  static Value object(std::vector<Member> members = {});

  Kind kind() const { return kind_; }
  bool is_null() const { return kind_ == Kind::kNull; }
  bool is_bool() const { return kind_ == Kind::kBool; }
  bool is_number() const { return kind_ == Kind::kNumber; }
  bool is_string() const { return kind_ == Kind::kString; }
  bool is_array() const { return kind_ == Kind::kArray; }
  bool is_object() const { return kind_ == Kind::kObject; }

  bool as_bool() const { return bool_; }
  double as_number() const { return number_; }
  const std::string& as_string() const { return string_; }
  const std::vector<Value>& items() const { return items_; }
  std::vector<Value>& items() { return items_; }
  const std::vector<Member>& members() const { return members_; }

  /** A member of an object, or nothing: also nothing for any other kind. */
  const Value* get(std::string_view key) const;
  /** Sets a member, keeping its place when it is already there. */
  Value& set(std::string_view key, Value value);
  /** A member taken out, as `delete` takes one. */
  void erase(std::string_view key);

 private:
  Kind kind_ = Kind::kNull;
  bool bool_ = false;
  double number_ = 0.0;
  std::string string_;
  std::vector<Value> items_;
  std::vector<Member> members_;
};

/** `JSON.parse(bytes.toString('utf8'))`; nothing where it would throw. */
std::optional<Value> parse(std::string_view bytes);

/** `JSON.stringify(value)`. */
std::string stringify(const Value& value);

/** `String(number)` for a finite number, as JavaScript prints it. */
std::string number_text(double value);

/** `Buffer.toString('utf8')` of `bytes`: each ill-formed part as U+FFFD. */
std::string well_formed(std::string_view bytes);

/** A UTF-8 string's `length` in JavaScript: its UTF-16 code units. */
std::size_t utf16_length(std::string_view text);

/** `String.prototype.trim`: JavaScript's white space and line ends, off both ends. */
std::string trim(std::string_view text);

/** The members of `value` read as a TypeScript `Record<string, unknown>`. */
inline bool is_record(const Value* value) {
  return value != nullptr && value->is_object();
}

/** A string member, or nothing when it is absent or not a string. */
inline const std::string* string_at(const Value& record, std::string_view key) {
  const Value* found = record.get(key);
  return found != nullptr && found->is_string() ? &found->as_string() : nullptr;
}

/** `Number.isInteger` on a member, as a number, or nothing. */
std::optional<double> integer_at(const Value& record, std::string_view key);

}  // namespace feq::share::json
