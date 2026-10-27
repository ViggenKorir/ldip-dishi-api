import type { User as SupabaseUser } from '@supabase/supabase-js';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = { user: { upsert: jest.fn() } };
  const service = new AuthService(prisma as unknown as PrismaService);

  beforeEach(() => {
    prisma.user.upsert.mockReset();
  });

  it('creates a Dishi user and default settings on first login', async () => {
    const authUser = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'person@example.com',
      phone: '+254700000001',
      app_metadata: { provider: 'phone' },
      user_metadata: {
        full_name: 'Dishi User',
        avatar_url: 'https://example.com/avatar.png',
      },
      identities: [],
    } as unknown as SupabaseUser;

    await service.syncUser(authUser);

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: authUser.id },
      create: expect.objectContaining({
        id: authUser.id,
        email: authUser.email,
        phone: authUser.phone,
        displayName: 'Dishi User',
        avatarUrl: 'https://example.com/avatar.png',
        authProvider: 'phone',
        lastLoginAt: expect.any(Date),
        settings: { create: {} },
      }),
      update: { lastLoginAt: expect.any(Date) },
    });
  });

  it.each([
    {
      provider: 'google',
      userMetadata: {
        name: 'Google User',
        picture: 'https://example.com/google.png',
      },
      expectedName: 'Google User',
      expectedAvatar: 'https://example.com/google.png',
    },
    {
      provider: 'apple',
      userMetadata: {
        full_name: 'Apple User',
        avatar_url: 'https://example.com/apple.png',
      },
      expectedName: 'Apple User',
      expectedAvatar: 'https://example.com/apple.png',
    },
  ])(
    'maps $provider identity metadata',
    async ({ provider, userMetadata, expectedName, expectedAvatar }) => {
      const authUser = {
        id: '00000000-0000-4000-8000-000000000002',
        app_metadata: {},
        user_metadata: userMetadata,
        identities: [{ provider }],
      } as unknown as SupabaseUser;

      await service.syncUser(authUser);

      const create = prisma.user.upsert.mock.calls[0][0].create;
      expect(create.authProvider).toBe(provider);
      expect(create.displayName).toBe(expectedName);
      expect(create.avatarUrl).toBe(expectedAvatar);
    },
  );

  it('updates only lastLoginAt on subsequent logins', async () => {
    await service.syncUser({
      id: '00000000-0000-4000-8000-000000000003',
      app_metadata: {},
      user_metadata: {},
      identities: [],
    } as unknown as SupabaseUser);

    expect(Object.keys(prisma.user.upsert.mock.calls[0][0].update)).toEqual([
      'lastLoginAt',
    ]);
  });
});
