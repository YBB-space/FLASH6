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
import time
import uuid
from pathlib import Path


PROJECT_DIR = Path(env.subst("$PROJECT_DIR"))
HANDOFF_PATH = PROJECT_DIR / "FLASH6" / "platformio-upload-handoff.json"
HANDOFF_TIMEOUT_SECONDS = 8.0
_handoff_original = None
_handoff_active = False


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

    while time.monotonic() < deadline:
        if all(_port_is_available(port) for port in ports):
            print(f"[FLASH6] serial port released: {ports[0]}")
            return
        time.sleep(0.15)

    raise RuntimeError(
        "FLASH6 Web Serial connection did not release the upload port within "
        f"{HANDOFF_TIMEOUT_SECONDS:.0f}s. Keep the local FLASH6 page open or "
        "disconnect its USB connection manually."
    )


env.AddPreAction("upload", release_flash6_before_upload)
