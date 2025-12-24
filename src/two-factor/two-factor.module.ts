import { Module } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorGuard } from './guards/two-factor.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TwoFactorController],
  providers: [TwoFactorService, TwoFactorGuard],
  exports: [TwoFactorService, TwoFactorGuard],
})
export class TwoFactorModule {}

