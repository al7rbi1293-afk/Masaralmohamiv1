import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateQuoteDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  matterId?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsNumberString()
  subtotal!: string;

  @IsNumberString()
  tax!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
