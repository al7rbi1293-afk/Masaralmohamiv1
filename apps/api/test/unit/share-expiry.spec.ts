import { UnauthorizedException } from '@nestjs/common';
import { DocumentsService } from '../../src/documents/documents.service';

describe('Document share expiry', () => {
  it('rejects expired or invalid share tokens', async () => {
    const prisma = {
      documentShareToken: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const storage = {
      getPresignedDownloadUrl: jest.fn(),
    } as any;

    const audit = {
      log: jest.fn(),
    } as any;

    const service = new DocumentsService(prisma, storage, audit);

    await expect(service.publicDownload('expired-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled();
  });
});
