/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "acl.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <aclapi.h>

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

void fill_entry(EXPLICIT_ACCESS_W& entry, PSID who, DWORD rights) {
  entry.grfAccessPermissions = rights;
  entry.grfAccessMode = SET_ACCESS;
  // Both flags: the configuration files live directly in a subdirectory, and
  // the subdirectories themselves have to carry the same permissions down to
  // whatever the app writes next.
  entry.grfInheritance = CONTAINER_INHERIT_ACE | OBJECT_INHERIT_ACE;
  entry.Trustee.pMultipleTrustee = nullptr;
  entry.Trustee.MultipleTrusteeOperation = NO_MULTIPLE_TRUSTEE;
  entry.Trustee.TrusteeForm = TRUSTEE_IS_SID;
  entry.Trustee.TrusteeType = TRUSTEE_IS_WELL_KNOWN_GROUP;
  entry.Trustee.ptstrName = static_cast<LPWSTR>(who);
}

/**
 * SYSTEM full, Administrators full, Users whatever `user_rights` says.
 *
 * The list REPLACES what was inherited (`PROTECTED_DACL_SECURITY_INFORMATION`)
 * rather than adding to it, which is also what lets `backup\` be tighter than
 * the root it sits inside: without the protected flag the root's inheritable
 * "Users modify" would come straight back down into it.
 */
bool apply_acl(const std::wstring& directory, DWORD user_rights,
               std::wstring& error) {
  WellKnownSid system;
  WellKnownSid administrators;
  WellKnownSid users;
  if (!system.make(WinLocalSystemSid) ||
      !administrators.make(WinBuiltinAdministratorsSid) ||
      !users.make(WinBuiltinUsersSid)) {
    error = L"could not build the security identifiers: " +
            describe_error(GetLastError());
    return false;
  }

  EXPLICIT_ACCESS_W entries[3] = {};
  fill_entry(entries[0], system.get(), FILE_ALL_ACCESS);
  fill_entry(entries[1], administrators.get(), FILE_ALL_ACCESS);
  fill_entry(entries[2], users.get(), user_rights);

  PACL list = nullptr;
  const DWORD built = SetEntriesInAclW(3, entries, nullptr, &list);
  if (built != ERROR_SUCCESS || list == nullptr) {
    error = L"could not build the permissions: " + describe_error(built);
    return false;
  }

  // A mutable copy: `SetNamedSecurityInfoW` takes a writable string even
  // though it does not change it.
  std::wstring path = directory;
  const DWORD applied = SetNamedSecurityInfoW(
      path.data(), SE_FILE_OBJECT,
      DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
      nullptr, nullptr, list, nullptr);
  LocalFree(list);
  if (applied != ERROR_SUCCESS) {
    error = L"could not set the permissions on " + directory + L": " +
            describe_error(applied);
    return false;
  }
  return true;
}

}  // namespace

bool apply_engine_acl(const std::wstring& directory, std::wstring& error) {
  // Modify, which is read, write, execute and delete — and deliberately not
  // full control: an ordinary user has no reason to be able to rewrite the
  // permissions on a directory the audio engine reads.
  return apply_acl(directory,
                   FILE_GENERIC_READ | FILE_GENERIC_WRITE |
                       FILE_GENERIC_EXECUTE | DELETE,
                   error);
}

bool apply_backup_acl(const std::wstring& directory, std::wstring& error) {
  // Read, and no DELETE. See `acl.h`: a deleted backup is a detach with
  // nothing to restore from, which leaves mirrored composite entries on a
  // vendor's endpoint for good.
  return apply_acl(directory, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE, error);
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
