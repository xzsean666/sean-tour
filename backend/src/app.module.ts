import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { config } from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GlobalModule } from './common/global.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { OrderModule } from './order/order.module';
import { AssistantModule } from './assistant/assistant.module';
import { NotificationModule } from './notification/notification.module';
import { SupportModule } from './support/support.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: config.graphql.PLAYGROUND_ENABLED,
      introspection: config.graphql.INTROSPECTION_ENABLED,
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
    }),
    GlobalModule,
    AuthModule,
    CatalogModule,
    BookingModule,
    NotificationModule,
    PaymentModule,
    OrderModule,
    AssistantModule,
    SupportModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
