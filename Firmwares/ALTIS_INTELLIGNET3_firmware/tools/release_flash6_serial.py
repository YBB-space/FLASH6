"""Release FLASH6 Web Serial ownership before a PlatformIO USB upload.

The local FLASH6 page polls a small JSON handoff file while Web Serial is
connected.  A PlatformIO upload marks the handoff active, waits until the
browser closes the port, and only then lets esptool continue.
"""

Import("env")

import atexit
import glob
import json
import os
import subprocess
import time
import uuid
from pathlib import Path


PROJECT_DIR = Path(env.subst("$PROJECT_DIR"))
WORKSPACE_DIR = PROJECT_DIR.parents[1]
HANDOFF_PATH = WORKSPACE_DIR / "GCS_Projects" / "FLASH6" / "platformio-upload-handoff.json"
HANDOFF_TIMEOUT_SECONDS = 12.0
HANDOFF_POLL_GRACE_SECONDS = 1.25
_handoff_original = None
_handoff_active = False
_parked_browser_tabs = []


SUPPORTED_BROWSER_NAMES = {
    "Whale": ("Whale",),
    "Google Chrome": ("Google Chrome",),
    "Chromium": ("Chromium",),
    "Brave Browser": ("Brave Browser",),
    "Microsoft Edge": ("Microsoft Edge",),
}


def _write_handoff(payload):
    HANDOFF_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = HANDOFF_PATH.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    temporary.replace(HANDOFF_PATH)


def _restore_handoff():
    global _handoff_active
    if not _handoff_active:
        return
    try:
        if _handoff_original is None:
            HANDOFF_PATH.unlink(missing_ok=True)
        else:
            HANDOFF_PATH.write_bytes(_handoff_original)
    except Exception as exc:
        print(f"[FLASH6] serial handoff cleanup warning: {exc}")
    _handoff_active = False
    _restore_browser_tabs()
    _resume_browser_serial()


atexit.register(_restore_handoff)


def _candidate_upload_ports(build_env):
    configured = str(build_env.subst("$UPLOAD_PORT") or "").strip()
    if configured and "$" not in configured and "*" not in configured:
        return [configured]
    ports = []
    for pattern in (
        "/dev/cu.usbmodem*",
        "/dev/tty.usbmodem*",
        "/dev/cu.usbserial*",
        "/dev/tty.usbserial*",
    ):
        ports.extend(sorted(glob.glob(pattern)))
    unique = []
    for port in ports:
        if port and port not in unique:
            unique.append(port)
    return unique


def _port_is_available(port):
    try:
        import serial

        handle = serial.Serial(
            port=port,
            baudrate=115200,
            timeout=0,
            write_timeout=0,
            exclusive=True,
        )
        handle.close()
        return True
    except TypeError:
        # Older pyserial builds do not expose the exclusive keyword.
        pass
    except Exception:
        return False

    descriptor = None
    try:
        descriptor = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        return True
    except OSError:
        return False
    finally:
        if descriptor is not None:
            os.close(descriptor)


