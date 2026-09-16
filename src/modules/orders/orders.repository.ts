import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from 'src/database/database.module';
import { OrderItemDto } from './dto/create-order.dto';

export interface OrderEntity {
  id: number;
  user_id: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  total_price: number;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class OrdersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByIdempotencyKey(key: string): Promise<OrderEntity | null> {
    const query = `SELECT * FROM orders WHERE idempotency_key = $1;`;
    const result = await this.pool.query<OrderEntity>(query, [key]);
    return result.rows[0] || null;
  }

  async findByIdWithItems(orderId: number) {
    const orderQuery = `SELECT * FROM orders WHERE id = $1;`;
    const orderResult = await this.pool.query<OrderEntity>(orderQuery, [
      orderId,
    ]);
    const order = orderResult.rows[0];
    if (!order) return null;
    const itemsQuery = `
      SELECT oi.id, oi.product_id, p.name as product_name, oi.product_quantity, oi.unit_price
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1;
    `;
    const itemsResult = await this.pool.query(itemsQuery, [orderId]);
    return {
      ...order,
      items: itemsResult.rows,
    };
  }

  async createOrderWithStockReservation(
    userId: number,
    idempotencyKey: string,
    items: OrderItemDto[],
  ): Promise<OrderEntity> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const sortedItems = [...items].sort(
        (a, b) => a.product_id - b.product_id,
      );
      let totalPrice = 0;
      const verifiedItems: {
        productId: number;
        quantity: number;
        unitPrice: number;
      }[] = [];

      for (const item of sortedItems) {
        const productQuery = `
          SELECT * 
          FROM products 
          WHERE id = $1 
          FOR UPDATE;
        `;

        const productResult = await client.query(productQuery, [
          item.product_id,
        ]);
        const product = productResult.rows[0];
        if (!product) {
          throw new NotFoundException(
            `Product with id ${item.product_id} not found`,
          );
        }

        if (product.stock_quantity < item.quantity) {
          throw new ConflictException(
            `The quantity of the product "${product.name}" is small. Available: ${product.stock_quantity}, requested: ${item.quantity}`,
          );
        }

        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2;`,
          [item.quantity, item.product_id],
        );
        const itemTotal = product.price * item.quantity;
        totalPrice += itemTotal;
        verifiedItems.push({
          productId: item.product_id,
          quantity: item.quantity,
          unitPrice: product.price,
        });
      }

      const orderInsertQuery = `
        INSERT INTO orders (user_id, status, total_price, idempotency_key)
        VALUES ($1, 'pending', $2, $3)
        RETURNING *;
      `;

      const orderResult = await client.query<OrderEntity>(orderInsertQuery, [
        userId,
        totalPrice,
        idempotencyKey,
      ]);

      const createdOrder = orderResult.rows[0];

      for (const vItem of verifiedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_quantity, unit_price)
           VALUES ($1, $2, $3, $4);`,
          [createdOrder.id, vItem.productId, vItem.quantity, vItem.unitPrice],
        );
      }
      await client.query('COMMIT');
      return createdOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelOrderAndRestoreStock(orderId: number): Promise<OrderEntity> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query<OrderEntity>(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE;`,
        [orderId],
      );
      const order = orderResult.rows[0];
      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }
      if (order.status === 'cancelled') {
        throw new BadRequestException('Order is already cancelled');
      }
      if (order.status === 'confirmed') {
        throw new BadRequestException('Cannot cancel a confirmed order');
      }

      const itemsResult = await client.query(
        `SELECT product_id, product_quantity FROM order_items WHERE order_id = $1;`,
        [orderId],
      );

      for (const item of itemsResult.rows) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2;`,
          [item.product_quantity, item.product_id],
        );
      }

      const updatedOrderResult = await client.query<OrderEntity>(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *;`,
        [orderId],
      );

      await client.query('COMMIT');
      return updatedOrderResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserId(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ items: OrderEntity[]; total: number }> {
    const offset = (page - 1) * limit;
    const itemsQuery = `
      SELECT o.id,
        o.user_id,
        o.status,
        o.total_price,
        o.idempotency_key,
        o.created_at,
        o.updated_at,
       COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
             'product_name', p.name ,
             'product_price', p.price,
              'product_quantity', oi.product_quantity,
              'total_price', oi.unit_price * oi.product_quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi
      ON oi.order_id = o.id
      LEFT JOIN products p
      ON oi.product_id = p.id
      WHERE user_id = $1
      GROUP BY o.id
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const countQuery = `SELECT COUNT(*) FROM orders WHERE user_id = $1;`;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<OrderEntity>(itemsQuery, [userId, limit, offset]),
      this.pool.query<{ count: string }>(countQuery, [userId]),
    ]);
    return {
      items: itemsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
