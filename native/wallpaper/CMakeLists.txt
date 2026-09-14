cmake_minimum_required(VERSION 3.21)

# Also usable alone for a compiler check without rebuilding the audio engine.
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(fluideq_wallpaper LANGUAGES CXX)
  enable_testing()
endif()

if(WIN32)
  # The helper and its test build alike: the same Windows headers, the same
  # strict warnings the rest of the native tree holds itself to.
  function(fluideq_wallpaper_target target)
    target_compile_features(${target} PRIVATE cxx_std_20)
    target_compile_definitions(${target} PRIVATE
      UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX _WIN32_WINNT=0x0A00)
    if(TARGET feq_strict)
      target_link_libraries(${target} PRIVATE feq_strict)
    else()
      target_compile_options(${target} PRIVATE /W4 /WX /permissive- /GR-)
    endif()
  endfunction()

  add_executable(fluideq-wallpaper WIN32 main.cpp)
  set_target_properties(fluideq-wallpaper PROPERTIES
    OUTPUT_NAME "FluidEQ-Wallpaper"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
  fluideq_wallpaper_target(fluideq-wallpaper)
  target_link_libraries(fluideq-wallpaper PRIVATE user32 dwmapi shell32)
  target_compile_options(fluideq-wallpaper PRIVATE /Brepro)
  target_link_options(fluideq-wallpaper PRIVATE /Brepro)

  add_executable(fluideq-wallpaper-desktop-test tests/desktop_test.cpp)
  fluideq_wallpaper_target(fluideq-wallpaper-desktop-test)
  target_link_libraries(fluideq-wallpaper-desktop-test PRIVATE user32)
  add_test(NAME wallpaper-desktop COMMAND fluideq-wallpaper-desktop-test)
endif()
