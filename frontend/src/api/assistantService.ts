import { requestBackendGraphQL } from './backendGraphqlClient';

export type AssistantSessionStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED';

export interface AssistantSessionItem {
  id: string;
  bookingId: string;
  userId: string;
  serviceId: string;
  serviceTitle: string;
  city: string;
  language: string;
  topic: string;
  preferredContact: string;
  preferredTimeSlots: string[];
  status: AssistantSessionStatus;
  assignedAgent?: string;
  internalNote?: string;
  createdAt: string;
  updatedAt: string;
}

type RequestAssistantSessionGraphQL = {
  requestAssistantSession: AssistantSessionItem;
};

type MyAssistantSessionsGraphQL = {
  myAssistantSessions: {
    items: AssistantSessionItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type AssistantSessionDetailGraphQL = {
  assistantSessionDetail: AssistantSessionItem;
};

export const assistantService = {
  async requestSession(input: {
    bookingId: string;
    topic: string;
    preferredContact: string;
    preferredTimeSlots: string[];
    language?: string;
  }): Promise<AssistantSessionItem> {
    const data = await requestBackendGraphQL<RequestAssistantSessionGraphQL>({
      query: `
        mutation RequestAssistantSession($input: RequestAssistantSessionInput!) {
          requestAssistantSession(input: $input) {
            id
            bookingId
            userId
            serviceId
            serviceTitle
            city
            language
            topic
            preferredContact
            preferredTimeSlots
            status
            assignedAgent
            internalNote
            createdAt
            updatedAt
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.requestAssistantSession;
  },

  async getMySessions(params?: {
    bookingId?: string;
    status?: AssistantSessionStatus;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: AssistantSessionItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 10, 1), 50);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<MyAssistantSessionsGraphQL>({
      query: `
        query MyAssistantSessions($input: AssistantSessionListInput) {
          myAssistantSessions(input: $input) {
            items {
              id
              bookingId
              userId
              serviceId
              serviceTitle
              city
              language
              topic
              preferredContact
              preferredTimeSlots
              status
              assignedAgent
              internalNote
              createdAt
              updatedAt
            }
            total
            limit
            offset
            hasMore
          }
        }
      `,
      variables: {
        input: {
          ...(params?.bookingId ? { bookingId: params.bookingId } : {}),
          ...(params?.status ? { status: params.status } : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return data.myAssistantSessions;
  },

  async getSessionDetail(sessionId: string): Promise<AssistantSessionItem> {
    const data = await requestBackendGraphQL<AssistantSessionDetailGraphQL>({
      query: `
        query AssistantSessionDetail($sessionId: String!) {
          assistantSessionDetail(sessionId: $sessionId) {
            id
            bookingId
            userId
            serviceId
            serviceTitle
            city
            language
            topic
            preferredContact
            preferredTimeSlots
            status
            assignedAgent
            internalNote
            createdAt
            updatedAt
          }
        }
      `,
      variables: {
        sessionId,
      },
    });

    return data.assistantSessionDetail;
  },
};
