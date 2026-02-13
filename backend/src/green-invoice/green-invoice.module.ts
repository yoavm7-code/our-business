import { Module } from '@nestjs/common';
import { GreenInvoiceService } from './green-invoice.service';
import { GreenInvoiceController } from './green-invoice.controller';

@Module({
  providers: [GreenInvoiceService],
  controllers: [GreenInvoiceController],
  exports: [GreenInvoiceService],
})
export class GreenInvoiceModule {}
