import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types/jwt-user.type';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';

@ApiTags('Tenant Settings')
@ApiBearerAuth()
@Controller('settings/tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantSettingsController {
  constructor(private readonly settingsService: TenantSettingsService) {}

  @Get()
  get(@CurrentUser() user: JwtUser) {
    return this.settingsService.get(user.tenantId);
  }

  @Patch()
  @Roles(Role.PARTNER)
  update(@CurrentUser() user: JwtUser, @Body() dto: UpdateTenantSettingsDto) {
    return this.settingsService.update(user.tenantId, user, dto);
  }
}
