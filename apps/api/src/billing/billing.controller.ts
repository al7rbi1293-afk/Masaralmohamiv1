import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types/jwt-user.type';
import { BillingService } from './billing.service';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('quotes')
  listQuotes(@CurrentUser() user: JwtUser, @Query() query: PaginationDto) {
    return this.billingService.listQuotes(user, query.page, query.pageSize);
  }

  @Post('quotes')
  createQuote(@CurrentUser() user: JwtUser, @Body() dto: CreateQuoteDto) {
    return this.billingService.createQuote(user, dto);
  }

  @Post('quotes/:id/convert')
  convertQuote(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConvertQuoteDto,
  ) {
    return this.billingService.convertQuote(user, id, dto);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: JwtUser, @Query() query: ListInvoicesDto) {
    return this.billingService.listInvoices(user, query);
  }

  @Patch('invoices/:id/pay')
  markPaid(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.billingService.markPaid(user, id, dto);
  }

  @Get('invoices/:id/pdf')
  async exportPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.billingService.getInvoicePdf(user, id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.fileName}"`,
    );
    res.send(pdf.buffer);
  }
}
