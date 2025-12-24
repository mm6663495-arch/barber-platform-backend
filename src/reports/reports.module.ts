import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { UnifiedReportsService } from './services/unified-reports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [UnifiedReportsService, JwtAuthGuard],
  exports: [UnifiedReportsService],
})
export class ReportsModule {}

