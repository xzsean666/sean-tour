import { requestBackendGraphQL } from "./backendGraphqlClient";

type LoginWithSupabaseTokenResponse = {
  loginWithSupabaseToken: {
    token: string;
  };
};

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unexpected backend auth error.");
}

export const backendAuthService = {
  async exchangeSupabaseAccessToken(
    accessToken: string,
  ): Promise<{ token: string | null; error: Error | null }> {
    if (!accessToken.trim()) {
      return {
        token: null,
        error: new Error("Supabase access token is empty."),
      };
    }

    try {
      const data = await requestBackendGraphQL<LoginWithSupabaseTokenResponse>({
        query: `
          mutation LoginWithSupabaseToken($input: SupabaseTokenLoginInput!) {
            loginWithSupabaseToken(input: $input) {
              token
            }
          }
        `,
        variables: {
          input: {
            access_token: accessToken,
          },
        },
        token: null,
      });

      return {
        token: data.loginWithSupabaseToken.token,
        error: null,
      };
    } catch (error) {
      return {
        token: null,
        error: asError(error),
      };
    }
  },
};
