import React from 'react';
import {
  Alert, Linking, NativeModules, Platform, Pressable, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AScrollView, AText } from '../UI/ALibrary';
import { useThemeColors } from '../../lib/common';
import scriptableWidgetSource from '../../lib/scriptable-widget-source';
import translate from '../../i18n/locale';

export default function IntegrationsScreen() {
  const { colors } = useThemeColors();
  const card = {
    padding: 18, borderRadius: 18, backgroundColor: colors.tileBackgroundColor, marginBottom: 16,
  };
  const button = { minHeight: 48, justifyContent: 'center' as const, paddingVertical: 10 };
  const openReference = async () => {
    try { await Linking.openURL('https://github.com/dtrainych/firefly-ios-shortcuts'); } catch { Alert.alert(translate('api_error_connection')); }
  };
  return (
    <AScrollView style={{ padding: 16, paddingBottom: 70 }}>
      <View style={card}>
        <AText fontSize={21} bold>{translate('integrations_native')}</AText>
        <AText style={{ marginTop: 10 }}>{translate('integrations_native_help')}</AText>
      </View>
      <View style={card}>
        <AText fontSize={21} bold>{translate('integrations_shortcuts')}</AText>
        <AText style={{ marginTop: 10 }}>{translate('integrations_shortcuts_help')}</AText>
        {Platform.OS === 'ios' && (
          <Pressable
            accessibilityRole="button"
            style={button}
            onPress={async () => {
              try {
                if (!NativeModules.AbacusQuickAccess?.openShortcuts) throw new Error('unavailable');
                await NativeModules.AbacusQuickAccess.openShortcuts();
              } catch { Alert.alert(translate('integrations_shortcuts_error')); }
            }}
          >
            <AText underline>{translate('integrations_shortcuts')}</AText>
          </Pressable>
        )}
      </View>
      <View style={card}>
        <AText fontSize={21} bold>{translate('integrations_scriptable')}</AText>
        <AText style={{ marginTop: 10 }}>{translate('integrations_scriptable_help')}</AText>
        <Pressable
          accessibilityRole="button"
          style={button}
          onPress={async () => {
            await Clipboard.setStringAsync(scriptableWidgetSource);
            Alert.alert(translate('integrations_script_copied'));
          }}
        >
          <AText underline>{translate('integrations_copy_script')}</AText>
        </Pressable>
        <AText fontSize={13}>{translate('integrations_modes')}</AText>
      </View>
      <View style={card}>
        <AText fontSize={21} bold>{translate('integrations_importable')}</AText>
        <AText style={{ marginTop: 10 }}>{translate('integrations_importable_help')}</AText>
        <Pressable accessibilityRole="button" style={button} onPress={openReference}>
          <AText underline>{translate('integrations_open_reference')}</AText>
        </Pressable>
      </View>
    </AScrollView>
  );
}
