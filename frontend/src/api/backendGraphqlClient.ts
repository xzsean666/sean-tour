import { getBackendToken } from "./backendTokenStorage";
import {
  handleSessionExpired,
  isSessionExpiredErrorMessage,
} from "./sessionExpiry";

const backendGraphqlUrl =
  import.meta.env.VITE_BACKEND_GRAPHQL_URL || "http://localhost:3000/graphql";

type GraphQLErrorItem = {
  message?: string;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLErrorItem[];
};

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unexpected backend GraphQL error.");
}

function getCurrentPath(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}

export async function requestBackendGraphQL<TData>(params: {
  query: string;
  variables?: Record<string, unknown>;
  token?: string | null;
  headers?: Record<string, string>;
}): Promise<TData> {
  const token = params.token ?? getBackendToken();
  const hasBackendToken = !!token;
  const currentPath = getCurrentPath();

  const response = await fetch(backendGraphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(params.headers || {}),
    },
    body: JSON.stringify({
      query: params.query,
      variables: params.variables || {},
    }),
  });

  if (!response.ok) {
    if (hasBackendToken && response.status === 401) {
      void handleSessionExpired(currentPath);
    }

    throw new Error(`Backend request failed with status ${response.status}`);
  }

  let payload: GraphQLResponse<TData>;

  try {
    payload = (await response.json()) as GraphQLResponse<TData>;
  } catch (error) {
    throw asError(error);
  }

  if (payload.errors && payload.errors.length > 0) {
    const message = payload.errors[0]?.message || "GraphQL request failed";

    if (hasBackendToken && isSessionExpiredErrorMessage(message)) {
      void handleSessionExpired(currentPath);
    }

    throw new Error(message);
  }

  if (!payload.data) {
    throw new Error("Backend GraphQL returned empty data.");
  }

  return payload.data;
}
