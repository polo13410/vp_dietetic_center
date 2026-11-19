import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Multipart form fields sent alongside the uploaded file. */
export class UploadDocumentBodyDto {
  @ApiProperty() @IsString() @IsNotEmpty() patientId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;

  @ApiPropertyOptional({ enum: DocumentType, default: DocumentType.OTHER })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}
