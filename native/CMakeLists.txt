#[[
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
]]

cmake_minimum_required(VERSION 3.21)

project(fluideq_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

# Stamped into the handshake so a support report can name the host that ran.
# Once the host can be rebuilt independently of the app, the app's own version
# stops being an answer to "which engine was this".
if(NOT DEFINED FEQ_CORE_VERSION)
  set(FEQ_CORE_VERSION "0.1.0-identity")
endif()
if(NOT DEFINED FEQ_BUILD_REVISION)
  set(FEQ_BUILD_REVISION "unknown")
endif()

add_library(feq_strict INTERFACE)
if(MSVC)
  target_compile_options(feq_strict INTERFACE /W4 /WX /permissive-)
  # RTTI is off; exceptions are NOT.
  #
  # The spec asked for both, and both was wrong: the MSVC standard library is
  # not supported with exceptions disabled, and `std::vector`'s allocation
  # failure has nowhere to go without them. The invariant that actually matters
  # is narrower and is enforced by hand instead — nothing inside
  # `feq_engine_process_planar` allocates, and so nothing in it can throw. The
  # allocating calls are `create` and `prepare`, neither of which is on the
  # audio thread.
  target_compile_options(feq_strict INTERFACE /GR-)
else()
  target_compile_options(feq_strict INTERFACE
    -Wall -Wextra -Wpedantic -Werror -fno-rtti)
endif()

# Never global fast-math: invalid-sample repair and true-peak safety both
# depend on IEEE behaviour, and -ffast-math tells the compiler that a NaN
# cannot happen — which deletes the very branch that catches one.
if(MSVC)
  target_compile_options(feq_strict INTERFACE /fp:precise)
else()
  target_compile_options(feq_strict INTERFACE -ffp-contract=off)
endif()

add_library(fluideq-dsp-core STATIC
  dsp-core/src/engine.cpp
  dsp-core/src/biquad.cpp
  dsp-core/src/eq.cpp
  dsp-core/src/dynamics.cpp
  dsp-core/src/oversample.cpp
  dsp-core/src/primitives.cpp
  dsp-core/src/saturate.cpp
  dsp-core/src/limiter.cpp
  dsp-core/src/compressor.cpp
  dsp-core/src/output_safety.cpp
  dsp-core/src/post_filter_normalizer.cpp
  dsp-core/src/analog_diode.cpp
  dsp-core/src/harmonics.cpp
  dsp-core/src/phase_align.cpp
  dsp-core/src/exciter_guard.cpp
  dsp-core/src/organic.cpp
  dsp-core/src/organic_stage.cpp
  dsp-core/src/exciter.cpp
  dsp-core/src/convolver.cpp
  dsp-core/src/linear_phase.cpp
  dsp-core/src/loudness.cpp
  dsp-core/src/loudness_meter.cpp
  dsp-core/src/crossfade.cpp
  dsp-core/src/dimension.cpp
  dsp-core/src/bass_forge.cpp
  dsp-core/src/bass_forge_meters.cpp
  dsp-core/src/bass_punch.cpp
  dsp-core/src/bass_punch_bloom.cpp
  dsp-core/src/denoise.cpp
  dsp-core/src/denoise_spectral.cpp
  dsp-core/src/denoise_hum.cpp
  dsp-core/src/denoise_click.cpp
  dsp-core/src/denoise_voice.cpp
  dsp-core/src/meters.cpp
  dsp-core/src/chain.cpp
  dsp-core/src/chain_eq.cpp
  dsp-core/src/chain_exciter.cpp
  dsp-core/src/chain_stages.cpp
  dsp-core/src/chain_linear.cpp
  dsp-core/src/chain_decode.cpp
  dsp-core/src/resampler.cpp
  dsp-core/src/player.cpp
)
target_include_directories(fluideq-dsp-core PUBLIC dsp-core/include)
# The ONNX Runtime C API header, vendored. Nothing is LINKED against it: the
# voice module loads the shared library by path at runtime, so this is a set of
# declarations rather than a build dependency.
target_include_directories(fluideq-dsp-core PRIVATE dsp-host/src/vendor)
target_link_libraries(fluideq-dsp-core PRIVATE feq_strict)
target_compile_definitions(fluideq-dsp-core
  PUBLIC FEQ_CORE_VERSION="${FEQ_CORE_VERSION}")

enable_testing()

add_executable(fluideq-dsp-core-test dsp-core/tests/engine_test.cpp)
target_link_libraries(fluideq-dsp-core-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME dsp-core COMMAND fluideq-dsp-core-test)

# Held to what the TypeScript engine already does. The corpus is regenerated
# from those modules by `generate-parity-fixtures.ts` before this runs, so the
# reference cannot go stale — see the head of that script for why that is the
# right direction during a migration, and what it therefore cannot catch.
add_executable(fluideq-resampler-test dsp-core/tests/resampler_test.cpp)
target_link_libraries(fluideq-resampler-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME resampler COMMAND fluideq-resampler-test)

add_executable(fluideq-exciter-test dsp-core/tests/exciter_test.cpp)
target_link_libraries(fluideq-exciter-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME exciter COMMAND fluideq-exciter-test)

add_executable(fluideq-dimension-test dsp-core/tests/dimension_test.cpp)
target_link_libraries(fluideq-dimension-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME dimension COMMAND fluideq-dimension-test)

add_executable(fluideq-bass-forge-test dsp-core/tests/bass_forge_test.cpp)
target_link_libraries(fluideq-bass-forge-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME bass-forge COMMAND fluideq-bass-forge-test)

add_executable(fluideq-bass-punch-test dsp-core/tests/bass_punch_test.cpp)
target_link_libraries(fluideq-bass-punch-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME bass-punch COMMAND fluideq-bass-punch-test)

# Both bass stages split the same way, so the way that split can fail is one
# property and not two. Separate from the two stage files because it is shared,
# and because measuring AT the corner is the case those files were written
# without: every bin either of them takes is away from it.
add_executable(fluideq-bass-split-test dsp-core/tests/bass_split_test.cpp)
target_link_libraries(fluideq-bass-split-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME bass-split COMMAND fluideq-bass-split-test)

add_executable(fluideq-bass-isolate-test dsp-core/tests/bass_isolate_test.cpp)
target_link_libraries(fluideq-bass-isolate-test
  PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME bass-isolate COMMAND fluideq-bass-isolate-test)

add_executable(fluideq-denoise-test dsp-core/tests/denoise_test.cpp)
target_link_libraries(fluideq-denoise-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME denoise COMMAND fluideq-denoise-test)

add_executable(fluideq-meters-test dsp-core/tests/meters_test.cpp)
target_link_libraries(fluideq-meters-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME meters COMMAND fluideq-meters-test)

# Separate from `meters` because it asks a different question: not whether the
# meters measure, but where in the chain each one is tapped. A tap taken at the
# wrong point reports a real measurement of the wrong signal, which every check
# in `meters_test` still passes.
add_executable(fluideq-chain-meters-test dsp-core/tests/chain_meters_test.cpp)
target_link_libraries(fluideq-chain-meters-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME chain-meters COMMAND fluideq-chain-meters-test)

add_executable(fluideq-player-test dsp-core/tests/player_test.cpp)
target_link_libraries(fluideq-player-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME player COMMAND fluideq-player-test)

add_executable(fluideq-dsp-parity-test dsp-core/tests/parity_test.cpp)
target_link_libraries(fluideq-dsp-parity-test
  PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME dsp-parity
  COMMAND fluideq-dsp-parity-test "${CMAKE_BINARY_DIR}/fixtures")

add_executable(fluideq-dsp-host
  dsp-host/src/main.cpp
  dsp-host/src/decoders/pcm_decoder.cpp
  dsp-host/src/decoders/compressed_decoder.cpp
  dsp-host/src/decoders/vendor/vendor.cpp
  dsp-host/src/parent_watch.cpp
)
target_link_libraries(fluideq-dsp-host PRIVATE fluideq-dsp-core feq_strict)

# Warnings-as-errors, off for the vendored decoders and nowhere else.
#
# `#pragma warning(push, 0)` inside the file silences the warnings but /WX has
# already promoted them, so the pragma has nothing left to suppress. The flag
# has to come off at the compiler invocation, and it comes off for this ONE
# source: twenty-three thousand lines of somebody else's public domain code
# cannot be held to this project's standard without patching every release,
# and dropping /WX for the whole target would take our own code with it.
set_source_files_properties(dsp-host/src/decoders/vendor/vendor.cpp
  PROPERTIES COMPILE_OPTIONS "$<IF:$<BOOL:${MSVC}>,/WX-,-Wno-error>")


# The device backend, which is the only platform-specific code in the project.
# Every platform gets one, and the two that have no real implementation get a
# stub that refuses through the same channel a broken device would — a build
# that fails to link on macOS is a tree nobody notices breaking further.
if(WIN32)
  target_sources(fluideq-dsp-host PRIVATE
    dsp-host/src/platform/windows/wasapi_backend.cpp
    # The version resource, which is what Task Manager's Name column reads.
    # Without it this is one more row saying "FluidEQ" in a tree of eight, and
    # none of them says which is holding the memory.
    dsp-host/src/platform/windows/host.rc)
  set_source_files_properties(dsp-host/src/platform/windows/host.rc
    PROPERTIES COMPILE_DEFINITIONS
      "FEQ_HOST_VERSION_STRING=\"${FEQ_CORE_VERSION}\"")
  # The platform decoder: AAC since Windows 7, WMA since Vista, and the MPEG-4
  # and ASF containers around them. Microsoft licenses those codecs for the
  # operating system, so this is the one route to m4a and wma that costs
  # nothing to link and carries no patent question into a binary that is sold.
  target_sources(fluideq-dsp-host PRIVATE
    dsp-host/src/decoders/platform/windows/media_foundation_decoder.cpp)
  # Both ship with Windows. WASAPI is a user-mode COM API: no driver, no
  # kernel component, nothing to install and nothing to sign â and the Media
  # Foundation libraries below are the same kind of thing.
  target_link_libraries(fluideq-dsp-host PRIVATE
    ole32 avrt mfplat mfreadwrite mfuuid propsys)

else()
  target_sources(fluideq-dsp-host PRIVATE
    dsp-host/src/platform/unsupported_backend.cpp
    dsp-host/src/decoders/platform/unsupported_media_decoder.cpp)
  find_package(Threads REQUIRED)
  target_link_libraries(fluideq-dsp-host PRIVATE Threads::Threads)
endif()
target_compile_definitions(fluideq-dsp-host PRIVATE
  FEQ_BUILD_REVISION="${FEQ_BUILD_REVISION}")

# One known place for the build to leave the host, so the development runtime
# and the packaging step both know where to look without either of them
# guessing at a generator's directory layout.
#
# `FluidEQ-DSP` rather than the CMake target's name: this is the one process in
# the tree that is not Electron, and a machine-readable name in Task Manager is
# a name nobody reads. Electron's own children cannot be distinguished this way
# — they are all one binary and share one file description — so this is the
# only row in that list that can say what it actually is.
set_target_properties(fluideq-dsp-host PROPERTIES
  OUTPUT_NAME "FluidEQ-DSP"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin"
)
