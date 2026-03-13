import { requestBackendGraphQL } from "./backendGraphqlClient";

export type NotificationType =
  | "BOOKING"
  | "PAYMENT"
  | "ASSISTANT"
  | "PROFILE"
  | "SYSTEM";

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  targetPath?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

type NotificationPageGraphQL = {
  myNotifications: {
    items: NotificationItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type MarkNotificationReadGraphQL = {
  markNotificationRead: NotificationItem;
};

export const notificationService = {
  async getMyNotifications(params?: {
    type?: NotificationType;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: NotificationItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<NotificationPageGraphQL>({
      query: `
        query MyNotifications($input: NotificationListInput) {
          myNotifications(input: $input) {
            items {
              id
              userId
              type
              title
              message
              targetPath
              readAt
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
          ...(params?.type ? { type: params.type } : {}),
          ...(params?.unreadOnly ? { unreadOnly: true } : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return data.myNotifications;
  },

  async markNotificationRead(notificationId: string): Promise<NotificationItem> {
    const data = await requestBackendGraphQL<MarkNotificationReadGraphQL>({
      query: `
        mutation MarkNotificationRead($notificationId: String!) {
          markNotificationRead(notificationId: $notificationId) {
            id
            userId
            type
            title
            message
            targetPath
            readAt
            createdAt
            updatedAt
          }
        }
      `,
      variables: {
        notificationId,
      },
    });

    return data.markNotificationRead;
  },
};
