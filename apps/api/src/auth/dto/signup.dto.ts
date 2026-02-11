import { Language } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(2)
  firmName!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsBoolean()
  hijriDisplay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(365)
  @Max(36500)
  retentionDays?: number;
}

