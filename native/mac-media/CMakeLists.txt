# FluidEQ — GPL-3.0-or-later
enable_language(OBJC)
add_library(fluideq-mac-media SHARED media.m vendor/MediaRemote.m)
target_include_directories(fluideq-mac-media PRIVATE vendor)
target_compile_options(fluideq-mac-media PRIVATE -fobjc-arc -Wall -Wextra)
target_link_libraries(fluideq-mac-media PRIVATE
  "-framework Foundation" "-framework AppKit")
set_target_properties(fluideq-mac-media PROPERTIES
  FRAMEWORK TRUE FRAMEWORK_VERSION A OUTPUT_NAME FluidEQMedia
  MACOSX_FRAMEWORK_IDENTIFIER com.gigabytz.fluideq.media
  LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin/mac-media")
configure_file(media-host.pl "${CMAKE_BINARY_DIR}/bin/mac-media/media-host.pl" COPYONLY)
configure_file(vendor/LICENSE "${CMAKE_BINARY_DIR}/bin/mac-media/LICENSE.txt" COPYONLY)
