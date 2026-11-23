import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

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
}
