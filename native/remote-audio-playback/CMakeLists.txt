cmake_minimum_required(VERSION 3.21)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(fluideq_remote_playback LANGUAGES CXX)
  enable_testing()
endif()

function(feq_playback_target target)
  target_compile_features(${target} PRIVATE cxx_std_20)
  if(TARGET feq_strict)
    target_link_libraries(${target} PRIVATE feq_strict)
  elseif(MSVC)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive- /GR- /fp:precise)
  else()
    target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic -Werror)
  endif()
  if(MSVC)
    target_compile_options(${target} PRIVATE /Brepro)
    target_link_options(${target} PRIVATE /Brepro)
  endif()
endfunction()

add_library(fluideq-playback-core STATIC src/playback_core.cpp src/sinc_kernel.cpp)
target_include_directories(fluideq-playback-core PUBLIC src)
feq_playback_target(fluideq-playback-core)

add_executable(fluideq-remote-playback-test tests/playback_test.cpp)
target_link_libraries(fluideq-remote-playback-test PRIVATE fluideq-playback-core)
feq_playback_target(fluideq-remote-playback-test)
add_test(NAME remote-playback COMMAND fluideq-remote-playback-test)

if(WIN32 AND EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/main.cpp")
  add_executable(fluideq-remote-audio-playback
    src/main.cpp src/wasapi_output.cpp src/playback_runtime.cpp src/replies.cpp
    src/capture_children.cpp)
  feq_playback_target(fluideq-remote-audio-playback)
  target_compile_definitions(fluideq-remote-audio-playback PRIVATE
    UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX _WIN32_WINNT=0x0A00)
  target_link_libraries(fluideq-remote-audio-playback PRIVATE
    fluideq-playback-core ole32 avrt mmdevapi)
  set_target_properties(fluideq-remote-audio-playback PROPERTIES
    OUTPUT_NAME "FluidEQ-LAN-Playback"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")
  add_executable(fluideq-capture-request-test tests/capture_request_test.cpp src/capture_children.cpp)
  feq_playback_target(fluideq-capture-request-test)
  target_include_directories(fluideq-capture-request-test PRIVATE src)
  target_compile_definitions(fluideq-capture-request-test PRIVATE
    UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX _WIN32_WINNT=0x0A00)
  add_test(NAME capture-request COMMAND fluideq-capture-request-test)
  # The no-echo guarantee of Share Audio both ways, on the real helpers. It
  # plays an inaudible tone through the default output and skips (77) where
  # there is none.
  if(TARGET fluideq-remote-audio-capture)
    add_executable(fluideq-echo-tree-test tests/echo_tree_test.cpp)
    feq_playback_target(fluideq-echo-tree-test)
    target_compile_definitions(fluideq-echo-tree-test PRIVATE
      UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX _WIN32_WINNT=0x0A00)
    target_link_libraries(fluideq-echo-tree-test PRIVATE ole32 mmdevapi)
    add_dependencies(fluideq-echo-tree-test fluideq-remote-audio-playback fluideq-remote-audio-capture)
    add_test(NAME echo-tree COMMAND fluideq-echo-tree-test $<TARGET_FILE:fluideq-remote-audio-playback>)
    set_tests_properties(echo-tree PROPERTIES SKIP_RETURN_CODE 77)
  endif()
endif()
