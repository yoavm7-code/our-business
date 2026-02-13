import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdId } from '../common/decorators/household.decorator';
import { GreenInvoiceService } from './green-invoice.service';

@Controller('api/integrations/green-invoice')
@UseGuards(JwtAuthGuard)
export class GreenInvoiceController {
  constructor(private greenInvoiceService: GreenInvoiceService) {}

  /** Get connection status */
  @Get('status')
  getStatus(@HouseholdId() businessId: string) {
    return this.greenInvoiceService.getStatus(businessId);
  }

  /** Save API credentials and test connection */
  @Post('connect')
  async connect(
    @HouseholdId() businessId: string,
    @Body() dto: { keyId: string; secret: string; sandbox?: boolean },
  ) {
    return this.greenInvoiceService.saveCredentials(
      businessId,
      dto.keyId,
      dto.secret,
      dto.sandbox ?? false,
    );
  }

  /** Test existing connection */
  @Post('test')
  async testConnection(@HouseholdId() businessId: string) {
    return this.greenInvoiceService.testConnection(businessId);
  }

  /** Connect with username/password (Morning login credentials) */
  @Post('connect-credentials')
  async connectWithCredentials(
    @HouseholdId() businessId: string,
    @Body() dto: { email: string; password: string; sandbox?: boolean },
  ) {
    return this.greenInvoiceService.saveLoginCredentials(
      businessId,
      dto.email,
      dto.password,
      dto.sandbox ?? false,
    );
  }

  /** Disconnect (remove credentials) */
  @Delete('disconnect')
  async disconnect(@HouseholdId() businessId: string) {
    await this.greenInvoiceService.removeCredentials(businessId);
    return { success: true };
  }

  /** Sync documents from Green Invoice */
  @Post('sync')
  async syncDocuments(
    @HouseholdId() businessId: string,
    @Body() dto?: { fromDate?: string; toDate?: string },
  ) {
    return this.greenInvoiceService.syncDocuments(businessId, dto);
  }

  /** Push a local invoice to Green Invoice */
  @Post('push')
  async pushInvoice(
    @HouseholdId() businessId: string,
    @Body() dto: { invoiceId: string },
  ) {
    return this.greenInvoiceService.pushInvoice(businessId, dto.invoiceId);
  }

  /** List documents from Green Invoice (preview without importing) */
  @Get('documents')
  async listDocuments(
    @HouseholdId() businessId: string,
    @Query('page') page?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.greenInvoiceService.listDocuments(businessId, {
      page: page ? parseInt(page, 10) : 0,
      fromDate,
      toDate,
    });
  }
}
