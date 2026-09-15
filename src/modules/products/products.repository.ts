import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from 'src/database/database.module';

export interface ProductEntity {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ProductsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(
    name: string,
    price: number,
    stockQuantity: number,
  ): Promise<ProductEntity> {
    const query = `
      INSERT INTO products (name, price, stock_quantity)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await this.pool.query<ProductEntity>(query, [
      name,
      price,
      stockQuantity,
    ]);
    return result.rows[0];
  }

  async findById(id: number): Promise<ProductEntity | null> {
    const query = `
      SELECT *
      FROM products
      WHERE id = $1;
    `;
    const result = await this.pool.query<ProductEntity>(query, [id]);
    return result.rows[0] || null;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ items: ProductEntity[]; total: number }> {
    const offset = (page - 1) * limit;

    const itemsQuery = `
      SELECT *
      FROM products
      ORDER BY id ASC
      LIMIT $1 OFFSET $2;
    `;

    const countQuery = `SELECT COUNT(*) FROM products;`;

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<ProductEntity>(itemsQuery, [limit, offset]),
      this.pool.query<{ count: string }>(countQuery),
    ]);

    return {
      items: itemsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
