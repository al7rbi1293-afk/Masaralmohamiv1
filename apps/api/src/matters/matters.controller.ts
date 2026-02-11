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
import { CreateMatterDto } from './dto/create-matter.dto';
import { ListMattersDto } from './dto/list-matters.dto';
import { UpdateMembersDto } from './dto/update-members.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';
import { MattersService } from './matters.service';

@ApiTags('Matters')
@ApiBearerAuth()
@Controller('matters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MattersController {
  constructor(private readonly mattersService: MattersService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: ListMattersDto) {
    return this.mattersService.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateMatterDto) {
    return this.mattersService.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.mattersService.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMatterDto,
  ) {
    return this.mattersService.update(user, id, dto);
  }

  @Patch(':id/members')
  updateMembers(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMembersDto,
  ) {
    return this.mattersService.updateMembers(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.mattersService.remove(user, id);
  }
}
