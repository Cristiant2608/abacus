import React from 'react';
import { ScreenType } from '../../types/screen';
import TransactionForm from '../Forms/TransactionForm';
import ErrorBoundary from '../UI/ErrorBoundary';
import ErrorWidget from '../UI/ErrorWidget';

export default function QuickExpenseScreen({ navigation, route }: ScreenType) {
  return (
    <ErrorBoundary>
      <TransactionForm key={route.key} navigation={navigation} splits={route.params?.payload?.splits || []} title="" quick />
      <ErrorWidget />
    </ErrorBoundary>
  );
}
