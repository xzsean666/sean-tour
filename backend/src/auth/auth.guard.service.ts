import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JWTHelper } from '../helpers/sdk';
import { config } from '../config';
import { AdminAccessService } from './admin-access.service';

type HeaderValue = string | string[] | undefined;

type RequestLike = {
  headers: Record<string, HeaderValue>;
  method?: string;
  path?: string;
  url?: string;
  originalUrl?: string;
  user?: unknown;
};

type GqlContextLike = {
  req?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isRequestLike(value: unknown): value is RequestLike {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.headers);
}

function readHeaderValue(
  headers: Record<string, HeaderValue>,
  key: string,
): string {
  const value = headers[key];
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first.trim() : '';
  }

  return '';
}

function extractBearerToken(request: RequestLike): string | undefined {
  const authHeader = readHeaderValue(request.headers, 'authorization');
  if (!authHeader) {
    return undefined;
  }

  const cleanHeader = authHeader.replace(/"/g, '');
  const [type, token] = cleanHeader.split(' ');
  const normalizedToken = token?.trim();

  return type === 'Bearer' && normalizedToken ? normalizedToken : undefined;
}

/**
 * 从执行上下文中获取请求对象，自动识别 GraphQL 或 REST API
 */
function getRequestFromContext(context: ExecutionContext): RequestLike {
  const gqlContext = GqlExecutionContext.create(context);
  const isGraphQL = gqlContext.getType() === 'graphql';

  if (isGraphQL) {
    const request = gqlContext.getContext<GqlContextLike>()?.req;
    if (isRequestLike(request)) {
      return request;
    }
    throw new UnauthorizedException('Invalid GraphQL request context');
  }

  const request = context.switchToHttp().getRequest<unknown>();
  if (isRequestLike(request)) {
    return request;
  }

  throw new UnauthorizedException('Invalid HTTP request context');
}

function isGraphQLContext(context: ExecutionContext): boolean {
  return GqlExecutionContext.create(context).getType() === 'graphql';
}

function readRequestPath(request: RequestLike): string {
  for (const candidate of [request.originalUrl, request.url, request.path]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function canBypassAdminWithAuthCode(
  context: ExecutionContext,
  request: RequestLike,
  adminAuthCode: string,
): boolean {
  if (
    !adminAuthCode ||
    adminAuthCode !== config.auth.ADMIN_AUTH_CODE ||
    !config.auth.ADMIN_AUTH_CODE.trim()
  ) {
    return false;
  }

  if (isGraphQLContext(context)) {
    return false;
  }

  const requestPath = readRequestPath(request);
  return (
    requestPath.startsWith('/payment/callback/usdt') ||
    requestPath.startsWith('/payment/sync')
  );
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = getRequestFromContext(context);
    return request.user;
  },
);

// REST API专用的CurrentUser装饰器
export const CurrentRestUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = getRequestFromContext(context);
    return request.user;
  },
);

export const CanUploadFile = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = getRequestFromContext(context);
    const canUploadFile = readHeaderValue(request.headers, 'can_upload_file');
    if (!canUploadFile) {
      throw new UnauthorizedException(
        "Unauthorized: Invalid Can't Upload File",
      );
    }

    const jwtUploadHelper = new JWTHelper(config.auth.JWT_SECRET);
    const decoded = jwtUploadHelper.verifyToken(canUploadFile);
    if (!decoded) {
      throw new UnauthorizedException(
        "Unauthorized: Invalid Can't Upload File",
      );
    }
    return decoded;
  },
);

@Injectable()
export class AuthGuard implements CanActivate {
  private jwtHelper: JWTHelper;
  constructor() {
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = getRequestFromContext(context);

    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decoded = this.jwtHelper.verifyToken(token);
      req.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  private jwtHelper: JWTHelper;

  constructor(private readonly adminAccessService: AdminAccessService) {
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context);
    const adminAuthCode = readHeaderValue(request.headers, 'admin_auth_code');

    if (canBypassAdminWithAuthCode(context, request, adminAuthCode)) {
      return true;
    }

    const token = extractBearerToken(request);
    if (!token) {
      if (adminAuthCode) {
        throw new UnauthorizedException(
          'Unauthorized: Invalid Admin Auth Code',
        );
      }

      throw new UnauthorizedException('Unauthorized: Admin access required');
    }

    try {
      const decoded = this.jwtHelper.verifyToken(token);
      request.user = decoded;

      const hasAdminAccess = await this.adminAccessService.isAdminIdentity({
        userId:
          typeof decoded?.user_id === 'string' ? decoded.user_id : undefined,
        email: typeof decoded?.email === 'string' ? decoded.email : undefined,
      });

      if (!hasAdminAccess) {
        throw new ForbiddenException('Forbidden: Admin access required');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid token');
    }
  }
}
