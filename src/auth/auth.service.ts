import { Injectable } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { PrismaService } from 'src/prisma/prisma.service';

const metadataString = (
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async syncUser(authUser: SupabaseUser) {
    const metadata = authUser.user_metadata ?? {};
    const appMetadata = authUser.app_metadata ?? {};
    const provider =
      metadataString(appMetadata, 'provider') ??
      authUser.identities?.find((identity) => identity.provider)?.provider ??
      null;
    const lastLoginAt = new Date();

    return this.prisma.user.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        email: authUser.email?.trim().toLowerCase() ?? null,
        phone: authUser.phone ?? null,
        displayName: metadataString(metadata, 'full_name', 'name'),
        avatarUrl: metadataString(metadata, 'avatar_url', 'picture'),
        authProvider: provider,
        lastLoginAt,
        settings: { create: {} },
      },
      update: { lastLoginAt },
    });
  }
}
