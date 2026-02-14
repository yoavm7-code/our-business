import { IsString, IsNumber, IsBoolean, IsOptional, IsIn, Min, Max } from 'class-validator';

export class CreateReportScheduleDto {
  @IsIn(['pnl', 'cashflow', 'clients', 'categories', 'tax'])
  reportType: string;

  @IsIn(['weekly', 'monthly'])
  frequency: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  hour?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateReportScheduleDto {
  @IsOptional()
  @IsIn(['pnl', 'cashflow', 'clients', 'categories', 'tax'])
  reportType?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  frequency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  hour?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
