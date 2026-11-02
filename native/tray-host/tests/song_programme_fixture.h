// Written by .erb/scripts/generate-sound-hops-fixture.ts from
// src/main/songProgrammeFixture.ts. Do not edit; regenerate.
#pragma once

namespace feq::tray::fixture {

struct Song {
  const char* app;
  const char* title;
  const char* artist;
  const char* identity;
};

inline constexpr Song kSongs[] = {
    {"Spotify.exe", "Bohemian Rhapsody", "Queen", "c13b9c6571b8bde3"},
    {"Chrome", "  Lose Yourself\011", " Eminem ", "12a4dd02db5e0725"},
    {"Spotify.exe", "\302\240\303\211t\303\251 Indien\343\200\200", "\357\273\277Joe Dassin", "3605c02c4ca09d16"},
    {"Spotify.exe", "Stra\303\237e", "KRAFTWERK", "b42cc91c2b5830f6"},
    {"Spotify.exe", "\304\260STANBUL", "\303\207A\304\236DA\305\236", "d238425c2ba2a181"},
    {"Spotify.exe", "\316\237\316\224\316\237\316\243 \316\243\316\244\316\237 \316\246\316\251\316\243", "\316\243\316\251\316\232\316\241\316\221\316\244\316\227\316\243", "68ad0e369ca50ec7"},
    {"Spotify.exe", "\320\232\320\220\320\242\320\256\320\250\320\220", "\320\220\320\275\321\201\320\260\320\274\320\261\320\273\321\214", "08efb1b2f5ddd1c6"},
    {"Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic", "\345\244\234\343\201\253\351\247\206\343\201\221\343\202\213", "YOASOBI", "fa80922127fbb583"},
    {"Chrome", "Happy \360\237\216\211 Song", "", "81356cfd59ef5290"},
    {"", "Untitled", "", "1dcb4e4e446a52e2"},
    {"Spotify.exe", "\342\200\250Line\342\200\251", "\341\232\200Ogham\342\200\257", "97d3c6a735e56d3d"},
    {"Spotify.exe", "\342\200\212Hair\342\200\200", "Space\342\201\237", "8614ad7733a3589e"},
};

struct Programme {
  double level;
  double peak;
  const char* text;
};

// A known song at each level, its peak a tenth of a dB under it.
inline constexpr Programme kProgrammes[] = {
    {-14.125, -14.225, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-14.13\015\012peak=-14.22\015\012"},
    {-14.135, -14.235, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-14.13\015\012peak=-14.23\015\012"},
    {-9.995, -10.094999999999999, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-9.99\015\012peak=-10.09\015\012"},
    {-0.005, -0.10500000000000001, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-0.01\015\012peak=-0.11\015\012"},
    {-0.001, -0.101, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-0.00\015\012peak=-0.10\015\012"},
    {-0.0, -0.1, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=0.00\015\012peak=-0.10\015\012"},
    {0.0, -0.1, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=0.00\015\012peak=-0.10\015\012"},
    {0.125, 0.024999999999999994, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=0.13\015\012peak=0.02\015\012"},
    {3.14159, 3.04159, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=3.14\015\012peak=3.04\015\012"},
    {-23.4, -23.5, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-23.40\015\012peak=-23.50\015\012"},
    {-70.0, -70.1, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-70.00\015\012peak=-70.10\015\012"},
    {12.5, 12.4, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=12.50\015\012peak=12.40\015\012"},
    {-6.375, -6.475, "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012level=-6.38\015\012peak=-6.47\015\012"},
};

inline constexpr const char* kUnknownSong = "# FluidEQ Engine programme v1\015\012song=0123456789abcdef\015\012";
inline constexpr const char* kNoSong = "# FluidEQ Engine programme v1\015\012";

}  // namespace feq::tray::fixture
