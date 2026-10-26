import { refreshAsync } from 'expo-auth-session';
import { TCredential } from '../types/credential';
import { discovery, replaceAccessToken } from './oauth';

const pending = new Map<string, Promise<TCredential>>();

export default function refreshCredential(credential: TCredential): Promise<TCredential> {
  const key = JSON.stringify([credential.backendURL, credential.email, credential.oauthClientId, credential.refreshToken]);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    if (!credential.refreshToken) throw new Error('quick_access_auth_required');
    const response = await refreshAsync({
      clientId: credential.oauthClientId,
      refreshToken: credential.refreshToken,
      extraParams: { client_secret: credential.oauthClientSecret },
    }, discovery(credential.backendURL));
    if (!response.accessToken) throw new Error('quick_access_auth_required');
    const updated = {
      ...credential,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || credential.refreshToken,
      accessTokenExpiresIn: response.issuedAt && response.expiresIn ? String(response.issuedAt + response.expiresIn - 600) : '',
    };
    await replaceAccessToken(updated, credential.refreshToken);
    return updated;
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
