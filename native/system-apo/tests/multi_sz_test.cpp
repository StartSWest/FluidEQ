/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The shapes `RegQueryValueExW` really hands back.
 *
 * A `REG_MULTI_SZ` is only a list by convention: the registry stores a byte
 * count and whatever bytes were written, and nothing rejects a value whose
 * last entry has no NUL after it. A decoder that scans for a terminator reads
 * past the end of the buffer, and on this program's path the heap it wandered
 * into becomes an effect class id — written back into somebody's audio driver
 * and into the backup meant to undo it.
 *
 * Every fixture below is a buffer with a deliberate flaw, built with an exact
 * byte count so the decoder has nothing else to go on. The positive control
 * sits first: a well-formed list, so that "found nothing" cannot pass for
 * "handled everything".
 */

#include "../setup/multi_sz.h"

#include <cstddef>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

using fluideq_engine::setup::decode_multi_sz;
using fluideq_engine::setup::decode_sz;
using fluideq_engine::setup::encode_multi_sz;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

/**
 * A registry value: the bytes it says it has, and readable bytes past them.
 *
 * The tail is the point. A decoder that scans for a terminator instead of
 * respecting the byte count reads into it, and `POISON` turns up inside an
 * entry where a silent read of a zeroed heap would have looked like a pass.
 * `size` is what `RegQueryValueExW` would have reported; `raw` is bigger.
 */
struct Buffer {
  std::vector<unsigned char> raw;
  std::size_t size = 0;

  const unsigned char* data() const { return raw.data(); }
};

Buffer bytes_of(const std::vector<wchar_t>& text) {
  Buffer buffer;
  buffer.size = text.size() * sizeof(wchar_t);
  buffer.raw.assign(buffer.size, 0);
  if (!text.empty()) {
    std::memcpy(buffer.raw.data(), text.data(), buffer.size);
  }
  const std::wstring poison = L"POISON";
  const std::size_t tail = (poison.size() + 1) * sizeof(wchar_t);
  buffer.raw.resize(buffer.size + tail, 0);
  std::memcpy(buffer.raw.data() + buffer.size, poison.c_str(),
              poison.size() * sizeof(wchar_t));
  return buffer;
}

/** The characters of `entries`, each followed by a NUL, and nothing after. */
std::vector<wchar_t> entries_with_terminators(
    const std::vector<std::wstring>& entries) {
  std::vector<wchar_t> text;
  for (const std::wstring& entry : entries) {
    text.insert(text.end(), entry.begin(), entry.end());
    text.push_back(L'\0');
  }
  return text;
}

void expect_entries(const std::vector<std::wstring>& actual,
                    const std::vector<std::wstring>& expected,
                    const char* label) {
  if (actual == expected) {
    return;
  }
  std::printf("  FAIL %s: entries differ\n", label);
  std::printf("    expected %zu:", expected.size());
  for (const std::wstring& entry : expected) {
    std::printf(" [%ls]", entry.c_str());
  }
  std::printf("\n    actual   %zu:", actual.size());
  for (const std::wstring& entry : actual) {
    std::printf(" [%ls]", entry.c_str());
  }
  std::printf("\n");
  ++g_failures;
}

const std::wstring kFirst = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0001}";
const std::wstring kSecond = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0002}";

// ---------------------------------------------------------------------------

/**
 * The positive control: a list exactly as the documentation describes it.
 *
 * Without it, every case below would also pass a decoder that returned an
 * empty list for everything it was ever given.
 */
void terminated_list() {
  std::printf("terminated list\n");
  std::vector<wchar_t> text = entries_with_terminators({kFirst, kSecond});
  text.push_back(L'\0');  // The extra terminator that ends the list.
  const Buffer value = bytes_of(text);
  expect_entries(decode_multi_sz(value.data(), value.size),
                 {kFirst, kSecond}, "terminated_list");
}

/**
 * The value this whole file exists for: the last entry has no NUL after it.
 *
 * The buffer ends where the last character does, so a scan looking for a
 * terminator walks into whatever the allocator put next. The entry is real and
 * belongs to the vendor, so it is kept — the byte count is what says where it
 * stops.
 */
