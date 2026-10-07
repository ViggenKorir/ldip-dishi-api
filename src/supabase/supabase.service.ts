import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabaseAdmin: SupabaseClient;

  constructor(private configService: ConfigService) {}

  /**Initiate supabase admin on module initialization */
  onModuleInit() {
    this.supabaseAdmin = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  /**Method to get supabase client */
  getAdminClient(): SupabaseClient {
    return this.supabaseAdmin;
  }
}
