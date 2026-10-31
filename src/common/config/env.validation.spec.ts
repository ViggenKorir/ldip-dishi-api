import { validateEnv } from './env.validation';

const productionConfig = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://localhost/app',
  JWT_SECRET: 'test-secret',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
};

describe('validateEnv CORS configuration', () => {
  it('requires an explicit frontend origin in production', () => {
    expect(() => validateEnv(productionConfig)).toThrow(
      'FRONTEND_URL or CORS_ORIGINS must contain the production frontend origin',
    );
  });

  it('accepts a comma-separated explicit origin allow-list', () => {
    expect(
      validateEnv({
        ...productionConfig,
        CORS_ORIGINS: 'https://dishi-app.vercel.app, https://preview.example.com',
      }).CORS_ORIGINS,
    ).toBe('https://dishi-app.vercel.app, https://preview.example.com');
  });

  it('rejects wildcard and non-origin CORS entries', () => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        CORS_ORIGINS: '*',
      }),
    ).toThrow('CORS origins must be an explicit allow-list, never *');

    expect(() =>
      validateEnv({
        ...productionConfig,
        CORS_ORIGINS: 'https://dishi-app.vercel.app/discover',
      }),
    ).toThrow('Invalid CORS origin');
  });
});
