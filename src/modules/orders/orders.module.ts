import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OrdersScheduler } from './orders.scheduler';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrdersScheduler],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
