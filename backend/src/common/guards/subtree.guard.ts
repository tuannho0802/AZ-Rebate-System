import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubtreeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Admin can access everything
    if (user.type === 'ADMIN') {
      return true;
    }

    // Target user ID can be in params or body
    const targetUserId = request.params.id || request.body.userId;

    if (!targetUserId) {
      return true; // No specific user targeted, or handled by service
    }

    if (user.id === targetUserId) {
      return true; // Can access own data
    }

    // Use Recursive CTE to check if targetUserId is in the subtree of user.id
    const result = await this.prisma.$queryRaw<any[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "User" WHERE "parentId" = ${user.id}
        UNION ALL
        SELECT u.id FROM "User" u
        INNER JOIN subtree s ON u."parentId" = s.id
      )
      SELECT id FROM subtree WHERE id = ${targetUserId}
      LIMIT 1;
    `;

    if (result.length === 0) {
      throw new ForbiddenException('You do not have permission to access this user');
    }

    return true;
  }
}
