import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { digitsOnly, IsSiret } from '../../../common/validation/identifiers';

import { nullable, trimToNull } from './me.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const NAME_REQUIRED = 'Donnez un nom au cabinet.';

/** A place where she consults: its address (and its own SIRET, if any) goes on the invoices. */
export class CreatePracticeDto {
  @ApiProperty({ example: 'Cabinet d’Aix' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: NAME_REQUIRED })
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ nullable: true, description: 'Numéro et rue' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '13100' })
  @Transform(trimToNull)
  @nullable
  @Matches(/^\d{5}$/, { message: 'Le code postal compte 5 chiffres.' })
  zipCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '04 42 00 00 00' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @Matches(/^\+?[\d\s.()-]{6,20}$/, { message: 'Le numéro de téléphone n’est pas valide.' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Seulement s’il diffère de celui de l’activité' })
  @Transform((params) => trimToNull({ value: digitsOnly(params.value) }))
  @nullable
  @IsSiret()
  siret?: string | null;
}

export class UpdatePracticeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: NAME_REQUIRED })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNull)
  @nullable
  @Matches(/^\d{5}$/, { message: 'Le code postal compte 5 chiffres.' })
  zipCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @Matches(/^\+?[\d\s.()-]{6,20}$/, { message: 'Le numéro de téléphone n’est pas valide.' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform((params) => trimToNull({ value: digitsOnly(params.value) }))
  @nullable
  @IsSiret()
  siret?: string | null;

  @ApiPropertyOptional({ description: 'true : devient le cabinet par défaut (choisissez-en un autre pour changer)' })
  @IsOptional()
  @Equals(true, { message: 'Choisissez plutôt un autre cabinet par défaut.' })
  isDefault?: true;

  @ApiPropertyOptional({ description: 'true : archiver ; false : proposer à nouveau' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
