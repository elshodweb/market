import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: async () => {
        const pool = new Pool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
        });

        const client = await pool.connect();
        client.release();
        console.log('PostgreSQL connected successfully');

        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
