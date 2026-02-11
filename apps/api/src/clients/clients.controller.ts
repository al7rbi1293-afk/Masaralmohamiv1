import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types/jwt-user.type';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: ListClientsDto) {
    return this.clientsService.list(user.tenantId, query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.tenantId, user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clientsService.get(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.tenantId, user, id, dto);
  }

  @Patch(':id/archive')
  archive(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clientsService.archive(user.tenantId, user, id, true);
  }

  @Patch(':id/unarchive')
  unarchive(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clientsService.archive(user.tenantId, user, id, false);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.clientsService.remove(user.tenantId, user, id);
  }
}
