import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MattersController } from './matters.controller';
import { MattersService } from './matters.service';

@Module({
  imports: [AuditModule],
  controllers: [MattersController],
  providers: [MattersService],
  exports: [MattersService],
})
export class MattersModule {}
