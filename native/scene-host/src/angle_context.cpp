/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// EGL on ANGLE's Direct3D 11, an off-screen surface, and the GLES entry
// points by name from libGLESv2.dll.

#include "angle_api.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <array>
#include <cstring>

namespace feq::scene::gl {
namespace {

using EGLDisplay = void*;
using EGLConfig = void*;
using EGLSurface = void*;
using EGLContext = void*;
using EGLint = std::int32_t;
using EGLBoolean = unsigned int;
using EGLenum = unsigned int;

constexpr EGLint kEglNone = 0x3038;
constexpr EGLint kEglRedSize = 0x3024;
constexpr EGLint kEglGreenSize = 0x3023;
constexpr EGLint kEglBlueSize = 0x3022;
constexpr EGLint kEglAlphaSize = 0x3021;
constexpr EGLint kEglSurfaceType = 0x3033;
constexpr EGLint kEglPbufferBit = 0x0001;
constexpr EGLint kEglRenderableType = 0x3040;
constexpr EGLint kEglOpenglEs3Bit = 0x0040;
constexpr EGLint kEglWidth = 0x3057;
constexpr EGLint kEglHeight = 0x3056;
constexpr EGLint kEglContextMajorVersion = 0x3098;
constexpr EGLint kEglContextMinorVersion = 0x30FB;
constexpr EGLenum kEglOpenglEsApi = 0x30A0;
constexpr EGLenum kEglPlatformAngle = 0x3202;
constexpr EGLint kEglPlatformAngleType = 0x3203;
constexpr EGLint kEglPlatformAngleTypeD3d11 = 0x3208;

}  // namespace

struct Context::Egl {
  void* (*GetProcAddress)(const char*) = nullptr;
  EGLDisplay (*GetPlatformDisplayEXT)(EGLenum, void*, const EGLint*) = nullptr;
  EGLBoolean (*Initialize)(EGLDisplay, EGLint*, EGLint*) = nullptr;
  EGLBoolean (*ChooseConfig)(EGLDisplay, const EGLint*, EGLConfig*, EGLint,
                             EGLint*) = nullptr;
  EGLBoolean (*BindAPI)(EGLenum) = nullptr;
  EGLSurface (*CreatePbufferSurface)(EGLDisplay, EGLConfig,
                                     const EGLint*) = nullptr;
  EGLContext (*CreateContext)(EGLDisplay, EGLConfig, EGLContext,
                              const EGLint*) = nullptr;
  EGLBoolean (*MakeCurrent)(EGLDisplay, EGLSurface, EGLSurface,
                            EGLContext) = nullptr;
  EGLBoolean (*DestroySurface)(EGLDisplay, EGLSurface) = nullptr;
  EGLBoolean (*DestroyContext)(EGLDisplay, EGLContext) = nullptr;
  EGLBoolean (*Terminate)(EGLDisplay) = nullptr;
};

namespace {

template <typename F>
bool take(HMODULE module, const char* name, F& into) {
  into = reinterpret_cast<F>(
      reinterpret_cast<void*>(::GetProcAddress(module, name)));
  return into != nullptr;
}

bool load_egl(HMODULE m, Context::Egl& e) {
  if (!take(m, "eglGetProcAddress", e.GetProcAddress) ||
      !take(m, "eglInitialize", e.Initialize) ||
      !take(m, "eglChooseConfig", e.ChooseConfig) ||
      !take(m, "eglBindAPI", e.BindAPI) ||
      !take(m, "eglCreatePbufferSurface", e.CreatePbufferSurface) ||
      !take(m, "eglCreateContext", e.CreateContext) ||
      !take(m, "eglMakeCurrent", e.MakeCurrent) ||
      !take(m, "eglDestroySurface", e.DestroySurface) ||
      !take(m, "eglDestroyContext", e.DestroyContext) ||
      !take(m, "eglTerminate", e.Terminate)) {
    return false;
  }
  e.GetPlatformDisplayEXT =
      reinterpret_cast<decltype(e.GetPlatformDisplayEXT)>(
          e.GetProcAddress("eglGetPlatformDisplayEXT"));
  return e.GetPlatformDisplayEXT != nullptr;
}

bool load_gles(HMODULE m, Api& a) {
  return take(m, "glCreateShader", a.CreateShader) &&
         take(m, "glShaderSource", a.ShaderSource) &&
         take(m, "glCompileShader", a.CompileShader) &&
         take(m, "glGetShaderiv", a.GetShaderiv) &&
         take(m, "glGetShaderInfoLog", a.GetShaderInfoLog) &&
         take(m, "glCreateProgram", a.CreateProgram) &&
         take(m, "glAttachShader", a.AttachShader) &&
         take(m, "glLinkProgram", a.LinkProgram) &&
         take(m, "glGetProgramiv", a.GetProgramiv) &&
         take(m, "glGetProgramInfoLog", a.GetProgramInfoLog) &&
         take(m, "glDeleteShader", a.DeleteShader) &&
         take(m, "glDeleteProgram", a.DeleteProgram) &&
         take(m, "glUseProgram", a.UseProgram) &&
         take(m, "glGetUniformLocation", a.GetUniformLocation) &&
         take(m, "glUniform1f", a.Uniform1f) &&
         take(m, "glUniform2f", a.Uniform2f) &&
         take(m, "glUniform3f", a.Uniform3f) &&
         take(m, "glUniform4f", a.Uniform4f) &&
         take(m, "glUniform1i", a.Uniform1i) &&
         take(m, "glGenTextures", a.GenTextures) &&
         take(m, "glDeleteTextures", a.DeleteTextures) &&
         take(m, "glBindTexture", a.BindTexture) &&
         take(m, "glTexImage2D", a.TexImage2D) &&
         take(m, "glTexSubImage2D", a.TexSubImage2D) &&
         take(m, "glTexParameteri", a.TexParameteri) &&
         take(m, "glPixelStorei", a.PixelStorei) &&
         take(m, "glActiveTexture", a.ActiveTexture) &&
         take(m, "glGenerateMipmap", a.GenerateMipmap) &&
         take(m, "glGenVertexArrays", a.GenVertexArrays) &&
         take(m, "glBindVertexArray", a.BindVertexArray) &&
         take(m, "glDeleteVertexArrays", a.DeleteVertexArrays) &&
         take(m, "glViewport", a.Viewport) &&
         take(m, "glDrawArrays", a.DrawArrays) &&
         take(m, "glReadPixels", a.ReadPixels) &&
         take(m, "glClearColor", a.ClearColor) && take(m, "glClear", a.Clear) &&
         take(m, "glGetError", a.GetError) && take(m, "glFinish", a.Finish) &&
         take(m, "glGenFramebuffers", a.GenFramebuffers) &&
         take(m, "glBindFramebuffer", a.BindFramebuffer) &&
         take(m, "glFramebufferTexture2D", a.FramebufferTexture2D) &&
         take(m, "glCheckFramebufferStatus", a.CheckFramebufferStatus) &&
         take(m, "glDeleteFramebuffers", a.DeleteFramebuffers) &&
         take(m, "glBlitFramebuffer", a.BlitFramebuffer) &&
         take(m, "glGetString", a.GetString);
}

HMODULE load_from(const std::wstring& dir, const wchar_t* name) {
  const std::wstring path = dir + L"\\" + name;
  // ANGLE finds d3dcompiler_47.dll in its own folder: that folder is where
  // the libraries look, then System32, and nowhere a user could plant one.
  return ::LoadLibraryExW(path.c_str(), nullptr,
                          LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR |
                              LOAD_LIBRARY_SEARCH_SYSTEM32);
}

}  // namespace

Context::Context() : egl_(std::make_unique<Egl>()) {}

Context* Context::create(const std::wstring& angle_dir, int width, int height,
                         std::string& why) {
  auto context = std::unique_ptr<Context>(new Context());
  auto* egl_module = load_from(angle_dir, L"libEGL.dll");
  auto* gles_module = load_from(angle_dir, L"libGLESv2.dll");
  context->egl_module_ = egl_module;
  context->gles_module_ = gles_module;
  if (egl_module == nullptr || gles_module == nullptr) {
    why = "ANGLE's libraries were not found beside the app";
    return nullptr;
  }
  Egl& egl = *context->egl_;
  if (!load_egl(egl_module, egl)) {
    why = "libEGL.dll lacks a call the scenes need";
    return nullptr;
  }
  if (!load_gles(gles_module, context->api_)) {
    why = "libGLESv2.dll lacks a call the scenes need";
    return nullptr;
  }
  const std::array<EGLint, 3> display_attributes{
      kEglPlatformAngleType, kEglPlatformAngleTypeD3d11, kEglNone};
  context->display_ = egl.GetPlatformDisplayEXT(kEglPlatformAngle, nullptr,
                                                display_attributes.data());
  if (context->display_ == nullptr ||
      egl.Initialize(context->display_, nullptr, nullptr) == 0) {
    why = "Direct3D 11 could not be opened through ANGLE";
    return nullptr;
  }
  egl.BindAPI(kEglOpenglEsApi);
  const std::array<EGLint, 13> config_attributes{
      kEglRedSize,   8, kEglGreenSize,      8, kEglBlueSize,
      8,             kEglAlphaSize,      8, kEglSurfaceType,
      kEglPbufferBit, kEglRenderableType, kEglOpenglEs3Bit, kEglNone};
  EGLint found = 0;
  if (egl.ChooseConfig(context->display_, config_attributes.data(),
                       &context->config_, 1, &found) == 0 ||
      found == 0) {
    why = "no RGBA off-screen configuration for OpenGL ES 3";
    return nullptr;
  }
  const std::array<EGLint, 5> context_attributes{
      kEglContextMajorVersion, 3, kEglContextMinorVersion, 0, kEglNone};
  context->context_ = egl.CreateContext(context->display_, context->config_,
                                        nullptr, context_attributes.data());
  if (context->context_ == nullptr) {
    why = "an OpenGL ES 3.0 context could not be made";
    return nullptr;
  }
  if (!context->resize(width, height)) {
    why = "the off-screen surface could not be made current";
    return nullptr;
  }
  // A scene links on ANGLE's own threads while the one on the lamps keeps
  // drawing, as the window links one (`sceneCompile.ts`): the extension is
  // asked for by name and switched on with as many threads as ANGLE likes.
  const auto* extensions = reinterpret_cast<const char*>(
      context->api_.GetString(kExtensions));
  if (extensions != nullptr &&
      std::strstr(extensions, "GL_KHR_parallel_shader_compile") != nullptr &&
      take(static_cast<HMODULE>(gles_module), "glMaxShaderCompilerThreadsKHR",
           context->api_.MaxShaderCompilerThreads)) {
    context->api_.MaxShaderCompilerThreads(0xFFFFFFFFU);
  } else {
    context->api_.MaxShaderCompilerThreads = nullptr;
  }
  return context.release();
}

bool Context::resize(int width, int height) {
  Egl& egl = *egl_;
  const std::array<EGLint, 5> surface_attributes{kEglWidth, width, kEglHeight,
                                                 height, kEglNone};
  void* next = egl.CreatePbufferSurface(display_, config_,
                                        surface_attributes.data());
  if (next == nullptr ||
      egl.MakeCurrent(display_, next, next, context_) == 0) {
    if (next != nullptr) {
      egl.DestroySurface(display_, next);
    }
    return false;
  }
  if (surface_ != nullptr) {
    egl.DestroySurface(display_, surface_);
  }
  surface_ = next;
  return true;
}

Context::~Context() {
  if (display_ != nullptr) {
    Egl& egl = *egl_;
    egl.MakeCurrent(display_, nullptr, nullptr, nullptr);
    if (surface_ != nullptr) {
      egl.DestroySurface(display_, surface_);
    }
    if (context_ != nullptr) {
      egl.DestroyContext(display_, context_);
    }
    egl.Terminate(display_);
  }
  if (gles_module_ != nullptr) {
    ::FreeLibrary(static_cast<HMODULE>(gles_module_));
  }
  if (egl_module_ != nullptr) {
    ::FreeLibrary(static_cast<HMODULE>(egl_module_));
  }
}

}  // namespace feq::scene::gl
