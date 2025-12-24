import { Module } from '@nestjs/common';
import { AdvancedReportsService } from './advanced-reports.service';
import { AdvancedReportsController } from './advanced-reports.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdvancedReportsController],
  providers: [AdvancedReportsService],
  exports: [AdvancedReportsService],
})
export class AdvancedReportsModule {}

