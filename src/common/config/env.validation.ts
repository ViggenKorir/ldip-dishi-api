/**
 * Boot-time configuration validation (guide §3.5).
 *
 * The app refuses to start on missing or malformed values. Names only in
 * `.env.example`; nothing secret is checked in.
 */

const TRUTHY = ['true', '1', 'yes'];

export const validateEnv = (
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const errors: string[] = [];
  const isProd = config.NODE_ENV === 'production';

  const required = ['DATABASE_URL', 'JWT_SECRET'];
  for (const key of required) {
    if (typeof config[key] !== 'string' || !config[key]) {
      errors.push(`${key} is required`);
    }
  }

  // Social sign-in is a production necessity; dev may start without it
  // (the SupabaseService fails closed per-request, not at boot).
  if (isProd) {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
      if (typeof config[key] !== 'string' || !config[key]) {
        errors.push(`${key} is required in production`);
      }
    }
  }

  const swaggerEnabled =
    config.SWAGGER_ENABLED === undefined
      ? !isProd // on unless we are in production
      : TRUTHY.includes(String(config.SWAGGER_ENABLED).toLowerCase());

  if (swaggerEnabled && isProd) {
    if (!config.SWAGGER_BASIC_AUTH_USER || !config.SWAGGER_BASIC_AUTH_PASS) {
      errors.push(
        'SWAGGER_ENABLED=true in production requires SWAGGER_BASIC_AUTH_USER and SWAGGER_BASIC_AUTH_PASS',
      );
    }
  }

  const corsOrigins = [
    ...(typeof config.FRONTEND_URL === 'string' ? [config.FRONTEND_URL] : []),
    ...(typeof config.CORS_ORIGINS === 'string'
      ? config.CORS_ORIGINS.split(',')
      : []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProd && corsOrigins.length === 0) {
    errors.push(
      'FRONTEND_URL or CORS_ORIGINS must contain the production frontend origin',
    );
  }

  for (const origin of corsOrigins) {
    if (origin.includes('*')) {
      errors.push('CORS origins must be an explicit allow-list, never *');
      continue;
    }

    try {
      const parsed = new URL(origin);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin.replace(/\/$/, '') ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash
      ) {
        errors.push(`Invalid CORS origin: ${origin}`);
      }
    } catch {
      errors.push(`Invalid CORS origin: ${origin}`);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid configuration:\n- ${errors.join('\n- ')}`);
  }

  return { ...config, SWAGGER_RESOLVED: swaggerEnabled ? 'true' : 'false' };
};
