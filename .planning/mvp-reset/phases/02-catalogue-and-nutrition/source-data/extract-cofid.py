"""Reproduce the narrow official CoFID extraction using Python stdlib only."""
from pathlib import Path
import hashlib
import json
import math
import urllib.request
import zipfile
import tempfile
import xml.etree.ElementTree as ET

URL = "https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx"
ROOT = Path(__file__).resolve().parent
WORKBOOK = Path(tempfile.gettempdir()) / "Ovona-CoFID2021.official.xlsx"
previous_download = ROOT / "CoFID2021.official.xlsx"
if previous_download.exists() and not WORKBOOK.exists():
    previous_download.replace(WORKBOOK)
if not WORKBOOK.exists():
    with urllib.request.urlopen(URL, timeout=60) as response:
        WORKBOOK.write_bytes(response.read())
digest = hashlib.sha256(WORKBOOK.read_bytes()).hexdigest()
assert digest == "436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d", "Official workbook bytes changed; recheck dataset before replacing pinned evidence"
ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
selected_codes = {
    "11-788": "as_sold",
    "18-290": "raw",
    "13-521": "raw",
    "13-572": "raw",
    "11-868": "raw",
    "17-038": "as_sold",
    "13-670": "cooked_drained",
}
with zipfile.ZipFile(WORKBOOK) as z:
    shared = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = ["".join(t.text or "" for t in si.iter("{" + ns["s"] + "}t")) for si in shared]
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    # Resolve by sheet title + relationships rather than assuming a sheet number.
    relationship_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    relationships = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    targets = {r.attrib["Id"]: r.attrib["Target"] for r in relationships}
    sheet = next(s for s in workbook.find("s:sheets", ns) if s.attrib["name"] == "1.3 Proximates")
    target = targets[sheet.attrib["{" + relationship_ns + "}id"]]
    name = "xl/" + target.lstrip("/") if not target.startswith("/") else target.lstrip("/")
    for name in [name]:
        tree = ET.fromstring(z.read(name))
        rows = []
        for row in tree.findall("s:sheetData/s:row", ns):
            cells = {}
            for c in row.findall("s:c", ns):
                v = c.find("s:v", ns)
                value = v.text if v is not None else ""
                if c.attrib.get("t") == "s" and value:
                    value = strings[int(value)]
                elif c.attrib.get("t") == "inlineStr":
                    value = "".join(t.text or "" for t in c.iter("{" + ns["s"] + "}t"))
                cells[c.attrib["r"]] = value
            rows.append(cells)
        selected = []
        for row in rows:
            by_column = {"".join(filter(str.isalpha, cell)): value for cell, value in row.items()}
            code = by_column.get("A")
            if code not in selected_codes:
                continue
            raw = {field: by_column[column] for field, column in {"calories": "M", "protein": "J", "carbs": "L", "fat": "K"}.items()}
            parsed = {}
            for field, value in raw.items():
                if value == "Tr":
                    parsed[field] = {"kind": "trace", "value": None, "raw": value}
                elif value in ("", "N"):
                    parsed[field] = {"kind": "unknown", "value": None, "raw": value}
                else:
                    number = float(value)
                    assert math.isfinite(number) and number >= 0, "Invalid source nutrient number"
                    parsed[field] = {"kind": "numeric", "value": number, "raw": value}
            selected.append({"foodCode": code, "foodName": by_column["B"], "description": by_column.get("C", ""),
                             "mainDataReferences": by_column.get("F", ""), "footnote": by_column.get("G", ""),
                             "sourceState": selected_codes[code], "stateMappingStatus": "explicit proposal derived from exact source name; not recipe mapping approval",
                             "basis": {"amount": 100, "unit": "g", "scope": "food as described"},
                             "nutrients": parsed, "rawCells": {k: v for k, v in row.items() if "".join(filter(str.isalpha, k)) in ["A", "B", "C", "D", "E", "F", "G", "J", "K", "L", "M"]}})
        assert len(selected) == len(selected_codes), "Every selected code must exist exactly once"
        selected.sort(key=lambda r: r["foodCode"])
        result = {"dataset": "CoFID", "datasetVersion": "2021", "publisher": "Public Health England",
                  "publicationUrl": "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
                  "workbookUrl": URL, "workbookSha256": digest, "extractedAt": "2026-10-29", "sheet": "1.3 Proximates",
                  "columns": {"calories": {"column": "M", "header": "Energy (kcal) (kcal)", "unit": "kcal"},
                              "protein": {"column": "J", "header": "Protein (g)", "unit": "g"},
                              "carbs": {"column": "L", "header": "Carbohydrate (g)", "unit": "g"},
                              "fat": {"column": "K", "header": "Fat (g)", "unit": "g"}},
                  "parsingPolicy": {"numeric": "preserve literal source text and parse finite numeric value", "trace": "retain qualifier; no numeric value supplied", "missingOrN": "unknown, never zero"},
                  "attribution": "Contains public sector information licensed under the Open Government Licence v3.0. CoFID 2021, Public Health England.",
                  "reviewStatus": "source extraction only; no recipe mapping, rights/cook-through or allergy attestations", "foods": selected}
        output = ROOT / "cofid2021-selected-foods.json"
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        # Remove only the erroneous exploratory full Factors export created by
        # the first local extraction iteration; it is not an input or user file.
        exploratory = ROOT / "cofid-proximates-raw.json"
        if exploratory.exists():
            exploratory.unlink()
        print(json.dumps({"sha256": digest, "foods": len(selected), "output": str(output),
                          "traceFields": [{"foodCode": r["foodCode"], "field": f} for r in selected for f, v in r["nutrients"].items() if v["kind"] == "trace"]}))
