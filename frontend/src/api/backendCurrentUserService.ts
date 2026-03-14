import { requestBackendGraphQL } from "./backendGraphqlClient";

export interface BackendCurrentUser {
  userId: string;
  userAccount: string;
  provider: string;
  email?: string;
  isAdmin: boolean;
  isSupportAgent: boolean;
}

type CurrentUserGraphQL = {
  currentUser: BackendCurrentUser;
};

export const backendCurrentUserService = {
  async getCurrentUser(token?: string | null): Promise<BackendCurrentUser> {
    const data = await requestBackendGraphQL<CurrentUserGraphQL>({
      query: `
        query CurrentUser {
          currentUser {
            userId: user_id
            userAccount: user_account
            provider
            email
            isAdmin: is_admin
            isSupportAgent: is_support_agent
          }
        }
      `,
      token,
    });

    return data.currentUser;
  },
};
