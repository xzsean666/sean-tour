import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CheckAdmin } from '../auth/auth.guard.service';
import { CatalogService } from './catalog.service';
import { ServiceDetailUnion } from './dto/service-detail.dto';
import { ServiceItem } from './dto/service-item.dto';
import { ServiceListInput } from './dto/service-list.input';
import { ServicePage } from './dto/service-page.dto';
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

  @Mutation(() => ServiceItem)
  async adminUpsertService(
    @CheckAdmin() _: boolean,
    @Args('input') input: UpsertServiceInput,
  ): Promise<ServiceItem> {
    return this.catalogService.upsertService(input);
  }
}
