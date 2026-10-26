const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PERSONAL = process.env.APP_VARIANT === 'personal';
// Compile with the final identifier so App Intents metadata agrees with iOS.
// The installer stages unprefixed Info.plist IDs: xtool adds its prefix even
// when the incoming ID already contains one. Never alter compiled metadata.
const PERSONAL_APP_IDENTIFIER = process.env.PERSONAL_APP_IDENTIFIER || 'XTL-8X6B8DVC3S.com.cristiant2608.abacus.personal';

export default {
  name: IS_PERSONAL ? 'AbacusPersonal' : IS_DEV ? 'Abacus.dev' : 'Abacus',
  description: 'Abacus: Firefly III mobile application.',
  slug: 'abacus',
  privacy: 'public',
  platforms: [
    'ios',
    'android',
  ],
  version: '0.25.0',
  orientation: 'portrait',
  updates: {
    enabled: !IS_PERSONAL,
    checkAutomatically: 'ON_ERROR_RECOVERY',
    ...(!IS_PERSONAL && { url: 'https://u.expo.dev/292ed6dc-804c-4444-95f5-fa5d76d9913b' }),
  },
  ios: {
    icon: './src/images/icon-abacus.png',
    splash: {
      image: './src/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
      dark: {
        backgroundColor: '#121215',
      },
    },
    supportsTablet: true,
    infoPlist: {
      ...(IS_PERSONAL && { CFBundleDisplayName: 'Abacus Personal' }),
      NSFaceIDUsageDescription: 'Abacus use Authentication with TouchId or FaceID',
      NSLocalNetworkUsageDescription: 'Abacus use Local Network to access Firefly III on your local network',
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
    config: {
      usesNonExemptEncryption: false,
    },
    bundleIdentifier: IS_PERSONAL ? PERSONAL_APP_IDENTIFIER : IS_DEV ? 'abacus.fireflyiii.ios.app.dev' : 'abacus.ios.app',
    buildNumber: IS_PERSONAL ? (process.env.PERSONAL_IOS_BUILD_NUMBER || '1') : '0.25.0',
  },
  android: {
    icon: './src/images/icon-abacus.png',
    adaptiveIcon: {
      foregroundImage: './src/images/icon-abacus-foreground.png',
      backgroundImage: './src/images/icon-abacus-background.png',
    },
    splash: {
      image: './src/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
      dark: {
        backgroundColor: '#121215',
      },
    },
    playStoreUrl: 'https://play.google.com/store/apps/details?id=abacus.fireflyiii.android.app',
    package: IS_DEV ? 'abacus.fireflyiii.android.app.dev' : 'abacus.fireflyiii.android.app',
    versionCode: 41,
  },
  scheme: IS_PERSONAL ? 'abacus-personal' : 'abacusfiiiapp',
  githubUrl: 'https://github.com/victorbalssa/abacus',
  runtimeVersion: {
    policy: 'sdkVersion',
  },
  extra: {
    ...(!IS_PERSONAL && {
      eas: {
        projectId: '292ed6dc-804c-4444-95f5-fa5d76d9913b',
      },
    }),
  },
  plugins: [
    'expo-asset',
    'expo-secure-store',
    'expo-localization',
    './plugins/withAndroidManifest',
    './plugins/withQuickAccess',
    [
      'expo-font',
      {
        fonts: [
          './src/fonts/Montserrat-Bold.ttf',
          './src/fonts/Montserrat-Regular.ttf',
          './src/fonts/Montserrat-Light.ttf',
        ],
      },
    ],
    [
      'expo-quick-actions',
      {
        androidIcons: {
          shortcut_add: {
            foregroundImage: './src/images/icon-adaptive-add.png',
            backgroundColor: '#FF5533',
          },
        },
      },
    ],
  ],
  userInterfaceStyle: 'automatic',
};
