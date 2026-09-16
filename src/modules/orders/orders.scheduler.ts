import { Injectable, Logger } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredOrders() {
    this.logger.log('Checking for expired pending orders | after 15 minutes');

    const expiredOrders =
      await this.ordersRepository.findExpiredPendingOrders();

    if (expiredOrders.length === 0) {
      return;
    }

    this.logger.log(`Found ${expiredOrders.length} expired orders.`);
    for (const orderId of expiredOrders) {
      try {
        await this.ordersService.cancelOrder(orderId);
        this.logger.log(
          `Expired Order (${orderId}) was cancelled.`,
        );
      } catch (error) {
        this.logger.error(`Failed to cancel expired order (${orderId})`, error);
      }
    }
  }
}
