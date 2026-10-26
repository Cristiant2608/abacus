import axios from 'axios';
import { getCredentials } from './oauth';
import { profileKeyFor } from './quick-access';
import refreshCredential from './refresh-credential';

/** Only idempotent reads retry after a confirmed 401; writes never use this path. */
export default function fireflyReader(backend: string, profile: string, initialAuthorization: string, isCurrent: () => boolean) {
  let authorization = initialAuthorization;
  return async (path: string) => {
    if (!path.startsWith('/api/v1/') || !isCurrent()) throw new Error('quick_access_session_changed');
    const request = () => axios.get(`${backend.replace(/\/+$/, '')}${path}`, { headers: { Authorization: authorization }, timeout: 20000 });
    try {
      return (await request()).data;
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status !== 401) throw error;
      const credential = (await getCredentials()).find((item) => profileKeyFor(item.backendURL, item.email) === profile && `Bearer ${item.accessToken}` === authorization);
      if (!credential?.refreshToken || !isCurrent()) throw error;
      const updated = await refreshCredential(credential);
      if (!isCurrent()) throw new Error('quick_access_session_changed');
      const previous = authorization;
      authorization = `Bearer ${updated.accessToken}`;
      if (String(axios.defaults.headers.Authorization || '') === previous) axios.defaults.headers.Authorization = authorization;
      return (await request()).data;
    }
  };
}
