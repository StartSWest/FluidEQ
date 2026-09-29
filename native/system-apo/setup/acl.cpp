/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "acl.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <aclapi.h>

#include <initializer_list>
#include <string>
#include <vector>

#include "fs.h"

namespace fluideq_engine::setup {

namespace {

/** A well-known SID in a caller-owned buffer, so nothing has to be freed. */
class WellKnownSid {
 public:
  bool make(WELL_KNOWN_SID_TYPE type) {
    buffer_.assign(SECURITY_MAX_SID_SIZE, 0);
    DWORD size = static_cast<DWORD>(buffer_.size());
    if (CreateWellKnownSid(type, nullptr, buffer_.data(), &size) == 0) {
      return false;
    }
    buffer_.resize(size);
    return true;
  }
  PSID get() noexcept { return buffer_.data(); }

 private:
  std::vector<BYTE> buffer_;
};

/** One entry of a list: who, and what they may do. */
struct Grant {
  WELL_KNOWN_SID_TYPE who;
  DWORD rights;
};

/**
 * Modify: read, write, execute and delete — and deliberately not full
 * control, so nobody granted it can rewrite the permissions themselves.
 */
constexpr DWORD kModify =
    FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_GENERIC_EXECUTE | DELETE;
constexpr DWORD kReadOnly = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE;

void fill_entry(EXPLICIT_ACCESS_W& entry, PSID who, DWORD rights,
                DWORD inheritance) {
  entry.grfAccessPermissions = rights;
  entry.grfAccessMode = SET_ACCESS;
  entry.grfInheritance = inheritance;
  entry.Trustee.pMultipleTrustee = nullptr;
  entry.Trustee.MultipleTrusteeOperation = NO_MULTIPLE_TRUSTEE;
  entry.Trustee.TrusteeForm = TRUSTEE_IS_SID;
  entry.Trustee.TrusteeType = TRUSTEE_IS_WELL_KNOWN_GROUP;
  entry.Trustee.ptstrName = static_cast<LPWSTR>(who);
}

/**
 * SYSTEM full and Administrators full, then `grants`.
 *
 * The list REPLACES what was inherited (`PROTECTED_DACL_SECURITY_INFORMATION`)
 * rather than adding to it, which is also what lets a folder be tighter than
 * the one it sits inside: without the protected flag the parent's inheritable
 * entries would come straight back down into it. `inheritance` is both
 * container and object flags for a folder, so what is written into it later
 * carries the same list down, and none for a file.
 */
bool apply_acl(const std::wstring& path, std::initializer_list<Grant> grants,
               DWORD inheritance, std::wstring& error) {
  // Sized once, before any SID is made: each keeps its bytes in a buffer the
  // list below points into, and growing the vector would move them.
  std::vector<WellKnownSid> sids(grants.size() + 2);
  std::vector<EXPLICIT_ACCESS_W> entries(grants.size() + 2);
  bool made = sids[0].make(WinLocalSystemSid) &&
              sids[1].make(WinBuiltinAdministratorsSid);
  fill_entry(entries[0], sids[0].get(), FILE_ALL_ACCESS, inheritance);
  fill_entry(entries[1], sids[1].get(), FILE_ALL_ACCESS, inheritance);
  size_t at = 2;
  for (const Grant& grant : grants) {
    made = made && sids[at].make(grant.who);
    fill_entry(entries[at], sids[at].get(), grant.rights, inheritance);
    ++at;
  }
  if (!made) {
    error = L"could not build the security identifiers: " +
            describe_error(GetLastError());
    return false;
  }

  PACL list = nullptr;
  const DWORD built = SetEntriesInAclW(static_cast<ULONG>(entries.size()),
                                       entries.data(), nullptr, &list);
  if (built != ERROR_SUCCESS || list == nullptr) {
    error = L"could not build the permissions: " + describe_error(built);
    return false;
  }

  // A mutable copy: `SetNamedSecurityInfoW` takes a writable string even
  // though it does not change it.
  std::wstring target = path;
  const DWORD applied = SetNamedSecurityInfoW(
      target.data(), SE_FILE_OBJECT,
      DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
      nullptr, nullptr, list, nullptr);
  LocalFree(list);
  if (applied != ERROR_SUCCESS) {
    error = L"could not set the permissions on " + path + L": " +
            describe_error(applied);
    return false;
  }
  return true;
}

constexpr DWORD kFolder = CONTAINER_INHERIT_ACE | OBJECT_INHERIT_ACE;

/** Turns on one of this token's privileges; false when it has none such. */
bool enable_privilege(const wchar_t* name) {
  HANDLE token = nullptr;
  if (OpenProcessToken(GetCurrentProcess(),
                       TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &token) == 0) {
    return false;
  }
  TOKEN_PRIVILEGES privileges = {};
  privileges.PrivilegeCount = 1;
  privileges.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
  const bool enabled =
      LookupPrivilegeValueW(nullptr, name, &privileges.Privileges[0].Luid) !=
          0 &&
      AdjustTokenPrivileges(token, FALSE, &privileges, 0, nullptr, nullptr) !=
          0 &&
      // Succeeds without having assigned anything; this is how it says so.
      GetLastError() == ERROR_SUCCESS;
  CloseHandle(token);
  return enabled;
}

}  // namespace

bool take_ownership(const std::wstring& path, std::wstring& error) {
  WellKnownSid administrators;
  if (!administrators.make(WinBuiltinAdministratorsSid)) {
    error = L"could not build the security identifiers: " +
            describe_error(GetLastError());
    return false;
  }
  // Taking ownership needs no right on the folder's list, which may not name
  // administrators at all when the unelevated app created the folder; the
  // privilege is what allows it, and an elevated token holds it disabled.
  // Spelled wide: `SE_TAKE_OWNERSHIP_NAME` follows UNICODE, which this tree
  // does not define.
  enable_privilege(L"SeTakeOwnershipPrivilege");
  std::wstring target = path;
  const DWORD applied =
      SetNamedSecurityInfoW(target.data(), SE_FILE_OBJECT,
                            OWNER_SECURITY_INFORMATION, administrators.get(),
                            nullptr, nullptr, nullptr);
  if (applied != ERROR_SUCCESS) {
    error = L"could not take ownership of " + path + L": " +
            describe_error(applied);
    return false;
  }
  return true;
}

bool apply_engine_acl(const std::wstring& directory, std::wstring& error) {
  return apply_acl(directory,
                   {{WinLocalServiceSid, kModify}, {WinBuiltinUsersSid, kReadOnly}},
                   kFolder, error);
}

bool apply_config_acl(const std::wstring& directory, std::wstring& error) {
  return apply_acl(directory,
                   {{WinLocalServiceSid, kModify}, {WinBuiltinUsersSid, kModify}},
                   kFolder, error);
}

bool apply_read_only_acl(const std::wstring& directory, std::wstring& error) {
  return apply_acl(directory, {{WinBuiltinUsersSid, kReadOnly}}, kFolder,
                   error);
}

bool apply_log_acl(const std::wstring& file, std::wstring& error) {
  // FILE_APPEND_DATA and not FILE_WRITE_DATA or DELETE: a line can be added,
  // nothing already written can be changed, and the file cannot be swapped
  // for something else of the same name.
  return apply_acl(file,
                   {{WinBuiltinUsersSid, FILE_GENERIC_READ | FILE_APPEND_DATA}},
                   0, error);
}

bool service_can_write(const std::wstring& directory) {
  PACL dacl = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  if (GetNamedSecurityInfoW(directory.c_str(), SE_FILE_OBJECT,
                            DACL_SECURITY_INFORMATION, nullptr, nullptr, &dacl,
                            nullptr, &descriptor) != ERROR_SUCCESS) {
    // Unreadable permissions are not a verdict: answering "cannot write"
    // here would raise a repair prompt on a machine with nothing wrong.
    return true;
  }
  // A directory with no list at all is open to everyone, which is a yes.
  bool allowed = dacl == nullptr;
  bool denied = false;
  // The four trustees that can carry the right on a machine this program did
  // not set up: the account itself, and the three groups it belongs to that
  // an installer or an administrator might have granted instead.
  WellKnownSid service;
  WellKnownSid users;
  WellKnownSid authenticated;
  WellKnownSid everyone;
  const bool known = service.make(WinLocalServiceSid) &&
                     users.make(WinBuiltinUsersSid) &&
                     authenticated.make(WinAuthenticatedUserSid) &&
                     everyone.make(WinWorldSid);
  if (!known) {
    // The names could not be built, so nothing here can be compared: no
    // verdict, for the same reason an unreadable list gives none.
    LocalFree(descriptor);
    return true;
  }
  for (WORD at = 0; known && dacl != nullptr && !denied && at < dacl->AceCount;
       ++at) {
    LPVOID raw = nullptr;
    if (GetAce(dacl, at, &raw) == 0) {
      continue;
    }
    const auto* header = static_cast<const ACE_HEADER*>(raw);
    const bool allows = header->AceType == ACCESS_ALLOWED_ACE_TYPE;
    const bool refuses = header->AceType == ACCESS_DENIED_ACE_TYPE;
    if (!allows && !refuses) {
      continue;
    }
    // An entry marked inherit-only ("subfolders and files only" in the
    // security dialog) says nothing about this directory itself — it exists
    // to be handed down. Read as if it applied here, a hardening tool's
    // inherit-only deny would call a writable folder closed and raise a
    // repair on a healthy machine, and an inherit-only allow would hide a
    // real block.
    if ((header->AceFlags & INHERIT_ONLY_ACE) != 0) {
      continue;
    }
    // Both shapes put the mask and the SID in the same place; the type is
    // the only thing that differs, and it has already been read.
    const auto* ace = static_cast<const ACCESS_ALLOWED_ACE*>(raw);
    // `const_cast` because the SID field is an inline array the ACE owns and
    // every SID function takes a non-const pointer to it.
    PSID who = const_cast<PSID>(static_cast<const void*>(&ace->SidStart));
    if (EqualSid(who, service.get()) == 0 && EqualSid(who, users.get()) == 0 &&
        EqualSid(who, authenticated.get()) == 0 &&
        EqualSid(who, everyone.get()) == 0) {
      continue;
    }
    // Anything that can create a file here is enough: the effect writes its
    // own status and log and reads the configuration beside them.
    const bool writes =
        (ace->Mask & FILE_GENERIC_WRITE) == FILE_GENERIC_WRITE ||
        (ace->Mask & GENERIC_WRITE) == GENERIC_WRITE ||
        (ace->Mask & FILE_ALL_ACCESS) == FILE_ALL_ACCESS ||
        (ace->Mask & FILE_WRITE_DATA) == FILE_WRITE_DATA;
    if (!writes) {
      continue;
    }
    // A refusal anywhere in the list settles it. Windows evaluates deny
    // entries first and one of them is what a locked-down machine carries;
    // reading only the allow entries would call such a machine writable and
    // leave its silent engine unexplained — the failure this whole check
    // exists to catch.
    if (refuses) {
      denied = true;
    } else {
      allowed = true;
    }
  }
  LocalFree(descriptor);
  return allowed && !denied;
}

}  // namespace fluideq_engine::setup
