import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, ShareKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
/** Optional, but when sent it may be null (cleared). */
const nullable = ValidateIf((_, value) => value !== null && value !== undefined);

export class CreateConsultationDto {
  @ApiPropertyOptional({
    description: 'Appointment this session comes from (at most one session each); it is marked as done',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({ description: "Defaults to the appointment's start, or now" })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Formula: its label and price are copied into the session' })
  @IsOptional()
  @IsUUID()
  formulaId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.NONE })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: "Practice: by default the appointment's, else the default one" })
  @IsOptional()
  @IsUUID()
  practiceId?: string;
}

export class UpdateConsultationDto {
  @ApiPropertyOptional({ nullable: true, description: 'Part de l’organisme pour cette séance en centimes (null reprend le tarif prévu)' })
  @nullable
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  payerOverrideCents?: number | null;

  @ApiPropertyOptional({ description: 'Organisme affiché lors de la saisie de la part' })
  @IsOptional()
  @IsUUID()
  expectedPayerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Formula: its label and price are copied into the session (null removes it)',
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  formulaId?: string | null;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Where it took place: its address goes on the invoice' })
  @IsOptional()
  @IsUUID()
  practiceId?: string;

  @ApiPropertyOptional({ description: 'Habitudes et évolution' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  habits?: string;

  @ApiPropertyOptional({ description: 'Travail en consultation' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  sessionWork?: string;

  @ApiPropertyOptional({ description: 'Conseils diététiques' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  advice?: string;

  @ApiPropertyOptional({ enum: ShareKind, nullable: true, description: 'Remise : en euros (AMOUNT) ou en % (PERCENT) ; null : pas de remise' })
  @nullable
  @IsEnum(ShareKind)
  discountKind?: ShareKind | null;

  @ApiPropertyOptional({ nullable: true, description: 'Remise : centimes (AMOUNT) ou pourcentage de 0 à 100 (PERCENT)' })
  @nullable
  @IsInt({ message: 'Indiquez le montant de la remise.' })
  @Min(0, { message: 'La remise ne peut pas être négative.' })
  @Max(100_000, { message: 'La remise semble trop élevée.' })
  discountValue?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Motif de la remise (« geste », « tarif solidaire »…)' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(200)
  discountReason?: string | null;
}
