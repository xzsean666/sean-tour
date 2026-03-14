import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogResolver } from './catalog.resolver';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule],
  providers: [CatalogResolver, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
