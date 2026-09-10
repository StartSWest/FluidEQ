#[[
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
]]

# The system-wide engine: an audio effect Windows loads into audiodg.exe for
# every output it is attached to, plus the helper that attaches it. Windows
# only, and deliberately split from the DSP host: the host is a process FluidEQ
# owns, the effect is code running inside somebody else's.

add_library(fluideq-engine-config STATIC src/config.cpp src/config_grammar.cpp)
target_include_directories(fluideq-engine-config PUBLIC include)
target_link_libraries(fluideq-engine-config PRIVATE feq_strict)

add_executable(fluideq-engine-config-test tests/config_test.cpp)
target_link_libraries(fluideq-engine-config-test PRIVATE fluideq-engine-config feq_strict)
add_test(NAME engine-config COMMAND fluideq-engine-config-test)

# The DSP side of the engine: reading an impulse response off disk, designing
# a graphic-EQ FIR from a resolved `Chain`, and the per-output processing
# graph that runs both of them alongside the biquads.
add_library(fluideq-engine-dsp STATIC
  src/wav.cpp src/graphic_eq.cpp src/dsp_chain.cpp src/graph.cpp)
# PUBLIC on both: `graphic_eq.h`'s `design_graphic_kernel` takes a
# `GraphicPoint` and `graph.h` takes a `Chain` — both defined in
# fluideq-engine-config's public header, so anything that links this library
# needs that include path too. `graph.h` names `FeqBiquadState` and
# `FeqConvolver` in its own members, so fluideq-dsp-core's headers are part of
# this library's interface for the same reason.
target_link_libraries(fluideq-engine-dsp
  PUBLIC fluideq-dsp-core fluideq-engine-config)
target_link_libraries(fluideq-engine-dsp PRIVATE feq_strict)

add_executable(fluideq-engine-wav-test tests/wav_test.cpp)
target_link_libraries(fluideq-engine-wav-test PRIVATE fluideq-engine-dsp feq_strict)
add_test(NAME engine-wav COMMAND fluideq-engine-wav-test)

add_executable(fluideq-engine-graphic-eq-test tests/graphic_eq_test.cpp)
target_link_libraries(fluideq-engine-graphic-eq-test
  PRIVATE fluideq-engine-dsp feq_strict)
add_test(NAME engine-graphic-eq COMMAND fluideq-engine-graphic-eq-test)

# The graph's biquads, preamp and state carry-over. Split from the
# convolution checks below: one file holding both was past the 500-line limit,
# and the two halves ask different questions — this one measures level in
# decibels, the other measures where in time a tap lands.
add_executable(fluideq-engine-graph-test tests/graph_test.cpp)
target_link_libraries(fluideq-engine-graph-test
  PRIVATE fluideq-engine-dsp feq_strict)
add_test(NAME engine-graph COMMAND fluideq-engine-graph-test)

add_executable(fluideq-engine-graph-convolution-test
  tests/graph_convolution_test.cpp)
target_link_libraries(fluideq-engine-graph-convolution-test
  PRIVATE fluideq-engine-dsp feq_strict)
add_test(NAME engine-graph-convolution
  COMMAND fluideq-engine-graph-convolution-test)

# The DSP rack running system-wide: the file the app writes, what the DLL
# decodes out of it, and where the rack sits relative to the EQ. Its own
# binary because its fixture is a line frozen from the TypeScript encoder —
# the only thing that can catch the two sides disagreeing about the layout.
add_executable(fluideq-engine-dsp-chain-test tests/dsp_chain_test.cpp)
target_link_libraries(fluideq-engine-dsp-chain-test
  PRIVATE fluideq-engine-dsp feq_strict)
add_test(NAME engine-dsp-chain COMMAND fluideq-engine-dsp-chain-test)

# The effect itself: the DLL Windows loads into audiodg.exe once per output it
# is attached to. `FluidEQ-Engine` rather than the target's name because this
# file's name is what someone debugging a broken audio stack reads out of the
# module list of a process they did not start.
add_library(fluideq-engine SHARED
  src/apo.cpp src/apo_format.cpp src/apo_process.cpp
  src/watcher.cpp src/chain_signature.cpp src/paths.cpp src/log.cpp
  src/dll.cpp
  # Exports by name, and a version resource so the module list can say whose
  # this is.
  src/engine.def src/engine.rc)
target_link_libraries(fluideq-engine PRIVATE
  fluideq-engine-config fluideq-engine-dsp feq_strict
  # `audiomediatypecrt` is the static library that carries
  # `CreateAudioMediaType`; there is no DLL to import it from.
  ole32 propsys mmdevapi shell32 audiomediatypecrt)
