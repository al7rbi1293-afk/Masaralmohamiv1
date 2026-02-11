import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { withTenant } from '../common/tenant-scope';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateShareDto } from './dto/create-share.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async listFolders(tenantId: string) {
    return this.prisma.documentFolder.findMany({
      where: withTenant(tenantId),
      orderBy: { createdAt: 'asc' },
    });
  }

  async createFolder(user: JwtUser, dto: CreateFolderDto) {
    if (dto.parentId) {
      const parent = await this.prisma.documentFolder.findFirst({
        where: withTenant(user.tenantId, { id: dto.parentId }),
      });
      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const folder = await this.prisma.documentFolder.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        parentId: dto.parentId,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DOCUMENT_FOLDER_CREATED',
      entity: 'document_folder',
      entityId: folder.id,
    });

    return folder;
  }

  async list(user: JwtUser, query: ListDocumentsDto) {
    const skip = (query.page - 1) * query.pageSize;
    const where = withTenant(user.tenantId, {
      ...(query.search
        ? {
            title: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.matterId ? { matterId: query.matterId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.folderId ? { folderId: query.folderId } : {}),
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.pageSize,
        include: {
          versions: {
            where: withTenant(user.tenantId),
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async createDocument(user: JwtUser, dto: CreateDocumentDto) {
    await this.ensureRelationsExist(user.tenantId, dto.clientId, dto.matterId, dto.folderId);

    const document = await this.prisma.document.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title,
        matterId: dto.matterId,
        clientId: dto.clientId,
        folderId: dto.folderId,
        createdById: user.sub,
      },
    });

    const version = 1;
    const key = this.storageService.buildObjectKey(
      user.tenantId,
      document.id,
      version,
      dto.fileName,
    );

    const docVersion = await this.prisma.documentVersion.create({
      data: {
        tenantId: user.tenantId,
        documentId: document.id,
        version,
        storageKey: key,
        mimeType: dto.mimeType,
        size: dto.size,
        tags: dto.tags ?? [],
        uploadedById: user.sub,
      },
    });

    const uploadUrl = await this.storageService.getPresignedUploadUrl(key, dto.mimeType);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DOCUMENT_CREATED',
      entity: 'document',
      entityId: document.id,
      metadata: { version },
    });

    return { document, version: docVersion, uploadUrl };
  }

  async addVersion(user: JwtUser, id: string, dto: CreateVersionDto) {
    const document = await this.prisma.document.findFirst({
      where: withTenant(user.tenantId, { id }),
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const latest = await this.prisma.documentVersion.findFirst({
      where: withTenant(user.tenantId, { documentId: id }),
      orderBy: { version: 'desc' },
    });

    const version = latest ? latest.version + 1 : 1;
    const key = this.storageService.buildObjectKey(
      user.tenantId,
      document.id,
      version,
      dto.fileName,
    );

    const docVersion = await this.prisma.documentVersion.create({
      data: {
        tenantId: user.tenantId,
        documentId: id,
        version,
        storageKey: key,
        mimeType: dto.mimeType,
        size: dto.size,
        tags: dto.tags ?? [],
        uploadedById: user.sub,
      },
    });

    const uploadUrl = await this.storageService.getPresignedUploadUrl(key, dto.mimeType);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DOCUMENT_VERSION_CREATED',
      entity: 'document',
      entityId: id,
      metadata: { version },
    });

    return { version: docVersion, uploadUrl };
  }

  async get(user: JwtUser, id: string) {
    const document = await this.prisma.document.findFirst({
      where: withTenant(user.tenantId, { id }),
      include: {
        versions: {
          where: withTenant(user.tenantId),
          orderBy: { version: 'desc' },
        },
        folder: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DOCUMENT_VIEWED',
      entity: 'document',
      entityId: id,
    });

    return document;
  }

  async getDownloadUrl(user: JwtUser, id: string) {
    const version = await this.prisma.documentVersion.findFirst({
      where: withTenant(user.tenantId, { documentId: id }),
      orderBy: { version: 'desc' },
    });

    if (!version) {
      throw new NotFoundException('Document version not found');
    }

    const downloadUrl = await this.storageService.getPresignedDownloadUrl(version.storageKey);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DOCUMENT_DOWNLOAD',
      entity: 'document',
      entityId: id,
      metadata: { version: version.version },
    });

    return { downloadUrl, version: version.version };
  }

  async createShareToken(user: JwtUser, id: string, dto: CreateShareDto) {
    const document = await this.prisma.document.findFirst({
      where: withTenant(user.tenantId, { id }),
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const hours = dto.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const token = randomUUID().replace(/-/g, '');

    const share = await this.prisma.documentShareToken.create({
      data: {
        tenantId: user.tenantId,
        documentId: id,
        token,
        expiresAt,
        createdById: user.sub,
      },
    });

    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3001';

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DOCUMENT_SHARED',
      entity: 'document',
      entityId: id,
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return {
      token,
      expiresAt,
      publicUrl: `${appBaseUrl}/documents/share/${token}`,
      shareId: share.id,
    };
  }

  async publicDownload(token: string, ip?: string, userAgent?: string) {
    const now = new Date();
    const share = await this.prisma.documentShareToken.findFirst({
      where: {
        token,
        revokedAt: null,
        expiresAt: { gt: now },
        tenantId: { not: '' },
      },
      include: {
        document: true,
      },
    });

    if (!share) {
      throw new UnauthorizedException('Share token expired or invalid');
    }

    const version = await this.prisma.documentVersion.findFirst({
      where: withTenant(share.tenantId, { documentId: share.documentId }),
      orderBy: { version: 'desc' },
    });

    if (!version) {
      throw new NotFoundException('Document version not found');
    }

    const downloadUrl = await this.storageService.getPresignedDownloadUrl(version.storageKey);

    await this.auditService.log({
      tenantId: share.tenantId,
      action: 'DOCUMENT_SHARE_DOWNLOAD',
      entity: 'document',
      entityId: share.documentId,
      metadata: {
        token: share.token,
        version: version.version,
        ip,
        userAgent,
      },
      ip,
      userAgent,
    });

    return {
      downloadUrl,
      expiresAt: share.expiresAt,
      documentId: share.documentId,
    };
  }

  async revokeShare(user: JwtUser, token: string) {
    const share = await this.prisma.documentShareToken.findFirst({
      where: withTenant(user.tenantId, { token }),
    });

    if (!share) {
      throw new NotFoundException('Share token not found');
    }

    await this.prisma.documentShareToken.updateMany({
      where: withTenant(user.tenantId, { token }),
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'DOCUMENT_SHARE_REVOKED',
      entity: 'document',
      entityId: share.documentId,
      metadata: { token },
    });

    return { success: true };
  }

  private async ensureRelationsExist(
    tenantId: string,
    clientId?: string,
    matterId?: string,
    folderId?: string,
  ) {
    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: withTenant(tenantId, { id: clientId }),
      });
      if (!client) throw new NotFoundException('Client not found');
    }

    if (matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: withTenant(tenantId, { id: matterId }),
      });
      if (!matter) throw new NotFoundException('Matter not found');
    }

    if (folderId) {
      const folder = await this.prisma.documentFolder.findFirst({
        where: withTenant(tenantId, { id: folderId }),
      });
      if (!folder) throw new NotFoundException('Folder not found');
    }
  }
}
