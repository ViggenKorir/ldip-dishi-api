import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Request } from 'express';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class SupabaseGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SupabaseUser }>();
    const authorization = request.headers.authorization;
    const bearer = authorization && /^Bearer\s+(\S+)$/i.exec(authorization);

    if (!bearer) throw new UnauthorizedException();

    if (!this.supabaseService.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Authentication is not configured on this server.',
      });
    }

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .auth.getUser(bearer[1]);

    if (error || !data.user) throw new UnauthorizedException();

    request.user = data.user;
    return true;
  }
}
