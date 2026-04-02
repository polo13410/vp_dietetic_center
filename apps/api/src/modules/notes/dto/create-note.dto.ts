import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty() @IsUUID() patientId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() appointmentId?: string;
  @ApiProperty({ enum: NoteType }) @IsEnum(NoteType) type: NoteType;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiProperty() @IsString() content: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sessionObjectives?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() actionPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() followUpItems?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
}
