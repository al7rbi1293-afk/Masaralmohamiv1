import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateVersionDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  size!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
