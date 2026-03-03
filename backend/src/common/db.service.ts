import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PGKVDatabase } from '../helpers/sdks/sean-tour/index';
import { config } from '../config';

export { PGKVDatabase };

@Injectable()
export class DBService implements OnModuleDestroy {
  private dbInstances: Map<string, PGKVDatabase> = new Map();
  private readonly dbUrl: string;
  constructor() {
    const dbUrl = config.database.url;
    if (!dbUrl) {
      throw new Error('DATABASE_URL 环境变量未设置');
    }
    this.dbUrl = dbUrl;
  }

  getDBInstance(tableName: string): PGKVDatabase {
    if (config.database.prefix) {
      tableName = `${config.database.prefix}_${tableName}`;
    }

    if (!this.dbInstances.has(tableName)) {
      this.dbInstances.set(tableName, new PGKVDatabase(this.dbUrl, tableName));
    }
    return this.dbInstances.get(tableName) as PGKVDatabase;
  }

  async onModuleDestroy() {
    for (const db of this.dbInstances.values()) {
      await db.close();
    }
    this.dbInstances.clear();
  }
}

export const db_tables = {
  user_db: 'user_db',
  meta_db: 'meta_db',
};
