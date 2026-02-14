import { IsString, IsNumber, IsBoolean, IsOptional, IsIn } from 'class-validator';

export class CreateAlertRuleDto {
  @IsString()
  name: string;

  @IsIn(['budget_usage', 'cash_flow', 'monthly_income', 'monthly_expenses', 'account_balance', 'unpaid_invoices', 'overdue_invoices'])
  metric: string;

  @IsIn(['gt', 'lt', 'gte', 'lte'])
  operator: string;

  @IsNumber()
  threshold: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotify?: boolean;

  @IsOptional()
  @IsNumber()
  cooldownHours?: number;
}

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['budget_usage', 'cash_flow', 'monthly_income', 'monthly_expenses', 'account_balance', 'unpaid_invoices', 'overdue_invoices'])
  metric?: string;

  @IsOptional()
  @IsIn(['gt', 'lt', 'gte', 'lte'])
  operator?: string;

  @IsOptional()
  @IsNumber()
  threshold?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotify?: boolean;

  @IsOptional()
  @IsNumber()
  cooldownHours?: number;
}
