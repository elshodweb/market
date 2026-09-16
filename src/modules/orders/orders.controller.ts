import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationDto } from '../products/dto/pagination.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order' })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description: 'Unique idempotency key',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiResponse({ status: 201, description: 'Order created' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicated request',
  })
  async createOrder(
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateOrderDto,
  ) {
    const userId = req.user.id;
    return this.ordersService.createOrder(userId, idempotencyKey, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all my orders' })
  @ApiResponse({ status: 200, description: 'List of user orders' })
  async findMyOrders(@Req() req: any, @Query() paginationDto: PaginationDto) {
    const userId = req.user.id;
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.limit ?? 10;
    return this.ordersService.findMyOrders(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order details',
  })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.cancelOrder(id);
  }
}
