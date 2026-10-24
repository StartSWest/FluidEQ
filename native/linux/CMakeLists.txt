#[[
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
]]

# Everything Linux-only lives under this directory: the FluidEQ Engine for
# Linux, and the DSP host's Linux device backend. The top-level list adds it
# on Linux alone, so Windows and macOS never configure a line of it.
#
# The engine reuses the Windows engine's processing unchanged — the config
# resolver, the graph and every stage in it, the status text — compiled from
# `system-apo/src` as they are. What is replaced is only what talks to the
# operating system: files, the log, the status write, the change watch, and
# the sound server itself.

set(FEQ_APO_SRC ${CMAKE_CURRENT_SOURCE_DIR}/../system-apo/src)

# A binary that is copied onto somebody else's distribution must not need
# this machine's libstdc++: GCC's runtime is linked in, and glibc is the only
# shared library left (plus the sound server, which is opened at run time).
set(FEQ_LINUX_PORTABLE_LINK -static-libstdc++ -static-libgcc)

add_library(fluideq-linux-compat STATIC compat/wide_path.cpp compat/sound_server.cpp)
target_include_directories(fluideq-linux-compat PUBLIC compat)
target_link_libraries(fluideq-linux-compat PRIVATE feq_strict)

# The shared engine, built for Linux. `compat/` stands in for the slice of
# <windows.h> that three of these files read files through (see
# compat/windows.h); everything else here has no Windows dependency at all.
add_library(fluideq-linux-engine-core STATIC
  ${FEQ_APO_SRC}/config.cpp
  ${FEQ_APO_SRC}/config_grammar.cpp
  ${FEQ_APO_SRC}/config_file.cpp
  ${FEQ_APO_SRC}/endpoint_config.cpp
  ${FEQ_APO_SRC}/programme.cpp
  ${FEQ_APO_SRC}/chain_signature.cpp
  ${FEQ_APO_SRC}/wav.cpp
  ${FEQ_APO_SRC}/graphic_eq.cpp
  ${FEQ_APO_SRC}/curve_phase.cpp
  ${FEQ_APO_SRC}/dsp_chain.cpp
  ${FEQ_APO_SRC}/graph.cpp
  ${FEQ_APO_SRC}/graph_handover.cpp
  ${FEQ_APO_SRC}/graph_reclaim.cpp
  ${FEQ_APO_SRC}/graph_stages.cpp
  ${FEQ_APO_SRC}/iir_cascade.cpp
  ${FEQ_APO_SRC}/curve_stage.cpp
  ${FEQ_APO_SRC}/eq_phase.cpp
  ${FEQ_APO_SRC}/linear_bands.cpp
  ${FEQ_APO_SRC}/output_guard.cpp
  ${FEQ_APO_SRC}/leveling_board.cpp
  ${FEQ_APO_SRC}/channel_layout.cpp
  ${FEQ_APO_SRC}/room_head.cpp
  ${FEQ_APO_SRC}/input_history.cpp
  ${FEQ_APO_SRC}/source_analysis.cpp
  ${FEQ_APO_SRC}/level_prediction.cpp
  ${FEQ_APO_SRC}/block_timing.cpp
  ${FEQ_APO_SRC}/status_json.cpp
  engine/paths_linux.cpp
  engine/log_linux.cpp
  engine/status_file_linux.cpp
)
target_include_directories(fluideq-linux-engine-core
  PUBLIC ${FEQ_APO_SRC} ${FEQ_APO_SRC}/../include)
target_link_libraries(fluideq-linux-engine-core
  PUBLIC fluideq-dsp-core fluideq-linux-compat
  PRIVATE feq_strict)
# `wav.cpp` includes <windows.h> inside its namespace; see windows_prelude.h.
set_source_files_properties(${FEQ_APO_SRC}/wav.cpp PROPERTIES COMPILE_OPTIONS
  "-include;${CMAKE_CURRENT_SOURCE_DIR}/compat/windows_prelude.h")

