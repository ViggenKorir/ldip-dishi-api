import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class SupabaseGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return false;
    }

    const token = authHeader.split(' ')[1]; //Bearer <token>
    if (!token) {
      return false;
    }

    const supabase = this.supabaseService.getAdminClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return false;
    }

    /**Attach user to request for use in controllers */
    request.user = user;

    return true;
  }
}
