import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, QuoteStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AuditService } from '../audit/audit.service';
import { withTenant } from '../common/tenant-scope';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listQuotes(user: JwtUser, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where = withTenant(user.tenantId);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.billingQuote.findMany({
        where,
        include: { client: true, matter: true, invoice: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.billingQuote.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async createQuote(user: JwtUser, dto: CreateQuoteDto) {
    await this.ensureClientMatter(user.tenantId, dto.clientId, dto.matterId);
    const number = dto.number ?? (await this.nextQuoteNumber(user.tenantId));

    const subtotal = Number(dto.subtotal);
    const tax = Number(dto.tax);
    const total = (subtotal + tax).toFixed(2);

    const quote = await this.prisma.billingQuote.create({
      data: {
        tenantId: user.tenantId,
        clientId: dto.clientId,
        matterId: dto.matterId,
        number,
        status: QuoteStatus.SENT,
        subtotal: dto.subtotal,
        tax: dto.tax,
        total,
        createdById: user.sub,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'QUOTE_CREATED',
      entity: 'quote',
      entityId: quote.id,
      metadata: { number: quote.number },
    });

    return quote;
  }

  async convertQuote(user: JwtUser, quoteId: string, dto: ConvertQuoteDto) {
    const quote = await this.prisma.billingQuote.findFirst({
      where: withTenant(user.tenantId, { id: quoteId }),
      include: { invoice: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.invoice) {
      return quote.invoice;
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextInvoiceNumber(user.tenantId, tx);

      await tx.billingQuote.updateMany({
        where: withTenant(user.tenantId, { id: quoteId }),
        data: { status: QuoteStatus.ACCEPTED },
      });

      return tx.invoice.create({
        data: {
          tenantId: user.tenantId,
          clientId: quote.clientId,
          matterId: quote.matterId,
          quoteId: quote.id,
          number,
          status: InvoiceStatus.UNPAID,
          issuedAt: new Date(),
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          subtotal: quote.subtotal,
          tax: quote.tax,
          total: quote.total,
          createdById: user.sub,
        },
      });
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'QUOTE_CONVERTED_TO_INVOICE',
      entity: 'invoice',
      entityId: invoice.id,
      metadata: { quoteId },
    });

    return invoice;
  }

  async listInvoices(user: JwtUser, query: ListInvoicesDto) {
    const skip = (query.page - 1) * query.pageSize;
    const where = withTenant(user.tenantId, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            number: { contains: query.search, mode: 'insensitive' as const },
          }
        : {}),
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { client: true, matter: true, quote: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async markPaid(user: JwtUser, id: string, dto: MarkPaidDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: withTenant(user.tenantId, { id }),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    await this.prisma.invoice.updateMany({
      where: withTenant(user.tenantId, { id }),
      data: {
        status: InvoiceStatus.PAID,
        paidAt,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'INVOICE_MARKED_PAID',
      entity: 'invoice',
      entityId: id,
      metadata: { paidAt: paidAt.toISOString() },
    });

    return this.prisma.invoice.findFirst({
      where: withTenant(user.tenantId, { id }),
      include: { client: true, matter: true, quote: true },
    });
  }

  async getInvoicePdf(user: JwtUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: withTenant(user.tenantId, { id }),
      include: {
        client: true,
        matter: true,
        tenant: true,
        createdBy: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const buffer = await this.renderInvoicePdf(invoice);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'INVOICE_PDF_EXPORTED',
      entity: 'invoice',
      entityId: id,
    });

    return {
      fileName: `${invoice.number}.pdf`,
      buffer,
    };
  }

  private async renderInvoicePdf(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Sijil Invoice', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Firm: ${invoice.tenant.firmName}`);
      doc.text(`Invoice Number: ${invoice.number}`);
      doc.text(`Status: ${invoice.status}`);
      doc.text(`Client: ${invoice.client.name}`);
      if (invoice.matter) {
        doc.text(`Matter: ${invoice.matter.title}`);
      }
      doc.text(`Issued At: ${new Date(invoice.issuedAt).toISOString().slice(0, 10)}`);
      if (invoice.dueAt) {
        doc.text(`Due At: ${new Date(invoice.dueAt).toISOString().slice(0, 10)}`);
      }
      if (invoice.paidAt) {
        doc.text(`Paid At: ${new Date(invoice.paidAt).toISOString().slice(0, 10)}`);
      }

      doc.moveDown();
      doc.text(`Subtotal: ${invoice.subtotal.toString()} SAR`);
      doc.text(`Tax: ${invoice.tax.toString()} SAR`);
      doc.text(`Total: ${invoice.total.toString()} SAR`);

      doc.moveDown();
      doc.text(`Generated by: ${invoice.createdBy.name} (${invoice.createdBy.email})`);

      doc.end();
    });
  }

  private async ensureClientMatter(
    tenantId: string,
    clientId: string,
    matterId?: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: withTenant(tenantId, { id: clientId }),
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: withTenant(tenantId, { id: matterId }),
      });

      if (!matter) {
        throw new NotFoundException('Matter not found');
      }
    }
  }

  private async nextQuoteNumber(tenantId: string) {
    const latest = await this.prisma.billingQuote.findFirst({
      where: withTenant(tenantId),
      orderBy: { createdAt: 'desc' },
    });

    const last = latest?.number ?? 'Q-0000';
    const numeric = Number(last.split('-').pop() ?? '0') + 1;
    return `Q-${numeric.toString().padStart(4, '0')}`;
  }

  private async nextInvoiceNumber(tenantId: string, prisma: PrismaService | any = this.prisma) {
    const latest = await prisma.invoice.findFirst({
      where: withTenant(tenantId),
      orderBy: { createdAt: 'desc' },
    });

    const last = latest?.number ?? 'INV-0000';
    const numeric = Number(last.split('-').pop() ?? '0') + 1;
    return `INV-${numeric.toString().padStart(4, '0')}`;
  }
}
