import { IsDateString, IsOptional } from 'class-validator';

export class ConvertQuoteDto {
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
