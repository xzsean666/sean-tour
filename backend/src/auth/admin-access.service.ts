import { Injectable } from '@nestjs/common';
import { DBService } from '../common/db.service';
import { AdminAccess } from './dto/admin-access.dto';
import { AdminSetAccessInput } from './dto/admin-set-access.input';
import { RoleAccessService } from './role-access.service';

@Injectable()
export class AdminAccessService {
  private readonly roleAccessService: RoleAccessService;

  constructor(dbService: DBService) {
    this.roleAccessService = new RoleAccessService(dbService);
  }

  async isAdminIdentity(identity: {
    userId?: string;
    email?: string;
  }): Promise<boolean> {
    return this.roleAccessService.isRoleGranted('ADMIN', identity);
  }

  async listAdminAccessEntries(): Promise<AdminAccess[]> {
    return (await this.roleAccessService.listRoleEntries('ADMIN')).map(
      (entry) => ({
        id: entry.id,
        userId: entry.userId,
        email: entry.email,
        displayName: entry.displayName,
        note: entry.note,
        source: entry.source,
        enabled: entry.enabled,
        editable: entry.editable,
        grantedBy: entry.grantedBy,
        updatedBy: entry.updatedBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }),
    );
  }

  async setAdminAccess(
    input: AdminSetAccessInput,
    actorUser: Record<string, unknown> | undefined,
  ): Promise<AdminAccess> {
    const entry = await this.roleAccessService.setRoleAccess(
      'ADMIN',
      input,
      actorUser,
      {
        protectLastAdmin: true,
      },
    );

    return {
      id: entry.id,
      userId: entry.userId,
      email: entry.email,
      displayName: entry.displayName,
      note: entry.note,
      source: entry.source,
      enabled: entry.enabled,
      editable: entry.editable,
      grantedBy: entry.grantedBy,
      updatedBy: entry.updatedBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
