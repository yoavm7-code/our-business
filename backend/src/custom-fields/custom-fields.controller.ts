import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdId } from '../common/decorators/household.decorator';
import { CustomFieldsService } from './custom-fields.service';

@Controller('api/custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldsController {
  constructor(private customFieldsService: CustomFieldsService) {}

  @Get('templates')
  getTemplates(
    @HouseholdId() businessId: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.customFieldsService.getTemplates(businessId, entityType);
  }

  @Post('templates')
  saveTemplate(
    @HouseholdId() businessId: string,
    @Body()
    dto: {
      name: string;
      entityType: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        options?: string[];
      }>;
    },
  ) {
    return this.customFieldsService.saveTemplate(businessId, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(
    @HouseholdId() businessId: string,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.deleteTemplate(businessId, id);
  }

  @Post('templates/:id/set-default')
  setDefault(
    @HouseholdId() businessId: string,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.setDefault(businessId, id);
  }
}
