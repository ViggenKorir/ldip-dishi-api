import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase admin client used to verify social-login tokens.
 *
 * Created lazily, not in onModuleInit: a missing or misconfigured Supabase
 * must take down only the social-auth path, not the whole API (health,
 * password sign-in and everything else work without it).
 */
@Injectable()
export class SupabaseService {
  private supabaseAdmin: SupabaseClient | null = null;

  constructor(private configService: ConfigService) {}

  /** True when the env needed for token verification is present. */
  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('SUPABASE_URL') &&
        this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  /**Method to get supabase client */
  getAdminClient(): SupabaseClient {
    if (this.supabaseAdmin) return this.supabaseAdmin;

    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new Error(
        'Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    this.supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return this.supabaseAdmin;
  }
}