void unterminated_last_entry() {
  std::printf("unterminated last entry\n");
  std::vector<wchar_t> text;
  text.insert(text.end(), kFirst.begin(), kFirst.end());
  text.push_back(L'\0');
  text.insert(text.end(), kSecond.begin(), kSecond.end());
  const Buffer value = bytes_of(text);
  expect_entries(decode_multi_sz(value.data(), value.size),
                 {kFirst, kSecond}, "unterminated_last_entry");

  // And with only one entry, which is the shape a vendor writing a single
  // class id into a list value produces.
  const Buffer alone =
      bytes_of(std::vector<wchar_t>(kFirst.begin(), kFirst.end()));
  expect_entries(decode_multi_sz(alone.data(), alone.size), {kFirst},
                 "unterminated_last_entry alone");
}

/** A value present but zero bytes long, which is an empty list. */
void empty_value() {
  std::printf("empty value\n");
  const Buffer value = bytes_of({});
  CHECK(value.size == 0);
  expect_entries(decode_multi_sz(value.data(), value.size), {}, "empty_value");
  // The same through a null pointer, which is what an empty `std::vector`
  // hands back on some standard libraries.
  expect_entries(decode_multi_sz(nullptr, 0), {}, "empty_value null");
  CHECK(decode_sz(nullptr, 0).empty());
}

/** A value of one NUL: the terminator alone, and no entries. */
void one_terminator() {
  std::printf("one terminator\n");
  const Buffer value = bytes_of({L'\0'});
  CHECK(value.size == sizeof(wchar_t));
  expect_entries(decode_multi_sz(value.data(), value.size), {},
                 "one_terminator");
  CHECK(decode_sz(value.data(), value.size).empty());
}

/**
 * An odd byte count, which cannot be a whole number of UTF-16 units.
 *
 * Half a character is not one. The stray byte is dropped rather than read as
 * a whole unit whose upper half is off the end of the buffer.
 */
void odd_byte_count() {
  std::printf("odd byte count\n");
  std::vector<wchar_t> text;
  text.insert(text.end(), kFirst.begin(), kFirst.end());
  text.push_back(L'\0');
  // One byte more than the buffer holds whole characters for: the value
  // claims half of a character nobody finished writing.
  Buffer value = bytes_of(text);
  value.size += 1;
  CHECK(value.size % sizeof(wchar_t) == 1);
  expect_entries(decode_multi_sz(value.data(), value.size), {kFirst},
                 "odd_byte_count");

  // A single string with the same flaw, read as far as it goes.
  Buffer single = bytes_of(std::vector<wchar_t>(kFirst.begin(), kFirst.end()));
  single.size += 1;
  CHECK(decode_sz(single.data(), single.size) == kFirst);
}

/** Bytes after the double terminator are padding, not another entry. */
void trailing_padding() {
  std::printf("trailing padding\n");
  std::vector<wchar_t> text = entries_with_terminators({kFirst});
  text.push_back(L'\0');
  text.insert(text.end(), kSecond.begin(), kSecond.end());
  const Buffer value = bytes_of(text);
  expect_entries(decode_multi_sz(value.data(), value.size), {kFirst},
                 "trailing_padding");
}

/** What is encoded reads back, and the encoding is the documented one. */
void encode_round_trip() {
  std::printf("encode round trip\n");
  const std::vector<std::wstring> entries = {kFirst, kSecond};
  const std::vector<wchar_t> block = encode_multi_sz(entries);
  CHECK(block.size() == kFirst.size() + kSecond.size() + 3);
  CHECK(block.back() == L'\0');
  const Buffer value = bytes_of(block);
  expect_entries(decode_multi_sz(value.data(), value.size), entries,
                 "encode_round_trip");

  // An empty list is one terminator and nothing else, which reads back empty.
  const Buffer none = bytes_of(encode_multi_sz({}));
  CHECK(none.size == sizeof(wchar_t));
  expect_entries(decode_multi_sz(none.data(), none.size), {},
                 "encode_round_trip empty");
}

}  // namespace

int main() {
  std::printf("multi sz\n\n");
  terminated_list();
  unterminated_last_entry();
  empty_value();
  one_terminator();
  odd_byte_count();
  trailing_padding();
  encode_round_trip();

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
