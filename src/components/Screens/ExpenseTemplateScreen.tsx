import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { useDispatch, useSelector } from 'react-redux';
import { RootDispatch, RootState } from '../../store';
import { ScreenType } from '../../types/screen';
import { initialSplit } from '../../models/transactions';
import { normalizeExpenseAmount } from '../../lib/quick-access';
import TransactionSplitForm from '../Forms/TransactionSplitForm';
import {
  AButton, AInput, ALabel, AText, AView,
} from '../UI/ALibrary';
import translate from '../../i18n/locale';

export default function ExpenseTemplateScreen({ navigation, route }: ScreenType) {
  const dispatch = useDispatch<RootDispatch>();
  const { templates, profileKey } = useSelector((state: RootState) => state.quickAccess);
  const template = templates.find((item) => item.id === route.params?.templateId && item.profileKey === profileKey);
  const [name, setName] = useState(template?.name || '');
  const [split, setSplit] = useState({ ...initialSplit(), ...template?.split, date: new Date() });
  const save = () => {
    if (!name.trim()) { Alert.alert(translate('quick_access_required_name')); return; }
    try {
      const amount = split.amount.trim() ? normalizeExpenseAmount(split.amount) : '';
      dispatch.quickAccess.saveTemplate({
        id: template?.id || Crypto.randomUUID(),
        name: name.trim(),
        profileKey,
        split: { ...split, amount },
      });
      navigation.goBack();
    } catch (error) { Alert.alert(translate((error as Error).message)); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <ALabel isRequired>{translate('quick_access_name')}</ALabel>
        <AInput value={name} onChangeText={setName} height={48} placeholder={translate('quick_access_name')} />
        <TransactionSplitForm index={0} total={1} isNew={false} handleDelete={() => {}} transaction={split} onChange={setSplit} templateMode />
        <AView style={{ marginTop: 20 }}>
          <AButton type="primary" style={{ height: 'auto', minHeight: 52, padding: 12 }} onPress={save}>
            <AText color="white" bold>{translate('quick_access_save')}</AText>
          </AButton>
        </AView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
