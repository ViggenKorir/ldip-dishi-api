import {
  ExecutionContext,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Request } from 'express';
import { SupabaseService } from 'src/supabase/supabase.service';
import { SupabaseGuard } from './supabase.guard';

describe('SupabaseGuard', () => {
  const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const authGetUser = jest.fn();
  const supabase = {
    isConfigured: jest.fn(),
    getAdminClient: jest.fn(() => ({
      auth: { getUser: authGetUser },
    })),
  };
  const guard = new SupabaseGuard(supabase as unknown as SupabaseService);

  const makeContext = (authorization?: string) => {
    const request = {
      headers: { authorization },
    } as Request & { user?: SupabaseUser };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    authGetUser.mockReset();
    supabase.isConfigured.mockReset();
    supabase.getAdminClient.mockClear();
    warnSpy.mockClear();
  });

  it.each([undefined, 'Basic abc', 'Bearer'])(
    'rejects a missing or malformed authorization header',
    async (authorization) => {
      const { context } = makeContext(authorization);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(supabase.isConfigured).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['invalid', { data: { user: null }, error: { message: 'invalid token' } }],
    ['expired', { data: { user: null }, error: { message: 'token expired' } }],
  ])('rejects an %s Supabase token', async (_label, result) => {
    supabase.isConfigured.mockReturnValue(true);
    authGetUser.mockResolvedValue(result);
    const { context } = makeContext('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns a service error when Supabase is not configured', async () => {
    supabase.isConfigured.mockReturnValue(false);
    const { context } = makeContext('Bearer valid-shaped-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(supabase.getAdminClient).not.toHaveBeenCalled();
  });

  it('logs only safe verification metadata when Supabase rejects the token', async () => {
    supabase.isConfigured.mockReturnValue(true);
    authGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 401, code: 'invalid_token' },
    });
    const { context } = makeContext('Bearer diagnostic-test-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const loggedMessage = warnSpy.mock.calls[0]?.[0];
    expect(loggedMessage).toContain('"event":"supabase_token_verification_failed"');
    expect(loggedMessage).toContain('"errorStatus":401');
    expect(loggedMessage).toContain('"errorCode":"invalid_token"');
    expect(loggedMessage).not.toContain('diagnostic-test-token');
  });

  it('attaches the verified Supabase user to the request', async () => {
    const user = { id: 'auth-user-id' } as SupabaseUser;
    supabase.isConfigured.mockReturnValue(true);
    authGetUser.mockResolvedValue({ data: { user }, error: null });
    const { context, request } = makeContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(authGetUser).toHaveBeenCalledWith('valid-token');
    expect(request.user).toBe(user);
  });
});
