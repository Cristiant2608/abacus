import axios from 'axios';
import { refreshAsync } from 'expo-auth-session';
import { store } from '../store';
import { TCredential } from '../types/credential';
import { profileKeyFor } from './quick-access';
import {
  discovery, getCredentials, isTokenFresh, replaceAccessToken,
} from './oauth';
import transactionPayload from './transaction-payload';

export default async function directSession(profileKey: string) {
  const authorization = String(axios.defaults.headers.Authorization || '');
  const credentials = await getCredentials() as TCredential[];
  let credential = credentials.find((item) => profileKeyFor(item.backendURL, item.email) === profileKey && `Bearer ${item.accessToken}` === authorization);
  if (!credential) throw new Error('quick_access_auth_required');

  if (!isTokenFresh(credential.accessTokenExpiresIn)) {
    if (!credential.refreshToken) throw new Error('quick_access_auth_required');
    const previous = credential;
    const response = await refreshAsync({
      clientId: previous.oauthClientId,
      refreshToken: previous.refreshToken,
      extraParams: { client_secret: previous.oauthClientSecret },
    }, discovery(previous.backendURL));
    if (!response.accessToken) throw new Error('quick_access_auth_required');
    credential = {
      ...previous,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || previous.refreshToken,
      accessTokenExpiresIn: response.issuedAt && response.expiresIn ? String(response.issuedAt + response.expiresIn - 600) : '',
    };
    await replaceAccessToken(credential, previous.refreshToken);
    // A refresh for one profile must not overwrite a session selected while
    // the network request was in flight.
    if (store.getState().quickAccess.profileKey === profileKey && String(axios.defaults.headers.Authorization || '') === authorization) {
      axios.defaults.headers.Authorization = `Bearer ${credential.accessToken}`;
    }
  }

  const selected = credential;
  return (body: ReturnType<typeof transactionPayload>) => {
    const current = store.getState();
    if (current.quickAccess.profileKey !== profileKey || current.configuration.backendURL.replace(/\/+$/, '') !== selected.backendURL.replace(/\/+$/, '')) {
      throw new Error('quick_access_session_changed');
    }
    return store.dispatch.configuration.apiPost({
      url: '/api/v1/transactions',
      body,
      config: { headers: { Authorization: `Bearer ${selected.accessToken}` }, timeout: 20000 },
    });
  };
}
