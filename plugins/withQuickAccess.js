const fs = require('fs');
const path = require('path');
const { withAppDelegate, withXcodeProject } = require('expo/config-plugins');
const plist = require('@expo/plist').default;

const TARGET_NAME = 'AbacusQuickAccessWidget';
const SOURCE_DIR = 'AbacusQuickAccess';

module.exports = function withQuickAccess(config) {
  const configured = withAppDelegate(config, (mod) => {
    const registration = 'AbacusQuickAccess.registerShortcuts()';
    if (!mod.modResults.contents.includes(registration)) {
      const anchor = 'let delegate = ReactNativeDelegate()';
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Cannot register App Shortcuts: unexpected AppDelegate template');
      // eslint-disable-next-line no-param-reassign
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `${registration}\n    ${anchor}`);
    }
    return mod;
  });
  return withXcodeProject(configured, (mod) => {
    const project = mod.modResults;
    const directory = path.join(mod.modRequest.platformProjectRoot, SOURCE_DIR);
    fs.mkdirSync(directory, { recursive: true });
    ['AbacusQuickAccess.swift', 'AbacusQuickAccessBridge.m', 'ExpenseWidget.swift'].forEach((name) => {
      const source = fs.readFileSync(path.join(__dirname, '../native/quick-access', name), 'utf8');
      fs.writeFileSync(path.join(directory, name), source.replaceAll('__ABACUS_SCHEME__', config.scheme));
    });
    const { version } = config;
    const { buildNumber } = config.ios;
    const bundleIdentifier = `${config.ios.bundleIdentifier}.quickaccess`;
    fs.writeFileSync(path.join(directory, 'Widget-Info.plist'), plist.build({
      CFBundleDisplayName: 'Abacus Quick Access',
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
      CFBundleExecutable: '$(EXECUTABLE_NAME)',
      CFBundleName: '$(PRODUCT_NAME)',
      CFBundlePackageType: 'XPC!',
      CFBundleShortVersionString: version,
      CFBundleVersion: buildNumber,
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
    }));

    const host = project.getFirstTarget().uuid;
    const { mainGroup } = project.getFirstProject().firstProject;
    ['AbacusQuickAccess.swift', 'AbacusQuickAccessBridge.m'].forEach((name) => {
      const file = `${SOURCE_DIR}/${name}`;
      if (!project.hasFile(file)) project.addSourceFile(file, { target: host }, mainGroup);
    });

    // Expo regenerates the project on clean prebuild; repeated prebuild must
    // update the files/settings without inserting another native target.
    let widget = Object.values(project.pbxNativeTargetSection()).find((target) => typeof target === 'object' && target.name?.replace(/^"|"$/g, '') === TARGET_NAME);
    if (!widget) {
      const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, bundleIdentifier);
      project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      project.addSourceFile(`${SOURCE_DIR}/ExpenseWidget.swift`, { target: target.uuid }, mainGroup);
      widget = target.pbxNativeTarget;
    }
    const configurations = project.pbxXCConfigurationList()[widget.buildConfigurationList].buildConfigurations;
    configurations.forEach(({ value }) => {
      const settings = project.pbxXCBuildConfigurationSection()[value].buildSettings;
      Object.assign(settings, {
        PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
        INFOPLIST_FILE: `"${SOURCE_DIR}/Widget-Info.plist"`,
        SWIFT_VERSION: '5.0',
        IPHONEOS_DEPLOYMENT_TARGET: '17.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        SDKROOT: 'iphoneos',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        SKIP_INSTALL: 'YES',
        CURRENT_PROJECT_VERSION: `"${buildNumber}"`,
        MARKETING_VERSION: `"${version}"`,
        GENERATE_INFOPLIST_FILE: 'NO',
        SWIFT_EMIT_LOC_STRINGS: 'YES',
      });
    });
    return mod;
  });
};
