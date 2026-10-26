type ApiFailure = { response?: { status?: number; data?: { errors?: Record<string, string[]> } }; code?: string };

export default function apiError(error: unknown): { key: string; details?: string } {
  const failure = error as ApiFailure;
  const status = failure?.response?.status;
  if (status === 401) return { key: 'api_error_auth' };
  if (status === 403) return { key: 'api_error_forbidden' };
  if (status === 422) {
    const values = failure.response?.data?.errors;
    const messages = values && typeof values === 'object' ? Object.values(values).flat().filter((value) => typeof value === 'string').slice(0, 3) : [];
    return { key: 'api_error_validation', details: messages.join('\n') };
  }
  if (status === 429) return { key: 'api_error_rate_limit' };
  if (!status) return { key: 'api_error_connection' };
  return { key: 'api_error_server' };
}
