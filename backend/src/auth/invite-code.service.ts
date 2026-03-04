import { Injectable } from '@nestjs/common';
import { DBService, PGKVDatabase } from '../common/db.service';
import { randomUUID } from 'crypto';
import { InviteCodeInfo } from './dto/invite-code.dto';

type SearchJsonRow = {
  key: string;
  value: unknown;
};

function toInviteCodeInfo(value: unknown): InviteCodeInfo | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<InviteCodeInfo>;
  if (
    typeof candidate.code !== 'string' ||
    typeof candidate.username !== 'string'
  ) {
    return null;
  }

  return {
    code: candidate.code,
    username: candidate.username,
    createdAt:
      typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
  };
}

@Injectable()
export class InviteCodeService {
  protected readonly dbService: DBService;
  protected readonly inviteCodeDB: PGKVDatabase;

  constructor() {
    this.dbService = new DBService();
    this.inviteCodeDB = this.dbService.getDBInstance('invite_code');
  }

  async createInviteCode(username: string): Promise<string> {
    const inviteCode = randomUUID();
    await this.inviteCodeDB.put(inviteCode, {
      code: inviteCode.slice(0, 6),
      username,
    });
    return inviteCode.slice(0, 6);
  }

  async verifyInviteCode(inviteCode: string): Promise<boolean> {
    // 使用简单的文本比较
    const result = await this.inviteCodeDB.searchJson({
      contains: {
        code: inviteCode,
      },
    });
    const isValid = result.data.length > 0;
    if (!isValid) {
      throw new Error('Invalid invite code');
    }
    return true;
  }

  async getInviteCodeInfo(inviteCode: string): Promise<InviteCodeInfo | null> {
    const result = await this.inviteCodeDB.searchJson({
      contains: {
        code: inviteCode,
      },
    });

    const rows = result.data as SearchJsonRow[];
    if (rows.length > 0) {
      return toInviteCodeInfo(rows[0].value);
    }
    return null;
  }

  async deleteInviteCode(inviteCode: string): Promise<boolean> {
    const result = await this.inviteCodeDB.searchJson({
      contains: {
        code: inviteCode,
      },
    });

    const rows = result.data as SearchJsonRow[];
    if (rows.length > 0) {
      const key = rows[0].key;
      await this.inviteCodeDB.delete(key);
      return true;
    }
    return false;
  }
}
