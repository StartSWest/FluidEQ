# One press of one media key, sent to the whole machine.
#
# There is no per-application transport API to call here. Spotify, a browser
# tab, VLC and the app's own player all listen for the same three virtual keys
# a keyboard's media row sends, so pressing one is the only command that
# reaches every player at once — including the ones that are not running yet.
#
# The caller chooses the code, and it is checked again here. The set is closed
# on both sides deliberately: nothing on this path should be able to synthesise
# an arbitrary keystroke into whatever window happens to have focus.
param(
    # 0xB0 next, 0xB1 previous, 0xB3 play/pause. 0xB2 (stop) is absent because
    # nothing in the app sends it.
    #
    # Mandatory rather than defaulted: an unbound parameter skips ValidateSet
    # entirely, so a default would be the one value nobody had checked.
    [Parameter(Mandatory = $true)]
    [ValidateSet(176, 177, 179)]
    [int]$VirtualKey
)

$source = @'
using System;
using System.Runtime.InteropServices;

public static class FluidEqMediaKeys
{
    // Superseded by SendInput and still the right call for this: the media
    // keys are a broadcast rather than input aimed at a window, and this is
    // four arguments where SendInput is a struct layout to marshal by hand.
    [DllImport("user32.dll", SetLastError = true)]
    private static extern void keybd_event(
        byte bVk,
        byte bScan,
        uint dwFlags,
        UIntPtr dwExtraInfo);

    // The media keys arrive from a real keyboard with the E0 prefix set, and
    // applications that check for it ignore a press that does not have it.
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    public static void Press(byte virtualKey)
    {
        // Both halves, and the release is the half that matters: Windows turns
        // the key UP into the WM_APPCOMMAND that players actually act on. A
        // press with no release would also leave the system believing the key
        // is still held down, which is a stuck modifier for every application
        // on the desktop.
        keybd_event(virtualKey, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        keybd_event(
            virtualKey,
            0,
            KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP,
            UIntPtr.Zero);
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp
[FluidEqMediaKeys]::Press([byte]$VirtualKey)