# PipeWire's headers, for declarations only: the library is opened at run
# time (pipewire/pw_api.h) and never linked, so this binary starts on a
# machine without it and says so. SYSTEM, because the SPA headers are C
# written for C and are not held to -Wpedantic -Werror.
#
# FEQ_PIPEWIRE_HEADERS names a directory holding `pipewire/` and `spa/` to
# build against instead of this machine's: build-portable.sh points it at a
# pinned release, because the oldest-glibc build image's own are from 2020.
set(FEQ_PIPEWIRE_HEADERS "" CACHE PATH
  "PipeWire and SPA headers to build against instead of pkg-config's")
if(FEQ_PIPEWIRE_HEADERS)
  set(FEQ_PIPEWIRE_FOUND TRUE)
  set(FEQ_PIPEWIRE_INCLUDE_DIRS ${FEQ_PIPEWIRE_HEADERS})
else()
  find_package(PkgConfig QUIET)
  if(PkgConfig_FOUND)
    pkg_check_modules(FEQ_PIPEWIRE QUIET libpipewire-0.3)
  endif()
endif()

find_package(Threads REQUIRED)

# The FluidEQ Engine for Linux. PulseAudio is always in (its few functions
# are declared by hand, pulse/pa_api.h); PipeWire joins when its headers are
# here, which every release build has — without them the engine runs on
# PulseAudio and on PipeWire through its PulseAudio layer.
add_library(fluideq-linux-pulse STATIC pulse/pa_api.cpp)
target_link_libraries(fluideq-linux-pulse PUBLIC ${CMAKE_DL_LIBS}
  PRIVATE feq_strict)

# The player's existing line protocol, backed by the desktop's default sink.
# PulseAudio's client API works on both PulseAudio and pipewire-pulse, so
# volume follows the same sink the desktop's sound controls already use.
add_executable(fluideq-linux-volume volume/main.cpp)
target_link_libraries(fluideq-linux-volume PRIVATE
  fluideq-linux-pulse Threads::Threads feq_strict)
