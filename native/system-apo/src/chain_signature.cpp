/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "chain_signature.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <cstdio>
#include <string>

#include "log.h"

namespace fluideq_engine {

namespace {

/** Exact enough to compare: `%.17g` round-trips every double. */
std::string number(double value) {
  char text[40] = {};
  const int written = std::snprintf(text, sizeof(text), "%.17g", value);
  if (written <= 0) {
    return std::string("?");
  }
  return std::string(text, static_cast<size_t>(written));
}

/** A file's size and last-write time, or `-` when it is not there. */
std::string stamp_of(const std::wstring& path) {
  if (path.empty()) {
    return std::string("-");
  }
  WIN32_FILE_ATTRIBUTE_DATA data = {};
  if (GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &data) == 0) {
    return std::string("-");
  }
  char text[64] = {};
  const int written = std::snprintf(
      text, sizeof(text), "%lu:%lu:%lu:%lu",
      static_cast<unsigned long>(data.nFileSizeHigh),
      static_cast<unsigned long>(data.nFileSizeLow),
      static_cast<unsigned long>(data.ftLastWriteTime.dwHighDateTime),
      static_cast<unsigned long>(data.ftLastWriteTime.dwLowDateTime));
  if (written <= 0) {
    return std::string("-");
  }
  return std::string(text, static_cast<size_t>(written));
}

}  // namespace

std::string signature_of(const Chain& chain) {
  std::string out;
  out += chain.matched ? "m1" : "m0";
  out += "|c=" + to_utf8(chain.convolution_path);
  out += "|s=" + stamp_of(chain.convolution_path);
  out += "|p=" + number(chain.preamp_db);
  out += "|b=";
  for (const Band& band : chain.bands) {
    out += std::to_string(static_cast<int>(band.type));
    out += ',' + number(band.frequency);
    out += ',' + number(band.gain_db);
    out += ',' + number(band.quality);
    out += ';';
  }
  out += "|g=";
  // A separator per curve: the same points split differently between two
  // curves is a different response, and must not sign the same.
  for (const std::vector<GraphicPoint>& curve : chain.graphic_curves) {
    for (const GraphicPoint& point : curve) {
      out += number(point.frequency) + ',' + number(point.gain_db) + ';';
    }
    out += '/';
  }
  out += "|f=";
  for (const std::wstring& file : chain.files_read) {
    out += to_utf8(file) + ';';
  }
  out += "|i=";
  for (const std::string& command : chain.ignored) {
    out += command + ';';
  }
  // The rack, by value rather than by file stamp. `fluideq-dsp.txt` is
  // deliberately absent from `files_read`, so nothing else here would notice
  // it changing — and it is rewritten on every slider release, which is the
  // one file in this directory that changes while music is playing.
  out += "|d=";
  for (const double value : chain.dsp_values) {
    out += number(value) + ';';
  }
  return out;
}

}  // namespace fluideq_engine
