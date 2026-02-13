import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdId } from '../common/decorators/household.decorator';
import { ExpensesService } from './expenses.service';

@Controller('api/expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Get()
  findAll(
    @HouseholdId() businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.expensesService.findAll(businessId, {
      from,
      to,
      categoryId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('summary')
  getSummary(
    @HouseholdId() businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expensesService.getSummary(businessId, from, to);
  }

  @Get(':id')
  findOne(@HouseholdId() businessId: string, @Param('id') id: string) {
    return this.expensesService.findOne(businessId, id);
  }

  @Post()
  create(
    @HouseholdId() businessId: string,
    @Body()
    dto: {
      accountId: string;
      categoryId?: string;
      date: string;
      description: string;
      amount: number;
      currency?: string;
      vendor?: string;
      vatAmount?: number;
      isRecurring?: boolean;
      isTaxDeductible?: boolean;
      deductionRate?: number;
      notes?: string;
      customFields?: Record<string, unknown>;
    },
  ) {
    return this.expensesService.create(businessId, dto);
  }

  @Put(':id')
  update(
    @HouseholdId() businessId: string,
    @Param('id') id: string,
    @Body()
    dto: {
      accountId?: string;
      categoryId?: string | null;
      date?: string;
      description?: string;
      amount?: number;
      vendor?: string;
      vatAmount?: number;
      isRecurring?: boolean;
      isTaxDeductible?: boolean;
      deductionRate?: number;
      notes?: string;
      customFields?: Record<string, unknown>;
    },
  ) {
    return this.expensesService.update(businessId, id, dto);
  }

  @Delete(':id')
  remove(@HouseholdId() businessId: string, @Param('id') id: string) {
    return this.expensesService.remove(businessId, id);
  }
}
