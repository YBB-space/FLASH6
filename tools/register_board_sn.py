"""Register the persistent FLASH6 board S/N after each successful upload.

The registry is intentionally a normal XLSX file in the project root.  It is
rewritten atomically from its own worksheet data, and an existing S/N is never
added twice.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import time
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

try:
    Import("env")  # type: ignore[name-defined]  # PlatformIO/SCons injection
except (NameError, ImportError):
    env = None


REGISTRY_NAME = "BOARD_SERIAL_REGISTRY.xlsx"
SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
HEADERS = (
    "UPLOAD ORDER",
    "BOARD S/N",
    "FIRMWARE",
    "BUILD ID",
    "PROTOCOL",
    "UPLOADED AT (KST)",
    "UPLOAD PORT",
)
SERIAL_PATTERN = re.compile(
    r"\bF6-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}\b",
    re.IGNORECASE,
)


def _xml_escape(value: object) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _cell(ref: str, value: object, style: int = 0, numeric: bool = False) -> str:
    if numeric:
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    return (
        f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>'
        f"{_xml_escape(value)}</t></is></c>"
    )


def _worksheet_xml(rows: list[list[str]]) -> str:
    data_rows = [
        '<row r="1" ht="30" customHeight="1">'
        + _cell("A1", "FLASH6 BOARD SERIAL REGISTRY", 1)
        + "</row>",
        '<row r="2" ht="22" customHeight="1">'
        + _cell("A2", "펌웨어 업로드 순서 · 동일 S/N 자동 제외", 2)
        + "</row>",
        '<row r="3" ht="25" customHeight="1">'
        + "".join(
            _cell(f"{chr(65 + index)}3", header, 3)
            for index, header in enumerate(HEADERS)
        )
        + "</row>",
    ]
    for row_index, row in enumerate(rows, start=4):
        cells = []
        for column_index, value in enumerate(row):
            ref = f"{chr(65 + column_index)}{row_index}"
            cells.append(
                _cell(ref, value, 5 if row_index % 2 == 0 else 4, column_index == 0)
            )
        data_rows.append(
            f'<row r="{row_index}" ht="22" customHeight="1">'
            + "".join(cells)
            + "</row>"
        )
    last_row = max(3, len(rows) + 3)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="{SHEET_NS}" xmlns:r="{REL_NS}">
  <sheetViews><sheetView workbookViewId="0">
    <pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>
    <selection pane="bottomLeft" activeCell="A4" sqref="A4"/>
  </sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="27" customWidth="1"/>
    <col min="3" max="3" width="16" customWidth="1"/>
    <col min="4" max="4" width="14" customWidth="1"/>
    <col min="5" max="5" width="25" customWidth="1"/>
    <col min="6" max="6" width="25" customWidth="1"/>
    <col min="7" max="7" width="24" customWidth="1"/>
  </cols>
  <sheetData>{''.join(data_rows)}</sheetData>
  <autoFilter ref="A3:G{last_row}"/>
  <mergeCells count="2"><mergeCell ref="A1:G1"/><mergeCell ref="A2:G2"/></mergeCells>
  <pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>"""


def _styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Aptos"/></font>
    <font><b/><sz val="17"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font>
    <font><sz val="10"/><color rgb="FF94A3B8"/><name val="Aptos"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0B1220"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFD7DEE8"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""


