import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ProductEntity, ProductsRepository } from './products.repository';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import Redis from 'ioredis';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  private readonly CACHE_TTL = 600; // in seconds

  constructor(
    private readonly productsRepository: ProductsRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const product = await this.productsRepository.create(
      dto.name,
      dto.price,
      dto.stock_quantity,
    );

    const keys = await this.redis.keys('products:page:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    return product;
  }

  async findById(id: number): Promise<ProductEntity> {
    const cacheKey = `product:${id}`;

    const cachedProduct = await this.redis.get(cacheKey);
    if (cachedProduct) {
      return JSON.parse(cachedProduct);
    }

    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product not found`);
    }

    await this.redis.set(
      cacheKey,
      JSON.stringify(product),
      'EX',
      this.CACHE_TTL,
    );

    return product;
  }

  async findAll(page: number = 1, limit: number = 10) {
    const cacheKey = `products:page:${page}:limit:${limit}`;
    const cachedList = await this.redis.get(cacheKey);
    if (cachedList) {
      return JSON.parse(cachedList);
    }
    const { items, total } = await this.productsRepository.findAll(page, limit);

    const response = {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(response),
      'EX',
      this.CACHE_TTL,
    );
    
    return response;
  }
}
