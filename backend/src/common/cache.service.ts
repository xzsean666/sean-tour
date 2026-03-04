import {
  createCacheDecorator,
  SqliteKVDatabase,
} from '../helpers/sdks/sean-tour/index';

export const cacheFn = createCacheDecorator(
  new SqliteKVDatabase('db/cache.db'),
);
export const cacheMemoFn = createCacheDecorator(new SqliteKVDatabase());