def write_registry(path: Path, rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".xlsx.tmp")
    parts = {
        "[Content_Types].xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>""",
        "_rels/.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>""",
        "docProps/core.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>FLASH6 Board Serial Registry</dc:title><dc:creator>ALTIS FLASH6</dc:creator>
</cp:coreProperties>""",
        "docProps/app.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>FLASH6</Application></Properties>""",
        "xl/workbook.xml": f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="{SHEET_NS}" xmlns:r="{REL_NS}">
  <sheets><sheet name="BOARD S-N" sheetId="1" r:id="rId1"/></sheets>
</workbook>""",
        "xl/_rels/workbook.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>""",
        "xl/styles.xml": _styles_xml(),
        "xl/worksheets/sheet1.xml": _worksheet_xml(rows),
    }
    with zipfile.ZipFile(temp_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, value in parts.items():
            archive.writestr(name, value.encode("utf-8"))
    temp_path.replace(path)


def read_registry(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    with zipfile.ZipFile(path, "r") as archive:
        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    rows: list[list[str]] = []
    ns = {"s": SHEET_NS}
    for row in root.findall(".//s:sheetData/s:row", ns):
        if int(row.attrib.get("r", "0")) < 4:
            continue
        values: list[str] = []
        for cell in row.findall("s:c", ns):
            inline = cell.find("s:is/s:t", ns)
            raw = cell.find("s:v", ns)
            values.append(
                inline.text if inline is not None and inline.text is not None
                else (raw.text if raw is not None and raw.text is not None else "")
            )
        if len(values) >= 2 and values[1]:
            rows.append((values + [""] * len(HEADERS))[: len(HEADERS)])
    return rows


def firmware_metadata(project_dir: Path) -> tuple[str, str, str]:
    state_path = project_dir / "src" / "firmware" / "state.h"
    text = state_path.read_text(encoding="utf-8")

    def value(name: str) -> str:
        match = re.search(
            rf'constexpr\s+char\s+{re.escape(name)}\[\]\s*=\s*"([^"]+)"',
            text,
        )
        return match.group(1) if match else "--"

    return (
        value("kFirmwareVersion"),
        value("kFirmwareBuildId"),
        value("kFirmwareProtocol"),
    )


def append_serial(
    project_dir: Path,
    serial_number: str,
    port: str,
    uploaded_at: str | None = None,
) -> bool:
    serial_number = serial_number.upper()
    if not SERIAL_PATTERN.fullmatch(serial_number):
        raise ValueError(f"invalid FLASH6 S/N: {serial_number}")
    path = project_dir / REGISTRY_NAME
    rows = read_registry(path)
    if any(row[1].upper() == serial_number for row in rows):
        print(f"[S/N] already registered, skipped: {serial_number}")
        return False
    firmware, build_id, protocol = firmware_metadata(project_dir)
    order = max((int(row[0]) for row in rows if row[0].isdigit()), default=0) + 1
    timestamp = uploaded_at or dt.datetime.now().astimezone().isoformat(timespec="seconds")
    rows.append(
        [
            str(order),
            serial_number,
            firmware,
            build_id,
            protocol,
            timestamp,
            port or "--",
        ]
    )
    write_registry(path, rows)
    print(f"[S/N] registered #{order}: {serial_number} -> {path.name}")
    return True


def candidate_ports(preferred: str) -> list[str]:
    ports: list[str] = []
    if preferred and "$" not in preferred:
        ports.append(preferred)
    try:
        from serial.tools import list_ports

        for info in list_ports.comports():
            if info.device not in ports:
                ports.append(info.device)
    except Exception:
        pass
    return ports


def query_board_identity(preferred_port: str, timeout_s: float = 12.0) -> tuple[str, str]:
    import serial

    deadline = time.monotonic() + timeout_s
    last_error = "no serial port"
    while time.monotonic() < deadline:
        for port in candidate_ports(preferred_port):
            try:
                with serial.Serial(
                    port,
                    921600,
                    timeout=0.15,
                    write_timeout=0.5,
                ) as stream:
                    stream.dtr = False
                    stream.rts = False
                    time.sleep(0.25)
                    stream.reset_input_buffer()
                    for _ in range(5):
                        stream.write(b"/identity\n")
                        stream.flush()
                        until = time.monotonic() + 0.7
                        while time.monotonic() < until:
                            line = stream.readline().decode("utf-8", "replace")
                            match = SERIAL_PATTERN.search(line)
                            if match:
                                return match.group(0).upper(), port
            except Exception as exc:
                last_error = f"{port}: {exc}"
        time.sleep(0.35)
    raise RuntimeError(last_error)


def register_after_upload(target, source, env) -> None:
    """SCons post-upload callback.

    SCons invokes Python actions with the keyword arguments ``target``,
    ``source`` and ``env``.  Keep these exact parameter names so a successful
    firmware upload is not reported as failed while running the registry hook.
    """
    project_dir = Path(env.subst("$PROJECT_DIR"))
    registry = project_dir / REGISTRY_NAME
    if not registry.exists():
        write_registry(registry, [])
    preferred_port = env.subst("$UPLOAD_PORT")
    try:
        serial_number, actual_port = query_board_identity(preferred_port)
        append_serial(project_dir, serial_number, actual_port)
    except Exception as exc:
        print(f"[S/N] registry warning: could not read board identity ({exc})")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--init", action="store_true")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="remove every registered board and restart upload ordering at 1",
    )
    parser.add_argument("--register-sn")
    parser.add_argument("--port", default="manual")
    parser.add_argument("--project-dir", default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args()
    project_dir = Path(args.project_dir).resolve()
    registry = project_dir / REGISTRY_NAME
    if args.reset:
        write_registry(registry, [])
        print(f"[S/N] registry cleared: {registry}")
    elif args.init or not registry.exists():
        write_registry(registry, read_registry(registry) if registry.exists() else [])
        print(registry)
    if args.register_sn:
        append_serial(project_dir, args.register_sn, args.port)
    return 0


if env is not None:
    env.AddPostAction("upload", register_after_upload)

if __name__ == "__main__":
    raise SystemExit(main())
