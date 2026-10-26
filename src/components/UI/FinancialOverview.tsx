import React from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, View,
} from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AScrollView, AText } from './ALibrary';
import { useThemeColors } from '../../lib/common';
import useFinancialOverview from '../../lib/use-financial-overview';
import { formatExactMoney } from '../../lib/finance-summary';
import translate from '../../i18n/locale';
import { initialSplit } from '../../models/transactions';

export default function FinancialOverview() {
  const { colors } = useThemeColors();
  const {
    data, loading, error, refresh,
  } = useFinancialOverview();
  const hidden = useSelector((state: RootState) => state.configuration.hideBalance);
  const navigation = useNavigation();
  const amount = (code: string, value: string) => (hidden ? '••••' : formatExactMoney(code, value));
  const open = (name: string, params = {}) => navigation.dispatch(CommonActions.navigate({ name, params }));
  const card = {
    padding: 16, marginBottom: 12, borderRadius: 18, backgroundColor: colors.tileBackgroundColor, borderWidth: 1, borderColor: colors.listBorderColor,
  };
  return (
    <AScrollView
      style={{ padding: 16, paddingBottom: 150 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh()} />}
    >
      <AText fontSize={25} bold style={{ marginBottom: 12 }}>{translate('overview_title')}</AText>
      <View style={{
        flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
      }}
      >
        {['withdrawal', 'deposit', 'transfer'].map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            onPress={() => open('QuickExpenseScreen', { payload: { splits: [{ ...initialSplit(), type: kind }] } })}
            style={{
              padding: 12, minHeight: 48, borderRadius: 14, backgroundColor: colors.brandNeutralLight,
            }}
          >
            <AText bold>{translate(`transaction_form_type_${kind}`)}</AText>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => open('QuickAccessScreen')} style={{ padding: 12, minHeight: 48 }}>
          <AText underline>{translate('quick_access_templates')}</AText>
        </Pressable>
      </View>
      {loading && !data && <ActivityIndicator color={colors.text} />}
      {!!error && (
        <View style={card} accessibilityLiveRegion="polite">
          <AText>{translate(error)}</AText>
          {data && <AText>{translate('overview_cached')}</AText>}
          <Pressable accessibilityRole="button" onPress={() => refresh()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <AText underline>{translate('overview_retry')}</AText>
          </Pressable>
        </View>
      )}
      {data?.currencies.map((currency) => (
        <View key={currency.currency} style={card}>
          <AText fontSize={18} bold>{currency.currency}</AText>
          {(['income', 'spent', 'balance'] as const).map((field) => (
            <View
              key={field}
              style={{
                flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', paddingVertical: 8,
              }}
            >
              <AText>{translate(`overview_${field}`)}</AText>
              <AText bold color={field === 'income' ? colors.brandSuccess : field === 'spent' ? colors.brandDanger : colors.text}>{amount(currency.currency, currency[field])}</AText>
            </View>
          ))}
          <AText fontSize={13}>{`${translate('no_category')}: ${amount(currency.currency, currency.uncategorized)}`}</AText>
        </View>
      ))}
      {data && (
        <View style={card}>
          <AText fontSize={18} bold>{translate('overview_uncategorized', { count: data.uncategorizedCount })}</AText>
          <AText fontSize={13}>{translate('overview_uncategorized_help')}</AText>
        </View>
      )}
      <AText fontSize={20} bold style={{ marginVertical: 12 }}>{translate('overview_recent')}</AText>
      {data?.recent.map((group) => (
        <Pressable key={group.id} accessibilityRole="button" style={card} onPress={() => navigation.dispatch(CommonActions.navigate(translate('navigation_transactions_tab'), { screen: 'TransactionDetailScreen', params: { id: group.id } }))}>
          {group.attributes.transactions.map((split) => (
            <View key={split.transaction_journal_id || [group.id, split.description, split.amount, split.date].join(':')} style={{ paddingVertical: 4 }}>
              <AText bold>{split.description}</AText>
              <AText>{amount(split.currency_code || split.currencyCode, split.amount)}</AText>
              <AText fontSize={12}>{split.date?.slice(0, 10)}</AText>
            </View>
          ))}
        </Pressable>
      ))}
      {data && data.recent.length === 0 && <AText>{translate('overview_empty')}</AText>}
      {data && <AText fontSize={12}>{`${translate('overview_updated')}: ${new Date(data.updatedAt).toLocaleString()}`}</AText>}
    </AScrollView>
  );
}
