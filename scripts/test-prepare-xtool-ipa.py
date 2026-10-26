"""Regression tests for xtool's unconditional bundle ID prefix."""
import importlib.util
from pathlib import Path
import plistlib
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("prepare", Path(__file__).with_name("prepare-xtool-ipa.py"))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
PREFIX = "XTL-TEST123."
APP_ID = PREFIX + "com.example.abacus"


class SigningIdentityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source = Path(self.directory.name) / "original.ipa"
        self.staged = Path(self.directory.name) / "staged.ipa"
        self.create_ipa(APP_ID)

    def create_ipa(self, app_id, metadata_id=None):
        root = "Payload/Abacus.app/"
        app = {"CFBundleIdentifier": app_id, "CFBundleExecutable": "Abacus", "CFBundleVersion": "42",
               "CFBundleURLTypes": [{"CFBundleURLSchemes": ["abacus-personal"]}]}
        widget = {"CFBundleIdentifier": app_id + ".widget", "CFBundleExecutable": "Widget", "CFBundleVersion": "42",
                  "NSExtension": {"NSExtensionPointIdentifier": "com.apple.widgetkit-extension"}}
        with zipfile.ZipFile(self.source, "w") as archive:
            archive.writestr(root + "Info.plist", plistlib.dumps(app))
            archive.writestr(root + "Abacus", b"host-executable")
            archive.writestr(root + "PlugIns/Widget.appex/Info.plist", plistlib.dumps(widget, fmt=plistlib.FMT_BINARY))
            archive.writestr(root + "PlugIns/Widget.appex/Widget", b"widget-executable")
            archive.writestr(root + "Metadata.appintents/root.ssu.yaml", "bundleIdentifier: " + (metadata_id or app_id) + "\n")
            archive.writestr(root + "Metadata.appintents/extract.actionsdata", b'{"actions":{"Prepare":{}}}')

    def test_staging_preserves_metadata_and_restores_compiled_identity_after_signing(self):
        identity = prepare.prepare(self.source, self.staged)
        self.assertEqual(identity["app_id"], APP_ID)
        signed = Path(self.directory.name) / "signed.ipa"
        with zipfile.ZipFile(self.source) as original, zipfile.ZipFile(self.staged) as staged, zipfile.ZipFile(signed, "w") as output:
            changed = []
            for name in original.namelist():
                data = staged.read(name)
                if data != original.read(name):
                    changed.append(name)
                    info = plistlib.loads(data)
                    self.assertFalse(info["CFBundleIdentifier"].startswith("XTL-"))
                    # Model the actual xtool upsertApp behavior: always prefix.
                    info["CFBundleIdentifier"] = PREFIX + info["CFBundleIdentifier"]
                    self.assertEqual(info, plistlib.loads(original.read(name)))
                    data = plistlib.dumps(info)
                output.writestr(name, data)
            self.assertEqual(len(changed), 2)
        verifier_spec = importlib.util.spec_from_file_location("verify", Path(__file__).with_name("verify-ios-probe.py"))
        verifier = importlib.util.module_from_spec(verifier_spec)
        verifier_spec.loader.exec_module(verifier)
        verifier.verify(signed, APP_ID, APP_ID + ".widget", "abacus-personal")

    def test_rejects_duplicate_or_missing_prefix(self):
        for identifier in [PREFIX + APP_ID, "com.example.abacus"]:
            self.create_ipa(identifier)
            with self.assertRaises(ValueError):
                prepare.prepare(self.source, self.staged)

    def test_rejects_mismatched_compiled_metadata(self):
        self.create_ipa(APP_ID, "com.example.abacus")
        with self.assertRaises(ValueError):
            prepare.prepare(self.source, self.staged)

    def test_never_overwrites_original(self):
        with self.assertRaises(ValueError):
            prepare.prepare(self.source, self.source)


if __name__ == "__main__":
    unittest.main()
