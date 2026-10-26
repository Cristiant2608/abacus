import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootDispatch, RootState } from '../../store';
import { ScreenType } from '../../types/screen';
import {
  AButton, AScrollView, AText, AView,
} from '../UI/ALibrary';
import { useThemeColors } from '../../lib/common';
import { prepareExpense, quickAccessURL } from '../../lib/quick-access';
import { quickAccessScheme } from '../../lib/use-quick-access';
import translate from '../../i18n/locale';

export default function QuickAccessScreen({ navigation }: ScreenType) {
  const { colors } = useThemeColors();
  const dispatch = useDispatch<RootDispatch>();
  const { templates, profileKey } = useSelector((state: RootState) => state.quickAccess);
  const current = templates.filter((item) => item.profileKey === profileKey);
  const open = (name: string, params = {}) => navigation.dispatch(CommonActions.navigate({ name, params }));
  const buttonStyle = { minHeight: 44, padding: 10 };

  return (
    <AScrollView style={{ padding: 16, paddingBottom: 60 }}>
      <AText fontSize={28} bold style={{ marginBottom: 8 }}>{translate('quick_access_title')}</AText>
      <AText fontSize={14} style={{ marginBottom: 20 }}>{translate('quick_access_review')}</AText>
      <AButton
        type="primary"
        style={{ height: 'auto', minHeight: 64, padding: 16 }}
        onPress={() => open('QuickExpenseScreen', { payload: { splits: [prepareExpense({ action: 'expense' }, templates, profileKey)] } })}
      >
        <Ionicons name="add-circle" size={25} color="white" style={{ marginRight: 10 }} />
        <AText fontSize={18} color="white" bold>{translate('quick_access_new')}</AText>
      </AButton>
      <AText fontSize={20} bold style={{ marginVertical: 16 }}>{translate('quick_access_templates')}</AText>
      {current.length === 0 && <AText style={{ marginBottom: 16 }}>{translate('quick_access_empty')}</AText>}
      {current.map((template, index) => (
        <AView
          key={template.id}
          style={{
            backgroundColor: colors.tileBackgroundColor, borderRadius: 18, padding: 16, marginBottom: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${translate('quick_access_new')}: ${template.name}`}
            style={{ minHeight: 60, justifyContent: 'center' }}
            onPress={() => open('QuickExpenseScreen', { payload: { splits: [prepareExpense({ action: 'expense', templateId: template.id }, templates, profileKey)] } })}
          >
            <AText fontSize={19} bold>{template.name}</AText>
            <AText fontSize={14} style={{ marginTop: 5 }}>{translate(`transaction_form_type_${template.split.type}`)}</AText>
            <AText fontSize={14} style={{ marginTop: 5 }}>{template.split.amount ? `${template.split.amount} ${template.split.currencyCode}` : translate('quick_access_no_amount')}</AText>
            {!!template.split.sourceName && <AText fontSize={13}>{template.split.sourceName}</AText>}
          </Pressable>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            <Pressable accessibilityRole="button" style={buttonStyle} onPress={() => open('ExpenseTemplateScreen', { templateId: template.id })}>
              <AText underline>{translate('quick_access_edit')}</AText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={buttonStyle}
              onPress={async () => {
                await Clipboard.setStringAsync(quickAccessURL(quickAccessScheme(), { action: 'expense', templateId: template.id }));
                Alert.alert(translate('quick_access_copied'));
              }}
            >
              <AText underline>{translate('quick_access_copy')}</AText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('quick_access_up')}
              disabled={index === 0}
              style={{ ...buttonStyle, opacity: index === 0 ? 0.3 : 1 }}
              onPress={() => dispatch.quickAccess.moveTemplate({ id: template.id, direction: -1 })}
            >
              <Ionicons name="arrow-up" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('quick_access_down')}
              disabled={index === current.length - 1}
              style={{ ...buttonStyle, opacity: index === current.length - 1 ? 0.3 : 1 }}
              onPress={() => dispatch.quickAccess.moveTemplate({ id: template.id, direction: 1 })}
            >
              <Ionicons name="arrow-down" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={buttonStyle}
              onPress={() => Alert.alert(translate('quick_access_delete'), translate('quick_access_delete_message'), [
                { text: translate('cancel'), style: 'cancel' },
                { text: translate('quick_access_delete'), style: 'destructive', onPress: () => dispatch.quickAccess.deleteTemplate(template.id) },
              ])}
            >
              <AText color={colors.red}>{translate('quick_access_delete')}</AText>
            </Pressable>
          </View>
        </AView>
      ))}
      <AButton type="primary" style={{ height: 'auto', minHeight: 50, padding: 12 }} onPress={() => open('ExpenseTemplateScreen')}>
        <AText color="white" bold>{translate('quick_access_add')}</AText>
      </AButton>
      <AText fontSize={13} style={{ marginTop: 20 }}>{translate('quick_access_widget_help')}</AText>
    </AScrollView>
  );
}
