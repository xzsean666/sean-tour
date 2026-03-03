import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';
import { requireSupabaseClient } from './supabaseClient';

type ServiceResponse<TData> = {
  data: TData | null;
  error: Error | null;
};

type ServiceActionResult<TData> = {
  data?: TData | null;
  error: Error | null;
};

type SignInWithEmailData = Awaited<
  ReturnType<SupabaseClient['auth']['signInWithPassword']>
>['data'];
type SignUpWithEmailData = Awaited<
  ReturnType<SupabaseClient['auth']['signUp']>
>['data'];
type SignInWithGoogleData = Awaited<
  ReturnType<SupabaseClient['auth']['signInWithOAuth']>
>['data'];
type SendPasswordResetData = Awaited<
  ReturnType<SupabaseClient['auth']['resetPasswordForEmail']>
> extends { data: infer TData }
  ? TData
  : null;
type UpdatePasswordData = Awaited<
  ReturnType<SupabaseClient['auth']['updateUser']>
>['data'];
type GetSessionData = Awaited<ReturnType<SupabaseClient['auth']['getSession']>>['data'];
type GetUserData = Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data'];

type AuthStateChangeResult = {
  data: {
    subscription: {
      unsubscribe: () => void;
    };
  } | null;
  error: Error | null;
};

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('Unexpected authentication error.');
}

async function withClient<TData>(
  action: (client: SupabaseClient) => Promise<ServiceActionResult<TData>>,
): Promise<ServiceResponse<TData>> {
  try {
    const client = requireSupabaseClient();
    const result = await action(client);

    return {
      data: result.data ?? null,
      error: result.error,
    };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

function getOAuthRedirectUrl(): string {
  return (
    import.meta.env.VITE_AUTH_REDIRECT_URL ||
    `${window.location.origin}/auth/callback`
  );
}

function getResetRedirectUrl(): string {
  return (
    import.meta.env.VITE_RESET_PASSWORD_REDIRECT_URL ||
    `${window.location.origin}/auth/reset-password`
  );
}

export const authService = {
  signInWithEmail(
    email: string,
    password: string,
  ): Promise<ServiceResponse<SignInWithEmailData>> {
    return withClient<SignInWithEmailData>((client) =>
      client.auth.signInWithPassword({
        email,
        password,
      }),
    );
  },

  signUpWithEmail(
    email: string,
    password: string,
  ): Promise<ServiceResponse<SignUpWithEmailData>> {
    return withClient<SignUpWithEmailData>((client) =>
      client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getOAuthRedirectUrl(),
        },
      }),
    );
  },

  signInWithGoogle(): Promise<ServiceResponse<SignInWithGoogleData>> {
    return withClient<SignInWithGoogleData>((client) =>
      client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(),
        },
      }),
    );
  },

  sendPasswordResetEmail(
    email: string,
  ): Promise<ServiceResponse<SendPasswordResetData>> {
    return withClient<SendPasswordResetData>((client) =>
      client.auth.resetPasswordForEmail(email, {
        redirectTo: getResetRedirectUrl(),
      }),
    );
  },

  updatePassword(newPassword: string): Promise<ServiceResponse<UpdatePasswordData>> {
    return withClient<UpdatePasswordData>((client) =>
      client.auth.updateUser({
        password: newPassword,
      }),
    );
  },

  getSession(): Promise<ServiceResponse<GetSessionData>> {
    return withClient<GetSessionData>((client) => client.auth.getSession());
  },

  getUser(): Promise<ServiceResponse<GetUserData>> {
    return withClient<GetUserData>((client) => client.auth.getUser());
  },

  signOut(): Promise<ServiceResponse<null>> {
    return withClient<null>(async (client) => {
      const { error } = await client.auth.signOut();
      return { data: null, error };
    });
  },

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): AuthStateChangeResult {
    try {
      const client = requireSupabaseClient();
      const result = client.auth.onAuthStateChange(callback);

      return {
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      return {
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
        error: asError(error),
      };
    }
  },
};
