#!/usr/bin/env bash
# <FluidEQ: System-wide parametric audio equalizer interface>
# Copyright (C) <2026>  <Ivan Carmenates Garcia>
# SPDX-License-Identifier: GPL-3.0-or-later
#
# FluidEQ-Engine and FluidEQ-DSP for every Linux distribution, not just the
# one they were built on.
#
# A binary asks for the glibc it was linked against or newer, so one built on
# this year's Ubuntu refuses to start on last year's Debian before a line of
# ours runs. These are built inside AlmaLinux 8 instead — glibc 2.28, 2018 —
# with a current compiler (gcc-toolset), and GCC's runtime linked in, so they
# start on anything from that year on: Debian 10+, Ubuntu 20.04+, RHEL/Alma/
# Rocky 8+, Fedora 29+, openSUSE Leap 15.1+, Arch, Mint 20+, Pop!_OS, Zorin.
# The sound server is opened at run time (PipeWire, else PulseAudio; ALSA for
# the DSP host), so nothing else has to be installed to start them.
#
#   native/linux/build-portable.sh [output-dir]   (default: native/.build/bin)
#
# Needs Docker. The source tree is mounted read-only; nothing but the two
# binaries is written to the output directory.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
native="$(cd "$here/.." && pwd)"
out="${1:-$native/.build/bin}"
image="almalinux:8"
# PipeWire's headers (MIT), pinned by hash. AlmaLinux 8's own are 0.3.6, from
# 2020, without the stream flags and parameters the engine uses. 0.3.65 is
# Debian 12's: the oldest API the code is held to. The library itself is
# never linked (pipewire/pw_api.h), so these are declarations only.
pw_version="0.3.65"
pw_sha256="bb76f938136d0ce8c35bffa99e002dc2dbaeab5e14c6c34154e7f750013d1d6b"
pw_url="https://gitlab.freedesktop.org/pipewire/pipewire/-/archive/$pw_version/pipewire-$pw_version.tar.gz"

if [ ! -f "$native/dsp-core/include/fluideq/parameters.h" ]; then
  echo "build-portable: run 'pnpm build:native-dsp' once first;" \
       "it generates dsp-core/include/fluideq/parameters.h" >&2
  exit 1
fi

mkdir -p "$out"
docker run --rm \
  -v "$native:/src:ro" \
  -v "$out:/out" \
  -e OWNER="$(id -u):$(id -g)" \
  -e PW_VERSION="$pw_version" -e PW_SHA256="$pw_sha256" -e PW_URL="$pw_url" \
  "$image" bash -euc '
    dnf -q -y install gcc-toolset-14-gcc-c++ cmake make binutils >/dev/null
    source /opt/rh/gcc-toolset-14/enable

    # A tarball that does not match its hash is refused, never built from.
    curl -fsSL -o /tmp/pipewire.tar.gz "$PW_URL"
    echo "$PW_SHA256  /tmp/pipewire.tar.gz" | sha256sum -c --quiet
    mkdir -p /tmp/pw /tmp/pwh/pipewire
    tar xzf /tmp/pipewire.tar.gz -C /tmp/pw --strip-components=1 \
      "pipewire-$PW_VERSION/spa/include" "pipewire-$PW_VERSION/src/pipewire"
    cp -r /tmp/pw/spa/include/spa /tmp/pwh/spa
    (cd /tmp/pw/src/pipewire && find . -name "*.h" \
      -exec install -D -m 0644 {} /tmp/pwh/pipewire/{} \;)
    IFS=. read -r major minor micro <<< "$PW_VERSION"
    sed -e "s/@PIPEWIRE_VERSION_MAJOR@/$major/g" \
        -e "s/@PIPEWIRE_VERSION_MINOR@/$minor/g" \
        -e "s/@PIPEWIRE_VERSION_MICRO@/$micro/g" \
        -e "s/@PIPEWIRE_API_VERSION@/\"$major.$minor\"/g" \
        /tmp/pw/src/pipewire/version.h.in > /tmp/pwh/pipewire/version.h

    cmake -S /src -B /tmp/build -DCMAKE_BUILD_TYPE=Release \
      -DFEQ_BUILD_REVISION=portable -DFEQ_PIPEWIRE_HEADERS=/tmp/pwh >/dev/null
    cmake --build /tmp/build -j"$(nproc)" \
      --target fluideq-linux-engine fluideq-dsp-host
    install -m 0755 /tmp/build/bin/FluidEQ-Engine /tmp/build/bin/FluidEQ-DSP /out/
    chown "$OWNER" /out/FluidEQ-Engine /out/FluidEQ-DSP
    echo "highest glibc symbol each binary needs:"
    for binary in /out/FluidEQ-Engine /out/FluidEQ-DSP; do
      printf "  %s: " "$(basename "$binary")"
      objdump -T "$binary" | grep -o "GLIBC_[0-9.]*" | sort -uV | tail -1
    done
  '
echo "build-portable: $out/FluidEQ-Engine and $out/FluidEQ-DSP"
