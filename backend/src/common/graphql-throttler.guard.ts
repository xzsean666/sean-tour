import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class GraphQLThrottlerGuard extends ThrottlerGuard {
  constructor(
    private readonly _options: ThrottlerModuleOptions,
    private readonly _storageService: ThrottlerStorage,
    private readonly _reflector: Reflector,
  ) {
    super(_options, _storageService, _reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否跳过节流 - 使用从日志中找到的正确键
    const skipThrottle = this._reflector.getAllAndOverride<boolean>(
      'THROTTLER:SKIPdefault',
      [context.getHandler(), context.getClass()],
    );

    if (skipThrottle) {
      return true;
    }

    return super.canActivate(context);
  }

  protected getRequestResponse(context: ExecutionContext) {
    // 检查是否为GraphQL请求
    const gqlContext = GqlExecutionContext.create(context);
    const isGraphQL = gqlContext.getType() === 'graphql';

    if (isGraphQL) {
      // GraphQL请求 - 从上下文获取request对象
      const ctx = gqlContext.getContext<{ req?: unknown; res?: unknown }>();
      const req = toRecord(ctx?.req);
      const ctxRes = toRecord(ctx?.res);
      const reqRes = toRecord(req.res);

      return {
        req: req as Record<string, any>,
        res:
          Object.keys(ctxRes).length > 0
            ? (ctxRes as Record<string, any>)
            : (reqRes as Record<string, any>),
      };
    }

    // REST API请求 - 使用默认处理
    const http = context.switchToHttp();
    const req = toRecord(http.getRequest<unknown>());
    const res = toRecord(http.getResponse<unknown>());
    return {
      req: req as Record<string, any>,
      res: res as Record<string, any>,
    };
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    // 从请求中提取客户端标识符（IP地址）
    const request = req as {
      ip?: unknown;
      connection?: { remoteAddress?: unknown };
      socket?: { remoteAddress?: unknown };
    };

    if (typeof request.ip === 'string' && request.ip.trim()) {
      return Promise.resolve(request.ip);
    }

    const connectionIp = request.connection?.remoteAddress;
    if (typeof connectionIp === 'string' && connectionIp.trim()) {
      return Promise.resolve(connectionIp);
    }

    const socketIp = request.socket?.remoteAddress;
    if (typeof socketIp === 'string' && socketIp.trim()) {
      return Promise.resolve(socketIp);
    }

    return Promise.resolve('unknown');
  }
}
