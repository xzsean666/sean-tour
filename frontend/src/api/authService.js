import { requireSupabaseClient } from './supabaseClient';

function asError(error) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('Unexpected authentication error.');
}

async function withClient(action) {
  try {
    const client = requireSupabaseClient();
    return await action(client);
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

function getOAuthRedirectUrl() {
  return (
    import.meta.env.VITE_AUTH_REDIRECT_URL ||
    `${window.location.origin}/auth/callback`
  );
}

function getResetRedirectUrl() {
  return (
    import.meta.env.VITE_RESET_PASSWORD_REDIRECT_URL ||
    `${window.location.origin}/auth/reset-password`
  );
}

export const authService = {
  signInWithEmail(email, password) {
    return withClient((client) =>
      client.auth.signInWithPassword({
        email,
        password,
      }),
    );
  },

  signUpWithEmail(email, password) {
    return withClient((client) =>
      client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getOAuthRedirectUrl(),
        },
      }),
    );
  },

  signInWithGoogle() {
    return withClient((client) =>
      client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(),
        },
      }),
    );
  },

  sendPasswordResetEmail(email) {
    return withClient((client) =>
      client.auth.resetPasswordForEmail(email, {
        redirectTo: getResetRedirectUrl(),
      }),
    );
  },

  updatePassword(newPassword) {
    return withClient((client) =>
      client.auth.updateUser({
        password: newPassword,
      }),
    );
  },

  getSession() {
    return withClient((client) => client.auth.getSession());
  },

  getUser() {
    return withClient((client) => client.auth.getUser());
  },

  signOut() {
    return withClient((client) => client.auth.signOut());
  },

  onAuthStateChange(callback) {
    try {
      const client = requireSupabaseClient();
      return client.auth.onAuthStateChange(callback);
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
