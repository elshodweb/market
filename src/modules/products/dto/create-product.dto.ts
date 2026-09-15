import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'artel Muzlatkichi' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({ example: 120000, description: 'Price in sums' })
  @IsInt()
  @Min(0, { message: 'Price cannot be negative' })
  price: number;

  @ApiProperty({ example: 10, description: 'Product quantity in store' })
  @IsInt()
  @Min(0, { message: 'Stock-quantity cannot be negative' })
  stock_quantity: number;
}
