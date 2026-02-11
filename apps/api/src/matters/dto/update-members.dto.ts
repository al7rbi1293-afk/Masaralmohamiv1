import { IsArray, IsUUID } from 'class-validator';

export class UpdateMembersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
