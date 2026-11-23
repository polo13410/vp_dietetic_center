import { ApiPropertyOptional } from '@nestjs/swagger';
import { Theme } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { digitsOnly, IsAdeliRpps, IsSiret } from '../../../common/validation/identifiers';

/** Trims a text; an empty one means "no value" (null). */
export const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Optional, but when sent it may be null (cleared). */
export const nullable = ValidateIf((_, value) => value !== null && value !== undefined);

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le prénom ne peut pas être vide.' })
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide.' })
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ nullable: true, example: '06 12 34 56 78' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @Matches(/^\+?[\d\s.()-]{6,20}$/, { message: 'Le numéro de téléphone n’est pas valide.' })
  phone?: string | null;

  @ApiPropertyOptional({ enum: Theme })
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;
}

/** « Mon activité »: who she is, printed on her invoices. */
export class UpdateActivityDto {
  @ApiPropertyOptional({ nullable: true, description: 'Nom affiché sur les factures' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(200)
  practiceName?: string | null;

  @ApiPropertyOptional({ nullable: true, description: '14 chiffres, espaces acceptés' })
  @Transform((params) => trimToNull({ value: digitsOnly(params.value) }))
  @nullable
  @IsSiret()
  siret?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'ADELI (9 chiffres) ou RPPS (11 chiffres)' })
  @Transform((params) => trimToNull({ value: digitsOnly(params.value) }))
  @nullable
  @IsAdeliRpps()
  adeliRpps?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'TVA non applicable, art. 261-4-1° du CGI' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(500)
  vatMention?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Mentions libres en bas de facture' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(2000)
  invoiceFooter?: string | null;
}
