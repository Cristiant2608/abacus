#!/usr/bin/env python3
"""Check the unsigned probe artifact before attempting local signing."""

import json
import argparse
import plistlib
import sys
import zipfile
from pathlib import PurePosixPath


def verify(path, app_id="com.cristiant2608.abacus.probe", widget_id="com.cristiant2608.abacus.probe.widget", scheme="abacus-personal-probe"):
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        apps = [name for name in names if name.startswith("Payload/")
                and name.endswith(".app/Info.plist") and len(PurePosixPath(name).parts) == 3]
        if len(apps) != 1:
            raise ValueError("Expected exactly one application in Payload")
        app_path = apps[0].removesuffix("Info.plist")
        app = plistlib.loads(archive.read(apps[0]))
        if app["CFBundleIdentifier"] != app_id:
            raise ValueError("Unexpected app identity")
        schemes = [scheme for entry in app.get("CFBundleURLTypes", [])
                   for scheme in entry.get("CFBundleURLSchemes", [])]
        if scheme not in schemes:
            raise ValueError("Widget URL scheme is missing")
        if app_path + app["CFBundleExecutable"] not in names:
            raise ValueError("App executable is missing")
        widgets = [name for name in names if name.startswith(app_path + "PlugIns/")
                   and name.endswith(".appex/Info.plist")]
        if len(widgets) != 1:
            raise ValueError("Expected one embedded widget extension")
        widget = plistlib.loads(archive.read(widgets[0]))
        if widget["CFBundleIdentifier"] != widget_id:
            raise ValueError("Unexpected widget identity")
        if widget.get("NSExtension", {}).get("NSExtensionPointIdentifier") != "com.apple.widgetkit-extension":
            raise ValueError("WidgetKit extension declaration is missing")
        if widget["CFBundleVersion"] != app["CFBundleVersion"]:
            raise ValueError("App and widget build versions differ")
        if widgets[0].removesuffix("Info.plist") + widget["CFBundleExecutable"] not in names:
            raise ValueError("Widget executable is missing")
        metadata = [name for name in names if name.startswith(app_path + "Metadata.appintents/")]
        if not metadata:
            raise ValueError("App Intents metadata is missing")
        return {"app": app["CFBundleIdentifier"], "widget": widget["CFBundleIdentifier"],
                "schemes": schemes, "app_intents_metadata": metadata}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ipa")
    parser.add_argument("--app-id", default="com.cristiant2608.abacus.probe")
    parser.add_argument("--widget-id", default="com.cristiant2608.abacus.probe.widget")
    parser.add_argument("--scheme", default="abacus-personal-probe")
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.ipa, args.app_id, args.widget_id, args.scheme), indent=2))
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, plistlib.InvalidFileException) as error:
        sys.exit(f"Invalid probe: {error}")
