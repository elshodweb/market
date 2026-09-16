import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import Redis from 'ioredis';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createOrder(
    userId: number,
    idempotencyKey: string,
    dto: CreateOrderDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const existingOrder =
      await this.ordersRepository.findByIdempotencyKey(idempotencyKey);
    if (existingOrder) {
      return {
        message: 'Order already processed',
        ...existingOrder,
      };
    }
    const lockKey = `lock:idempotency:${idempotencyKey}`;
    const acquired = await this.redis.set(lockKey, 'locked', 'PX', 10000, 'NX');
    if (!acquired) {
      throw new ConflictException('An order is in process');
    }
    try {
      const order = await this.ordersRepository.createOrderWithStockReservation(
        userId,
        idempotencyKey,
        dto.items,
      );

      for (const item of dto.items) {
        await this.redis.del(`product:${item.product_id}`);
      }

      const pageKeys = await this.redis.keys('products:page:*');

      if (pageKeys.length > 0) {
        await this.redis.del(...pageKeys);
      }
      return order;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async findById(orderId: number, userId: number) {
    const order = await this.ordersRepository.findByIdWithItems(
      orderId,
      userId,
    );
    if (!order) {
      throw new NotFoundException(`Order not found`);
    }
    return order;
  }

  async cancelOrder(orderId: number, userId?: number) {
    const cancelledOrder =
      await this.ordersRepository.cancelOrderAndRestoreStock(orderId, userId);

    const pageKeys = await this.redis.keys('products:page:*');
    if (pageKeys.length > 0) {
      await this.redis.del(...pageKeys);
    }
    return {
      message: 'Order cancelled successfully',
      order: cancelledOrder,
    };
  }

  async findMyOrders(userId: number, page: number = 1, limit: number = 10) {
    const { items, total } = await this.ordersRepository.findByUserId(
      userId,
      page,
      limit,
    );

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
