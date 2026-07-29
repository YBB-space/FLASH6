"""Export the latest successful build as the firmware bundled with FLASH6."""

Import("env")

import hashlib
import json
import re
import shutil
from pathlib import Path


PROJECT_DIR = Path(env.subst("$PROJECT_DIR"))
STATE_HEADER = PROJECT_DIR / "src" / "firmware" / "state.h"
BUNDLE_DIR = PROJECT_DIR / "FLASH6" / "firmware"
BUNDLE_BIN = BUNDLE_DIR / "firmware.bin"
BUNDLE_MANIFEST = BUNDLE_DIR / "manifest.json"


def _read_constant(source, name, fallback):
    match = re.search(
        rf'constexpr\s+char\s+{re.escape(name)}\[\]\s*=\s*"([^"]+)"',
        source,
    )
    return match.group(1) if match else fallback


def _replace_if_changed(source, destination):
    if destination.exists():
        source_hash = hashlib.sha256(source.read_bytes()).digest()
        destination_hash = hashlib.sha256(destination.read_bytes()).digest()
        if source_hash == destination_hash:
            return False
    shutil.copyfile(source, destination)
    return True


def export_firmware_bundle(source, target, env):
    built_bin = Path(str(target[0]))
    if not built_bin.exists():
        print(f"[FLASH6] bundled firmware skipped: {built_bin} not found")
        return

    BUNDLE_DIR.mkdir(parents=True, exist_ok=True)
    changed = _replace_if_changed(built_bin, BUNDLE_BIN)

    image = BUNDLE_BIN.read_bytes()
    state_source = STATE_HEADER.read_text(encoding="utf-8")
    manifest = {
        "file": "firmware.bin",
        "product": "FLASH6",
        "target": "ESP32-S3",
        "version": _read_constant(
            state_source, "kFirmwareVersion", "unknown"
        ),
        "build": _read_constant(
            state_source, "kFirmwareBuildId", "unknown"
        ),
        "protocol": _read_constant(
            state_source, "kFirmwareProtocol", "unknown"
        ),
        "size": len(image),
        "sha256": hashlib.sha256(image).hexdigest(),
    }
    manifest_text = json.dumps(
        manifest,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ) + "\n"
    previous_manifest = (
        BUNDLE_MANIFEST.read_text(encoding="utf-8")
        if BUNDLE_MANIFEST.exists()
        else ""
    )
    if previous_manifest != manifest_text:
        BUNDLE_MANIFEST.write_text(manifest_text, encoding="utf-8")
        changed = True

    state = "updated" if changed else "current"
    print(
        f"[FLASH6] bundled firmware {state}: "
        f"{BUNDLE_BIN.relative_to(PROJECT_DIR)} "
        f"({len(image)} bytes, sha256={manifest['sha256'][:12]}...)"
    )


env.AddPostAction("$BUILD_DIR/${PROGNAME}.bin", export_firmware_bundle)
