import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<string>('MINIO_PORT', '9000');
    const useSsl = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const protocol = useSsl ? 'https' : 'http';

    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'sijil-documents');

    this.client = new S3Client({
      endpoint: `${protocol}://${endpoint}:${port}`,
      forcePathStyle: true,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      },
    });
  }

  buildObjectKey(
    tenantId: string,
    documentId: string,
    version: number,
    fileName: string,
  ) {
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `tenants/${tenantId}/documents/${documentId}/v${version}-${Date.now()}-${sanitized}`;
  }

  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds = 900,
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getPresignedDownloadUrl(key: string, expiresInSeconds = 300) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
