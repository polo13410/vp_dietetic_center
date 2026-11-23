import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BillingRhythm, ShareKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { nullable, trimToNull } from '../../me/dto/me.dto';

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAY_MESSAGE = 'La date doit être au format AAAA-MM-JJ.';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** An organisation that pays all or part of some sessions (« Organismes », lot 16). */
export class CreatePayerDto {
  @ApiProperty({ example: 'Mutuelle Horizon Santé' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Donnez un nom à l’organisme.' })
  @MaxLength(120)
  name!: string;

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

  @ApiPropertyOptional({ nullable: true, description: 'Une personne, un e-mail, un téléphone' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(300)
  contact?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Référence de la convention' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(100)
  conventionReference?: string | null;

  @ApiPropertyOptional({ enum: BillingRhythm, default: BillingRhythm.MONTHLY })
  @IsOptional()
  @IsEnum(BillingRhythm)
  billingRhythm?: BillingRhythm;

  @ApiPropertyOptional({ nullable: true, minimum: 2, maximum: 12, description: 'Tous les N mois : N' })
  @nullable
  @IsInt({ message: 'Indiquez un nombre de mois.' })
  @Min(2, { message: 'Tous les 2 mois au moins (sinon, choisissez « tous les mois »).' })
  @Max(12, { message: 'Tous les 12 mois au plus.' })
  rhythmMonths?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdatePayerDto extends PartialType(CreatePayerDto) {
  @ApiPropertyOptional({ description: 'true : archiver ; false : proposer à nouveau' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

/** What a payer covers for a patient, per session. */
export class CreateCoverageDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Choisissez un organisme.' })
  payerId!: string;

  @ApiProperty({ enum: ShareKind, description: 'AMOUNT : un montant par séance ; PERCENT : un % du net' })
  @IsEnum(ShareKind)
  kind!: ShareKind;

  @ApiProperty({ description: 'Centimes (AMOUNT) ou pourcentage de 1 à 100 (PERCENT)', example: 3000 })
  @IsInt({ message: 'Indiquez la part prise en charge.' })
  @Min(1, { message: 'La part prise en charge doit être supérieure à 0.' })
  @Max(100_000, { message: 'La part prise en charge semble trop élevée.' })
  value!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Nombre de séances couvertes au plus' })
  @nullable
  @IsInt({ message: 'Indiquez un nombre de séances.' })
  @Min(1, { message: 'Au moins une séance.' })
  @Max(999)
  maxSessions?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-11-01' })
  @Transform(trimToNull)
  @nullable
  @Matches(DAY, { message: DAY_MESSAGE })
  startDate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2027-10-31' })
  @Transform(trimToNull)
  @nullable
  @Matches(DAY, { message: DAY_MESSAGE })
  endDate?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Numéro de prise en charge' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(100)
  coverageNumber?: string | null;
}

export class UpdateCoverageDto extends PartialType(CreateCoverageDto) {}

/** The period of a payer invoice: Paris days, both included. */
export class PayerPeriodDto {
  @ApiProperty({ example: '2026-11-01' })
  @Matches(DAY, { message: DAY_MESSAGE })
  from!: string;

  @ApiProperty({ example: '2026-11-30' })
  @Matches(DAY, { message: DAY_MESSAGE })
  to!: string;
}

/** « Réglée le … »; null puts the invoice back « en attente ». */
export class PayerInvoicePaidDto {
  @ApiProperty({ nullable: true, example: '2026-12-15' })
  @nullable
  @Matches(DAY, { message: DAY_MESSAGE })
  paidOn!: string | null;
}
