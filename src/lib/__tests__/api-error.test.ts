import apiError from '../api-error';

test('normalizes authentication and server errors without showing raw HTML', () => {
  expect(apiError({ response: { status: 401 } }).key).toBe('api_error_auth');
  expect(apiError({ response: { status: 403 } }).key).toBe('api_error_forbidden');
  expect(apiError({ response: { status: 500, data: '<html>proxy error</html>' } })).toEqual({ key: 'api_error_server' });
  expect(apiError(new Error('Network error')).key).toBe('api_error_connection');
});

test('presents field validation details and rate limiting separately', () => {
  expect(apiError({ response: { status: 422, data: { errors: { amount: ['Required'], source: ['Invalid account'] } } } })).toEqual({ key: 'api_error_validation', details: 'Required\nInvalid account' });
  expect(apiError({ response: { status: 429 } }).key).toBe('api_error_rate_limit');
});
