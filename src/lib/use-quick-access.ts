import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Alert, AppState, NativeEventEmitter, NativeModules, Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as QuickActions from 'expo-quick-actions';
import * as Crypto from 'expo-crypto';
import { CommonActions, NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import translate from '../i18n/locale';
import {
  canPresentQuickAccess, prepareExpense, QuickAccessQueue, quickAccessURL,
} from './quick-access';

export const quickAccessScheme = () => Linking.resolveScheme({ isSilent: true }) || 'abacusfiiiapp';

export default function useQuickAccess(navigation: NavigationContainerRefWithCurrent<ReactNavigation.RootParamList>) {
  const queue = useRef(new QuickAccessQueue());
  const [revision, setRevision] = useState(0);
  const templates = useSelector((state: RootState) => state.quickAccess.templates);
  const profileKey = useSelector((state: RootState) => state.quickAccess.profileKey);
  const notifyNavigation = useCallback(() => setRevision((value) => value + 1), []);

  const receiveURL = useCallback((url: string) => {
    try {
      if (queue.current.enqueue(url, quickAccessScheme())) notifyNavigation();
    } catch (error) {
      Alert.alert(translate('quick_access_title'), translate((error as Error).message));
    }
  }, [notifyNavigation]);

  useEffect(() => {
    let active = true;
    let draining = false;
    let drainAgain = false;
    const nativeModule = NativeModules.AbacusQuickAccess;
    const drainInbox = async () => {
      if (!nativeModule?.consumeRequests) return;
      if (draining) { drainAgain = true; return; }
      draining = true;
      try {
        do {
          drainAgain = false;
          // Consume atomically; overlapping native requests must drain in order.
          // eslint-disable-next-line no-await-in-loop
          const urls = await nativeModule.consumeRequests();
          if (active && Array.isArray(urls)) urls.forEach((url) => { if (typeof url === 'string') receiveURL(url); });
        } while (active && drainAgain);
      } catch {
        // A later foreground event can retry a native bridge that is starting.
      } finally { draining = false; }
    };
    const nativeSubscription = nativeModule ? new NativeEventEmitter(nativeModule).addListener('AbacusQuickAccessRequest', drainInbox) : null;
    const foregroundSubscription = AppState.addEventListener('change', (state) => { if (state === 'active') drainInbox(); });
    drainInbox();
    Linking.getInitialURL().then((url) => { if (active && url) receiveURL(url); }).catch(() => {});
    const linkSubscription = Linking.addEventListener('url', ({ url }) => receiveURL(url));
    const receiveAction = (action: QuickActions.Action) => {
      const href = action.params?.href;
      if (!['TransactionCreateScreen', 'QuickExpenseScreen', 'QuickAccessScreen'].includes(String(href))) return;
      receiveURL(quickAccessURL(quickAccessScheme(), {
        action: href === 'QuickAccessScreen' ? 'templates' : 'expense',
        templateId: typeof action.params?.templateId === 'string' ? action.params.templateId : undefined,
        requestId: Crypto.randomUUID(),
      }));
    };
    if (QuickActions.initial) receiveAction(QuickActions.initial);
    const actionSubscription = QuickActions.addListener(receiveAction);
    return () => {
      active = false;
      nativeSubscription?.remove();
      foregroundSubscription.remove();
      linkSubscription.remove();
      actionSubscription.remove();
    };
  }, [receiveURL]);

  const root = navigation.isReady() ? navigation.getRootState() : null;
  const loggedIn = root?.routes[0]?.name === 'dashboard';

  useEffect(() => {
    const current = loggedIn ? templates.filter((item) => item.profileKey === profileKey) : [];
    // The native catalogue contains names and IDs only; no credentials or amounts.
    // Keep the last authenticated catalogue during a cold start so App Intents
    // can resolve an already selected entity before JS finishes logging in.
    if (loggedIn) NativeModules.AbacusQuickAccess?.setTemplates(JSON.stringify(current.map(({ id, name }) => ({ id, name }))));
    QuickActions.setItems([
      {
        id: 'new-expense',
        title: translate('quick_access_new'),
        icon: Platform.OS === 'ios' ? 'symbol:plus.circle' : 'shortcut_add',
        params: { href: 'QuickExpenseScreen' },
      },
      {
        id: 'expense-templates',
        title: translate('quick_access_title'),
        icon: Platform.OS === 'ios' ? 'symbol:square.grid.2x2' : 'shortcut_add',
        params: { href: 'QuickAccessScreen' },
      },
      ...current.slice(0, 2).map((item) => ({
        id: item.id,
        title: item.name,
        icon: Platform.OS === 'ios' ? 'symbol:bolt.fill' : 'shortcut_add',
        params: { href: 'QuickExpenseScreen', templateId: item.id },
      })),
    ]).catch(() => {});
  }, [templates, profileKey, loggedIn]);

  useEffect(() => {
    // Wait for login/biometrics and never replace an open transaction or modal.
    if (!navigation.isReady() || !profileKey || !loggedIn || !canPresentQuickAccess(root.routes)) return;
    const request = queue.current.shift();
    if (!request) return;
    try {
      navigation.dispatch(CommonActions.navigate({
        name: request.action === 'templates' ? 'QuickAccessScreen' : 'QuickExpenseScreen',
        params: request.action === 'expense' ? {
          payload: { splits: [prepareExpense(request, templates, profileKey)] },
        } : undefined,
      }));
    } catch (error) {
      Alert.alert(translate('quick_access_title'), translate((error as Error).message));
      notifyNavigation();
    }
  }, [revision, loggedIn, profileKey, templates, navigation, notifyNavigation]);

  return { onReady: notifyNavigation, onStateChange: notifyNavigation };
}
