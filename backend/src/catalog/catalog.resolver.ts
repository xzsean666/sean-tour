import { Args, Query, Resolver } from '@nestjs/graphql';
import { CatalogService } from './catalog.service';
import { ServiceDetailUnion } from './dto/service-detail.dto';
import { ServiceListInput } from './dto/service-list.input';
import { ServicePage } from './dto/service-page.dto';

@Resolver()
export class CatalogResolver {
  constructor(private readonly catalogService: CatalogService) {}

  @Query(() => ServicePage)
  serviceList(
    @Args('input', { nullable: true }) input?: ServiceListInput,
  ): ServicePage {
    return this.catalogService.listServices(input);
  }

  @Query(() => ServiceDetailUnion)
  serviceDetail(@Args('id') id: string) {
    return this.catalogService.getServiceDetail(id);
  }
}
