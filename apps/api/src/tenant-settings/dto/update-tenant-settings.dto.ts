import { Language } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  firmName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsBoolean()
  hijriDisplay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(36500)
  retentionDays?: number;
}
