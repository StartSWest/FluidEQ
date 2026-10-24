enable_language(OBJCXX)
add_executable(fluideq-mac-remote-audio
  main.cpp io.cpp playback.cpp capture.mm
  ../mac-engine/src/output_devices.cpp
  ../mac-engine/src/audio_permission.cpp
  ../dsp-host/src/parent_watch.cpp
  ../dsp-host/src/platform/macos/coreaudio_backend.cpp
  ../remote-audio-capture/src/capture_queue.cpp)
target_include_directories(fluideq-mac-remote-audio PRIVATE
  ../mac-engine/src ../dsp-host/src ../remote-audio-capture/src)
target_link_libraries(fluideq-mac-remote-audio PRIVATE
  fluideq-playback-core fluideq-dsp-core feq_strict
  "-framework CoreAudio" "-framework CoreFoundation"
  "-framework AudioUnit" "-framework Foundation" proc)
set_source_files_properties(capture.mm PROPERTIES COMPILE_OPTIONS "-fobjc-arc")
set_target_properties(fluideq-mac-remote-audio PROPERTIES
  OUTPUT_NAME "FluidEQ-LAN-Playback"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")

add_executable(fluideq-mac-share-source
  tests/tone_source.cpp ../dsp-host/src/parent_watch.cpp
  ../dsp-host/src/platform/macos/coreaudio_backend.cpp)
target_include_directories(fluideq-mac-share-source PRIVATE ../dsp-host/src)
target_link_libraries(fluideq-mac-share-source PRIVATE feq_strict
  "-framework CoreAudio" "-framework AudioUnit")

find_program(FEQ_SHARE_NODE node)
if(FEQ_SHARE_NODE)
  add_test(NAME mac-share-probe
    COMMAND "${FEQ_SHARE_NODE}" --test "${CMAKE_CURRENT_SOURCE_DIR}/tests/probe.test.cjs")
  add_test(NAME mac-share-audio
    COMMAND "${FEQ_SHARE_NODE}" "${CMAKE_CURRENT_SOURCE_DIR}/tests/duplex.cjs"
      $<TARGET_FILE:fluideq-mac-remote-audio>
      $<TARGET_FILE:fluideq-mac-share-source>
      $<TARGET_FILE:fluideq-mac-engine>)
  set_tests_properties(mac-share-audio PROPERTIES SKIP_RETURN_CODE 77)
endif()