set_target_properties(fluideq-engine PROPERTIES
  OUTPUT_NAME "FluidEQ-Engine"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")
set_source_files_properties(src/engine.rc PROPERTIES COMPILE_DEFINITIONS
  "FEQ_ENGINE_VERSION_STRING=\"${FEQ_CORE_VERSION}\"")

# Both DLL tests load the DLL the way audiodg.exe does, so they take the path
# CMake put it at rather than one spelled out here.
#
# Two binaries rather than one: the COM surface and the audio path are
# different bugs with different owners, and one file covering both was past
# the 500-line limit.
add_executable(fluideq-engine-dll-smoke-test tests/dll_smoke_test.cpp)
target_link_libraries(fluideq-engine-dll-smoke-test
  PRIVATE feq_strict ole32 audiomediatypecrt)
add_test(NAME engine-dll-smoke
  COMMAND fluideq-engine-dll-smoke-test $<TARGET_FILE:fluideq-engine>)

add_executable(fluideq-engine-dll-process-test tests/dll_process_test.cpp)
target_link_libraries(fluideq-engine-dll-process-test
  PRIVATE feq_strict ole32 audiomediatypecrt)
add_test(NAME engine-dll-process
  COMMAND fluideq-engine-dll-process-test $<TARGET_FILE:fluideq-engine>)

# The decision the setup helper makes about an endpoint, with no Windows API
# anywhere near it. Split out from the helper's executable so the rules that
# decide what happens to somebody else's audio driver can be exercised on
# fixtures instead of on their speakers.
add_library(fluideq-engine-setup-core STATIC
  setup/fx_list.cpp setup/json.cpp setup/multi_sz.cpp)
target_link_libraries(fluideq-engine-setup-core PRIVATE feq_strict)

add_executable(fluideq-engine-fx-list-test tests/fx_list_test.cpp)
target_link_libraries(fluideq-engine-fx-list-test
  PRIVATE fluideq-engine-setup-core feq_strict)
add_test(NAME engine-fx-list COMMAND fluideq-engine-fx-list-test)

# Decoding the raw bytes of a registry string value, which is its own kind of
# bug: a `REG_MULTI_SZ` whose last entry has no terminator, or whose byte count
# is odd, is a heap over-read rather than a wrong effect list. Separate binary
# because the fixtures are byte buffers rather than endpoint shapes, and one
# file holding both was past the 500-line limit.
add_executable(fluideq-engine-multi-sz-test tests/multi_sz_test.cpp)
target_link_libraries(fluideq-engine-multi-sz-test
  PRIVATE fluideq-engine-setup-core feq_strict)
add_test(NAME engine-multi-sz COMMAND fluideq-engine-multi-sz-test)

# The helper that installs the effect, attaches it to outputs and takes it all
# back out again. It ships beside the DLL and runs in place; nothing else in
# the product writes the registry.
add_executable(fluideq-engine-setup
  setup/main.cpp setup/commands.cpp setup/registry.cpp
  setup/com_registration.cpp setup/endpoints.cpp
  setup/elevate.cpp setup/services.cpp setup/acl.cpp setup/backup.cpp
  setup/fs.cpp setup/console.cpp
  # The version resource is what the consent prompt shows the user before
  # they decide whether to let this program change their machine.
  setup/setup.rc)
target_link_libraries(fluideq-engine-setup PRIVATE
  fluideq-engine-setup-core feq_strict
  # advapi32: the registry, the service control manager and the security
  # descriptor. shell32: the known folders and the elevated relaunch. ole32:
  # the device enumerator. version: the installed DLL's version resource.
  advapi32 shell32 ole32 version)
set_target_properties(fluideq-engine-setup PROPERTIES
  OUTPUT_NAME "FluidEQ-Engine-Setup"
  # The windows subsystem, so Windows never gives this program a console of
  # its own. The installer has to run it through StdUtils' `ExecShellWaitEx`
  # to read its exit code at all, and that call hard-codes `SW_SHOWNORMAL` —
  # as a console program it flashed a black window on screen during every
  # install and every uninstall, with nothing the .nsh could pass to stop it.
  # It still prints: `setup/console.cpp` borrows the caller's console or pipe.
  WIN32_EXECUTABLE TRUE
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")
set_source_files_properties(setup/setup.rc PROPERTIES COMPILE_DEFINITIONS
  "FEQ_SETUP_VERSION_STRING=\"${FEQ_CORE_VERSION}\"")
# Embedded rather than left beside the executable: a manifest in a separate
# file is one the helper can be run without, and a helper running without its
# manifest is one Windows decides the elevation policy for by guessing at the
# file name.
target_link_options(fluideq-engine-setup PRIVATE
  "/MANIFEST:EMBED"
  "/MANIFESTINPUT:${CMAKE_CURRENT_SOURCE_DIR}/setup/setup.manifest"
  # Spelled out rather than left to the linker's guess at which start-up
  # routine goes with which entry point: the wide one is what keeps endpoint
  # names and paths out of the ANSI code page.
  "/ENTRY:wWinMainCRTStartup")
