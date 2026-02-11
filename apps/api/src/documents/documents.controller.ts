import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types/jwt-user.type';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateShareDto } from './dto/create-share.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('folders')
  listFolders(@CurrentUser() user: JwtUser) {
    return this.documentsService.listFolders(user.tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('folders')
  createFolder(@CurrentUser() user: JwtUser, @Body() dto: CreateFolderDto) {
    return this.documentsService.createFolder(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: ListDocumentsDto) {
    return this.documentsService.list(user, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDocumentDto) {
    return this.documentsService.createDocument(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documentsService.get(user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/versions')
  addVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.documentsService.addVersion(user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/download-url')
  getDownloadUrl(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documentsService.getDownloadUrl(user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/share')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  share(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.documentsService.createShareToken(user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('share/:token/revoke')
  revokeShare(@CurrentUser() user: JwtUser, @Param('token') token: string) {
    return this.documentsService.revokeShare(user, token);
  }

  @Public()
  @Get('share/:token')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  publicShare(@Param('token') token: string, @Req() req: Request) {
    return this.documentsService.publicDownload(
      token,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
