import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from 'src/database/database.module';

export interface UserEntity {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UserRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const query = `
    SELECT * 
    FROM users
    WHERE email = $1;
    `;
    const result = await this.pool.query<UserEntity>(query, [email]);
    return result.rows[0] || null;
  }

  async findById(id: number): Promise<UserEntity | null> {
    const query = `
      SELECT * 
      FROM users 
      WHERE id = $1;
    `;
    const result = await this.pool.query<UserEntity>(query, [id]);
    return result.rows[0] || null;
  }

  async create(email: string, passwordHash: string): Promise<UserEntity> {
    const query = `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await this.pool.query<UserEntity>(query, [
      email,
      passwordHash,
    ]);
    return result.rows[0];
  }
}