def _run_osascript(script, timeout=4.0):
    if os.uname().sysname != "Darwin":
        return None
    try:
        result = subprocess.run(
            ["osascript"],
            input=script,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _apple_script_string(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def _port_owner_browser_names(ports):
    if os.uname().sysname != "Darwin":
        return []
    owners = set()
    for port in ports:
        try:
            result = subprocess.run(
                ["lsof", "-t", "--", port],
                text=True,
                capture_output=True,
                timeout=2.0,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        for raw_pid in result.stdout.splitlines():
            pid = raw_pid.strip()
            if not pid.isdigit():
                continue
            try:
                process = subprocess.run(
                    ["ps", "-p", pid, "-o", "comm="],
                    text=True,
                    capture_output=True,
                    timeout=2.0,
                    check=False,
                ).stdout.strip()
            except (OSError, subprocess.TimeoutExpired):
                continue
            for browser_name, markers in SUPPORTED_BROWSER_NAMES.items():
                if any(marker in process for marker in markers):
                    owners.add(browser_name)
    return sorted(owners)


def _flash6_tab_match_script():
    return """
        set tabUrl to URL of currentTab as text
        set tabTitle to title of currentTab as text
        set isFlash6Tab to false
        ignoring case
          if tabUrl contains "/FLASH6/flash6.html" then set isFlash6Tab to true
          if tabUrl starts with "file:" and tabUrl contains "flash6.html" then set isFlash6Tab to true
          if tabTitle is "FLASH6 - Intelligent platform" then set isFlash6Tab to true
        end ignoring
    """


def _request_browser_serial_release(browser_names, token):
    requested = 0
    token_js = json.dumps(str(token))
    javascript = (
        "(()=>{try{"
        "if(window.Flash6&&typeof window.Flash6.releaseSerialForUpload==='function'){"
        f"window.Flash6.releaseSerialForUpload({token_js});"
        "return 'FLASH6_RELEASE_REQUESTED';}"
        "}catch(_e){}return '';})()"
    )
    for browser_name in browser_names:
        script = f"""
tell application {_apple_script_string(browser_name)}
  set releaseCount to 0
  repeat with currentWindow in windows
    repeat with currentTab in tabs of currentWindow
      try
{_flash6_tab_match_script()}
        if isFlash6Tab then
          set releaseResult to execute currentTab javascript {_apple_script_string(javascript)}
          if releaseResult is "FLASH6_RELEASE_REQUESTED" then set releaseCount to releaseCount + 1
        end if
      end try
    end repeat
  end repeat
  return releaseCount as text
end tell
"""
        output = _run_osascript(script)
        try:
            requested += int(output or "0")
        except ValueError:
            pass
    return requested


def _list_flash6_browser_tabs(browser_name):
    script = f"""
tell application {_apple_script_string(browser_name)}
  set matchedTabs to {{}}
  repeat with currentWindow in windows
    repeat with currentTab in tabs of currentWindow
      try
{_flash6_tab_match_script()}
        if isFlash6Tab then
          set end of matchedTabs to ((id of currentWindow as text) & "|||" & (id of currentTab as text) & "|||" & tabUrl)
        end if
      end try
    end repeat
  end repeat
  set AppleScript's text item delimiters to linefeed
  return matchedTabs as text
end tell
"""
    output = _run_osascript(script)
    tabs = []
    for line in (output or "").splitlines():
        parts = line.split("|||", 2)
        if len(parts) != 3:
            continue
        window_id, tab_id, url = (part.strip() for part in parts)
        if window_id and tab_id and url:
            tabs.append(
                {
                    "browser": browser_name,
                    "window_id": window_id,
                    "tab_id": tab_id,
                    "url": url,
                }
            )
    return tabs


def _park_flash6_browser_tabs(browser_names, token):
    global _parked_browser_tabs
    parked = []
    marker_url = f"about:blank#flash6-platformio-upload-{token}"
    for browser_name in browser_names:
        for tab in _list_flash6_browser_tabs(browser_name):
            script = f"""
tell application {_apple_script_string(browser_name)}
  repeat with currentWindow in windows
    if (id of currentWindow as text) is {_apple_script_string(tab["window_id"])} then
      repeat with currentTab in tabs of currentWindow
        if (id of currentTab as text) is {_apple_script_string(tab["tab_id"])} then
          set URL of currentTab to {_apple_script_string(marker_url)}
          return "parked"
        end if
      end repeat
    end if
  end repeat
end tell
"""
            if _run_osascript(script) == "parked":
                parked.append(tab)
    _parked_browser_tabs = parked
    return len(parked)


def _restore_browser_tabs():
    global _parked_browser_tabs
    tabs = list(_parked_browser_tabs)
    _parked_browser_tabs = []
    for tab in tabs:
        script = f"""
tell application {_apple_script_string(tab["browser"])}
  repeat with currentWindow in windows
    if (id of currentWindow as text) is {_apple_script_string(tab["window_id"])} then
      repeat with currentTab in tabs of currentWindow
        if (id of currentTab as text) is {_apple_script_string(tab["tab_id"])} then
          if (URL of currentTab as text) starts with "about:blank#flash6-platformio-upload-" then
            set URL of currentTab to {_apple_script_string(tab["url"])}
          end if
          return
        end if
      end repeat
    end if
  end repeat
end tell
"""
        _run_osascript(script)
    if tabs:
        print(f"[FLASH6] restored {len(tabs)} dashboard tab(s) after upload.")


def _resume_browser_serial():
    javascript = (
        "(()=>{try{"
        "if(window.Flash6&&typeof window.Flash6.resumeSerialAfterUpload==='function'){"
        "window.Flash6.resumeSerialAfterUpload();"
        "return 'FLASH6_RESUME_REQUESTED';}"
        "}catch(_e){}return '';})()"
    )
    for browser_name in SUPPORTED_BROWSER_NAMES:
        script = f"""
tell application {_apple_script_string(browser_name)}
  if not running then return
  repeat with currentWindow in windows
    repeat with currentTab in tabs of currentWindow
      try
{_flash6_tab_match_script()}
        if isFlash6Tab then execute currentTab javascript {_apple_script_string(javascript)}
      end try
    end repeat
  end repeat
end tell
"""
        _run_osascript(script, timeout=2.0)


def release_flash6_before_upload(target, source, env):
    """SCons pre-upload callback; parameter names are part of its API."""
    global _handoff_original, _handoff_active

    _handoff_original = HANDOFF_PATH.read_bytes() if HANDOFF_PATH.exists() else None
    if _handoff_original:
        try:
            if json.loads(_handoff_original.decode("utf-8")).get("active"):
                _handoff_original = b'{"active":false}\n'
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            pass
    token = uuid.uuid4().hex
    _write_handoff(
        {
            "active": True,
            "token": token,
            "requested_at_ms": int(time.time() * 1000),
            "reason": "platformio_upload",
        }
    )
    _handoff_active = True
    print("[FLASH6] requesting Web Serial release before USB upload...")

    ports = _candidate_upload_ports(env)
    deadline = time.monotonic() + HANDOFF_TIMEOUT_SECONDS
    if not ports:
        # PlatformIO may resolve an automatic port only after pre-actions.
        # Leave enough time for the local dashboard to observe the request.
        time.sleep(1.0)
        print("[FLASH6] upload port not resolved yet; handoff signal sent.")
        return

    browser_names = _port_owner_browser_names(ports)
    if browser_names:
        requested = _request_browser_serial_release(browser_names, token)
        if requested:
            print(f"[FLASH6] requested serial release from {requested} dashboard tab(s).")

    while time.monotonic() < deadline:
        if all(_port_is_available(port) for port in ports):
            print(f"[FLASH6] serial port released: {ports[0]}")
            return
        if (
            browser_names
            and not _parked_browser_tabs
            and time.monotonic() >= (deadline - HANDOFF_TIMEOUT_SECONDS + HANDOFF_POLL_GRACE_SECONDS)
        ):
            parked = _park_flash6_browser_tabs(browser_names, token)
            if parked:
                print(
                    f"[FLASH6] temporarily parked {parked} dashboard tab(s) "
                    "to release Web Serial."
                )
        time.sleep(0.15)

    raise RuntimeError(
        "FLASH6 Web Serial connection did not release the upload port within "
        f"{HANDOFF_TIMEOUT_SECONDS:.0f}s. Close other serial monitors or grant "
        "the terminal permission to control the browser in macOS Settings > "
        "Privacy & Security > Automation."
    )


env.AddPreAction("upload", release_flash6_before_upload)
