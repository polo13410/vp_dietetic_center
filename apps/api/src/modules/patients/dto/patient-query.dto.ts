import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PatientQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'true: archived patients only (default: current ones)' })
  @IsOptional()
  // Read the raw value: implicit conversion would turn "false" into true
  @Transform(({ obj }) => obj.archived === true || obj.archived === 'true')
  @IsBoolean()
  archived?: boolean;
}

/**
 * Listing without a search term (GET). A search term never goes in a URL, which every layer
 * logs (Cloud Run, nginx, the API): searches use POST /patients/search with the term in the body.
 */
export class PatientListQueryDto extends OmitType(PatientQueryDto, ['search'] as const) {}
