import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupportResolver } from './support.resolver';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule],
  providers: [SupportResolver, SupportService],
  exports: [SupportService],
})
export class SupportModule {}
