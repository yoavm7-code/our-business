import { Module } from '@nestjs/common';
import { ZReportService } from './z-report.service';
import { ZReportController } from './z-report.controller';

@Module({
  providers: [ZReportService],
  controllers: [ZReportController],
  exports: [ZReportService],
})
export class ZReportModule {}
