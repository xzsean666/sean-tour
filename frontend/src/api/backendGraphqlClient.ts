import { getBackendToken } from "./backendTokenStorage";

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

export async function requestBackendGraphQL<TData>(params: {
  query: string;
  variables?: Record<string, unknown>;
  token?: string | null;
}): Promise<TData> {
  const token = params.token ?? getBackendToken();

  const response = await fetch(backendGraphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      query: params.query,
      variables: params.variables || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}`);
  }

  let payload: GraphQLResponse<TData>;

  try {
    payload = (await response.json()) as GraphQLResponse<TData>;
  } catch (error) {
    throw asError(error);
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message || "GraphQL request failed");
  }

  if (!payload.data) {
    throw new Error("Backend GraphQL returned empty data.");
  }

  return payload.data;
}
