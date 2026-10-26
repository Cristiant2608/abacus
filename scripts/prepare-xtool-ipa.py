#!/usr/bin/env python3
"""Stage an IPA for xtool without changing its compiled App Intents identity."""

import argparse
import importlib.util
import json
from pathlib import Path
import plistlib
import re
import zipfile


def prepare(source, destination):
    if Path(source).resolve() == Path(destination).resolve():
        raise ValueError("The staging IPA must differ from the original")
    spec = importlib.util.spec_from_file_location("verify_ios", Path(__file__).with_name("verify-ios-probe.py"))
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    with zipfile.ZipFile(source) as archive:
        app_infos = [n for n in archive.namelist() if n.startswith("Payload/")
                     and n.endswith(".app/Info.plist") and n.count("/") == 2]
        if len(app_infos) != 1:
            raise ValueError("Expected one application")
        app_path = app_infos[0].removesuffix("Info.plist")
        app = plistlib.loads(archive.read(app_infos[0]))
        app_id = app["CFBundleIdentifier"]
        prefix = re.match(r"^XTL-[A-Z0-9]+\.", app_id)
        if not prefix or app_id[prefix.end():].startswith("XTL-"):
            raise ValueError("Compile with the final identity, containing exactly one XTL prefix")
        prefix = prefix.group()
        widget_infos = [n for n in archive.namelist() if n.startswith(app_path + "PlugIns/")
                        and n.endswith(".appex/Info.plist")]
        if len(widget_infos) != 1:
            raise ValueError("Expected one widget")
        widget = plistlib.loads(archive.read(widget_infos[0]))
        widget_id = widget["CFBundleIdentifier"]
        if not widget_id.startswith(app_id + "."):
            raise ValueError("Widget identity must belong to the compiled app")
        schemes = [s for entry in app.get("CFBundleURLTypes", []) for s in entry.get("CFBundleURLSchemes", [])]
        if not schemes:
            raise ValueError("Missing capture URL scheme")
        verifier.verify(source, app_id=app_id, widget_id=widget_id, scheme=schemes[0])
        if app_path + "Metadata.appintents/root.ssu.yaml" not in archive.namelist():
            raise ValueError("Missing compiled App Shortcuts identity")
        replacements = {app_infos[0]: app, widget_infos[0]: widget}
        with zipfile.ZipFile(destination, "w") as staged:
            for entry in archive.infolist():
                data = archive.read(entry.filename)
                if entry.filename in replacements:
                    info = replacements[entry.filename].copy()
                    identifier = info["CFBundleIdentifier"]
                    if not identifier.startswith(prefix) or identifier[len(prefix):].startswith("XTL-"):
                        raise ValueError("Inconsistent signing identity")
                    info["CFBundleIdentifier"] = identifier[len(prefix):]
                    fmt = plistlib.FMT_BINARY if data.startswith(b"bplist") else plistlib.FMT_XML
                    data = plistlib.dumps(info, fmt=fmt)
                staged.writestr(entry, data)
    return {"app_id": app_id, "widget_id": widget_id, "build": app["CFBundleVersion"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("destination")
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.source, args.destination)))
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, plistlib.InvalidFileException) as error:
        parser.exit(1, f"Cannot prepare IPA: {error}\n")