target_link_options(fluideq-linux-volume PRIVATE ${FEQ_LINUX_PORTABLE_LINK})
set_target_properties(fluideq-linux-volume PROPERTIES
  OUTPUT_NAME "FluidEQ-Volume"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")

# The engine with no sound server in it: one output's graph, its watcher and
# what it writes for the app. The routers below feed it; the tests drive it.
add_library(fluideq-linux-engine-runtime STATIC
  engine/output_engine.cpp
  engine/output_watcher.cpp
  engine/output_watcher_report.cpp
  engine/outputs_file.cpp
  engine/analysis_link_linux.cpp
  ${FEQ_APO_SRC}/analysis_snapshot.cpp)
target_link_libraries(fluideq-linux-engine-runtime
  PUBLIC fluideq-linux-engine-core Threads::Threads PRIVATE feq_strict)

add_executable(fluideq-linux-engine engine/main.cpp engine/pulse_router.cpp
  engine/pulse_monitor.cpp engine/pulse_share.cpp)
target_link_libraries(fluideq-linux-engine PRIVATE
  fluideq-linux-engine-runtime fluideq-linux-pulse feq_strict)
target_link_options(fluideq-linux-engine PRIVATE ${FEQ_LINUX_PORTABLE_LINK})
# Beside the DSP host, under the name the packaging filter already ships
# (`FluidEQ-Engine*` in package.json's extraResources).
set_target_properties(fluideq-linux-engine PROPERTIES
  OUTPUT_NAME "FluidEQ-Engine"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")

if(FEQ_PIPEWIRE_FOUND)
  add_library(fluideq-linux-pipewire STATIC pipewire/pw_api.cpp)
  target_include_directories(fluideq-linux-pipewire SYSTEM
    PUBLIC ${FEQ_PIPEWIRE_INCLUDE_DIRS})
  target_link_libraries(fluideq-linux-pipewire PUBLIC ${CMAKE_DL_LIBS}
    PRIVATE feq_strict)
  target_sources(fluideq-linux-engine PRIVATE
    engine/pw_router.cpp engine/pw_streams.cpp engine/pw_monitor.cpp
    engine/pw_share.cpp)
  target_link_libraries(fluideq-linux-engine PRIVATE fluideq-linux-pipewire)
  target_compile_definitions(fluideq-linux-engine PRIVATE FEQ_LINUX_HAS_PIPEWIRE=1)
else()
  message(WARNING "PipeWire headers (libpipewire-0.3-dev / pipewire-devel) "
                  "not found: FluidEQ-Engine is built for PulseAudio only")
  target_compile_definitions(fluideq-linux-engine PRIVATE FEQ_LINUX_HAS_PIPEWIRE=0)
endif()

# The DSP host's Linux device backend, put into the host target defined in
# the top-level list without editing it: the shared stub's process
# measurement is replaced by the real one, and the shared stub backend stays
# as the last resort under another factory name (dsp-host/backend_select.cpp).
set(FEQ_HOST_SRC ${CMAKE_CURRENT_SOURCE_DIR}/../dsp-host/src)
get_target_property(feq_host_sources fluideq-dsp-host SOURCES)
list(REMOVE_ITEM feq_host_sources
  dsp-host/src/platform/unsupported_process_stats.cpp
  ${FEQ_HOST_SRC}/platform/unsupported_process_stats.cpp)
set_property(TARGET fluideq-dsp-host PROPERTY SOURCES ${feq_host_sources})
set_source_files_properties(${FEQ_HOST_SRC}/platform/unsupported_backend.cpp
  DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/..
  PROPERTIES COMPILE_DEFINITIONS
    "create_audio_backend=create_unsupported_audio_backend")
target_sources(fluideq-dsp-host PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/dsp-host/backend_select.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/dsp-host/alsa_backend.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/dsp-host/process_stats_linux.cpp)
target_link_libraries(fluideq-dsp-host PRIVATE fluideq-linux-compat ${CMAKE_DL_LIBS})
target_link_options(fluideq-dsp-host PRIVATE ${FEQ_LINUX_PORTABLE_LINK})
if(FEQ_PIPEWIRE_FOUND)
  target_sources(fluideq-dsp-host PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/dsp-host/pipewire_backend.cpp)
  target_link_libraries(fluideq-dsp-host PRIVATE fluideq-linux-pipewire)
else()
  # ALSA alone: the PipeWire factory refuses, and the choice falls through.
  target_sources(fluideq-dsp-host PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/dsp-host/pipewire_absent.cpp)
endif()

# Tests: the Linux parts on their own, and the engine end to end over a
# configuration folder (no sound server needed, so they run in CI too).
add_executable(fluideq-linux-parts-test tests/linux_parts_test.cpp)
target_link_libraries(fluideq-linux-parts-test PRIVATE
  fluideq-linux-engine-runtime feq_strict)
add_test(NAME linux-parts COMMAND fluideq-linux-parts-test)

add_executable(fluideq-linux-output-engine-test tests/output_engine_test.cpp)
target_link_libraries(fluideq-linux-output-engine-test PRIVATE
  fluideq-linux-engine-runtime feq_strict)
add_test(NAME linux-output-engine COMMAND fluideq-linux-output-engine-test)
set_tests_properties(linux-output-engine PROPERTIES TIMEOUT 60)

# The engine's version is the Windows engine's — the same processing, built
# for Linux — read from its version resource at configure time, so a merge
# from main that raises it raises the Linux one with it. The app gates its
# features on this number (`src/common/engineHealth.ts`), through outputs.json.
file(STRINGS ${FEQ_APO_SRC}/engine.rc feq_engine_rc_version
  REGEX "^FILEVERSION[ \t]+[0-9]+")
string(REGEX MATCHALL "[0-9]+" feq_engine_version_parts "${feq_engine_rc_version}")
string(JOIN "." FEQ_LINUX_ENGINE_VERSION ${feq_engine_version_parts})
target_compile_definitions(fluideq-linux-engine-runtime
  PUBLIC FEQ_ENGINE_FILE_VERSION="${FEQ_LINUX_ENGINE_VERSION}")
