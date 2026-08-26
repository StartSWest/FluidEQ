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
  dsp-core/src/phase_align.cpp
  dsp-core/src/exciter_guard.cpp
  dsp-core/src/organic.cpp
)
target_include_directories(fluideq-dsp-core PUBLIC dsp-core/include)
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
add_executable(fluideq-dsp-parity-test dsp-core/tests/parity_test.cpp)
target_link_libraries(fluideq-dsp-parity-test
  PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME dsp-parity
  COMMAND fluideq-dsp-parity-test "${CMAKE_BINARY_DIR}/fixtures")

add_executable(fluideq-dsp-host
  dsp-host/src/main.cpp
)
target_link_libraries(fluideq-dsp-host PRIVATE fluideq-dsp-core feq_strict)

# The device backend, which is the only platform-specific code in the project.
# Every platform gets one, and the two that have no real implementation get a
# stub that refuses through the same channel a broken device would — a build
# that fails to link on macOS is a tree nobody notices breaking further.
if(WIN32)
  target_sources(fluideq-dsp-host PRIVATE
    dsp-host/src/platform/windows/wasapi_backend.cpp)
  # Both ship with Windows. WASAPI is a user-mode COM API: no driver, no
  # kernel component, nothing to install and nothing to sign.
  target_link_libraries(fluideq-dsp-host PRIVATE ole32 avrt)
else()
  target_sources(fluideq-dsp-host PRIVATE
    dsp-host/src/platform/unsupported_backend.cpp)
  find_package(Threads REQUIRED)
  target_link_libraries(fluideq-dsp-host PRIVATE Threads::Threads)
endif()
target_compile_definitions(fluideq-dsp-host PRIVATE
  FEQ_BUILD_REVISION="${FEQ_BUILD_REVISION}")

# One known place for the build to leave the host, so the development runtime
# and the packaging step both know where to look without either of them
# guessing at a generator's directory layout.
set_target_properties(fluideq-dsp-host PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin"
)
