import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { buildAdminActor } from '../auth/admin-access.util';
import { AdminGuard, CurrentUser } from '../auth/auth.guard.service';
import { CatalogService } from './catalog.service';
import { DeleteServiceInput } from './dto/delete-service.input';
import { ServiceAuditListInput } from './dto/service-audit-list.input';
import { ServiceAuditPage } from './dto/service-audit-page.dto';
import { ServiceDetailUnion } from './dto/service-detail.dto';
import { ServiceItem } from './dto/service-item.dto';
import { ServiceListInput } from './dto/service-list.input';
import { ServicePage } from './dto/service-page.dto';
import { SetServiceStatusInput } from './dto/set-service-status.input';
import { UpsertServiceInput } from './dto/upsert-service.input';

@Resolver()
export class CatalogResolver {
  constructor(private readonly catalogService: CatalogService) {}

  @Query(() => ServicePage)
  async serviceList(
    @Args('input', { nullable: true }) input?: ServiceListInput,
  ): Promise<ServicePage> {
    return this.catalogService.listServices(input);
  }

  @Query(() => ServiceDetailUnion)
  async serviceDetail(@Args('id') id: string) {
    return this.catalogService.getServiceDetail(id);
  }

  @Query(() => ServiceItem)
  async serviceItem(@Args('id') id: string): Promise<ServiceItem> {
    return this.catalogService.getServiceItem(id);
  }

  @Mutation(() => ServiceItem)
  @UseGuards(AdminGuard)
  async adminUpsertService(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: UpsertServiceInput,
  ): Promise<ServiceItem> {
    return this.catalogService.upsertService(input, buildAdminActor(user));
  }

  @Mutation(() => ServiceItem)
  @UseGuards(AdminGuard)
  async adminSetServiceStatus(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: SetServiceStatusInput,
  ): Promise<ServiceItem> {
    return this.catalogService.setServiceStatus(input, buildAdminActor(user));
  }

  @Mutation(() => Boolean)
  @UseGuards(AdminGuard)
  async adminDeleteService(
    @CurrentUser() user: Record<string, unknown> | undefined,
    @Args('input') input: DeleteServiceInput,
  ): Promise<boolean> {
    return this.catalogService.deleteService(input, buildAdminActor(user));
  }

  @Query(() => ServiceAuditPage)
  @UseGuards(AdminGuard)
  async adminServiceAuditLogs(
    @Args('input', { nullable: true }) input?: ServiceAuditListInput,
  ): Promise<ServiceAuditPage> {
    return this.catalogService.listServiceAuditLogs(input);
  }
}
