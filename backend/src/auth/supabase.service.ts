import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

export interface SupabaseIdentityResult {
  id: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class SupabaseService {
  private readonly supabase: SupabaseClient | null;

  constructor() {
    if (!config.supabase.url || !config.supabase.key) {
      this.supabase = null;
      return;
    }
    this.supabase = createClient(config.supabase.url, config.supabase.key);
  }

  async registerWithEmail(
    email: string,
    password: string,
  ): Promise<SupabaseIdentityResult> {
    const client = this.getClientOrThrow();
    const { data, error } = await client.auth.signUp({ email, password });

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data.user) {
      throw new UnauthorizedException('Supabase did not return user');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? undefined,
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
    };
  }

  async loginWithEmail(
    email: string,
    password: string,
  ): Promise<SupabaseIdentityResult> {
    const client = this.getClientOrThrow();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }
    if (!data.user || !data.session?.access_token) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? undefined,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async loginWithGoogleIdToken(
    idToken: string,
  ): Promise<SupabaseIdentityResult> {
    const client = this.getClientOrThrow();
    const { data, error } = await client.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }
    if (!data.user || !data.session?.access_token) {
      throw new UnauthorizedException('Google login failed');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? undefined,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async verifyToken(accessToken: string): Promise<SupabaseIdentityResult> {
    const client = this.getClientOrThrow();
    const {
      data: { user },
      error,
    } = await client.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedException('Invalid Supabase access token');
    }

    return {
      id: user.id,
      email: user.email ?? undefined,
      accessToken,
    };
  }

  private getClientOrThrow(): SupabaseClient {
    if (!this.supabase) {
      throw new InternalServerErrorException(
        'Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.',
      );
    }
    return this.supabase;
  }
}
