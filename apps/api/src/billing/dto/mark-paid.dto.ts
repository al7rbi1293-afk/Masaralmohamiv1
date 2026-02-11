import { IsDateString, IsOptional } from 'class-validator';

export class MarkPaidDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
