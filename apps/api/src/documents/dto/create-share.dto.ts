import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateShareDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}
