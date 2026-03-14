jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

import { AuthService } from './auth.service';
import { AdminAccessService } from './admin-access.service';
import { RoleAccessService } from './role-access.service';
import { SupabaseService } from './supabase.service';
import { UserService } from './user.service';
import { WeChatService } from './wechat.service';

describe('AuthService', () => {
  let adminAccessService: jest.Mocked<
    Pick<AdminAccessService, 'isAdminIdentity'>
  >;
  let roleAccessService: jest.Mocked<Pick<RoleAccessService, 'isRoleGranted'>>;
  let service: AuthService;

  beforeEach(() => {
    adminAccessService = {
      isAdminIdentity: jest.fn(),
    };
    roleAccessService = {
      isRoleGranted: jest.fn(),
    };

    service = new AuthService(
      {} as WeChatService,
      {} as UserService,
      {} as SupabaseService,
      adminAccessService as unknown as AdminAccessService,
      roleAccessService as unknown as RoleAccessService,
    );
  });

  it('returns admin and support agent flags in current user payload', async () => {
    adminAccessService.isAdminIdentity.mockResolvedValue(true);
    roleAccessService.isRoleGranted.mockResolvedValue(true);

    await expect(
      service.getCurrentUser({
        user_id: 'user_1',
        user_account: 'traveler@example.com',
        provider: 'supabase',
        email: 'traveler@example.com',
      }),
    ).resolves.toEqual({
      user_id: 'user_1',
      user_account: 'traveler@example.com',
      provider: 'supabase',
      email: 'traveler@example.com',
      is_admin: true,
      is_support_agent: true,
    });

    expect(adminAccessService.isAdminIdentity).toHaveBeenCalledWith({
      userId: 'user_1',
      email: 'traveler@example.com',
    });
    expect(roleAccessService.isRoleGranted).toHaveBeenCalledWith(
      'SUPPORT_AGENT',
      {
        userId: 'user_1',
        email: 'traveler@example.com',
      },
    );
  });

  it('defaults role flags to false when access is not granted', async () => {
    adminAccessService.isAdminIdentity.mockResolvedValue(false);
    roleAccessService.isRoleGranted.mockResolvedValue(false);

    await expect(
      service.getCurrentUser({
        user_id: 'user_2',
        user_account: 'user_2',
        provider: 'wechat',
      }),
    ).resolves.toEqual({
      user_id: 'user_2',
      user_account: 'user_2',
      provider: 'wechat',
      email: undefined,
      is_admin: false,
      is_support_agent: false,
    });
  });
});
