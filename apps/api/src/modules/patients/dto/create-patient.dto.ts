import { ApiPropertyOptional } from '@nestjs/swagger';
import { Sex } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreatePatientDto {
  @IsString() firstName: string;
  @IsString() lastName: string;

  @ApiPropertyOptional({ enum: Sex, nullable: true })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({
    description:
      'Âge déclaré, quand la date de naissance est inconnue : enregistre une année de naissance estimée. Exclusif avec dateOfBirth.',
    minimum: 0,
    maximum: 120,
  })
  @ValidateIf((dto: CreatePatientDto) => dto.age !== undefined && dto.age !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ description: 'Situation familiale' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  familySituation?: string;

  @ApiPropertyOptional({ description: 'Profession' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  profession?: string;

  @ApiPropertyOptional({ description: 'Médecin traitant' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  gpName?: string;

  @ApiPropertyOptional({ description: 'Adressé par' })
  @IsOptional()
  @IsString()
  referralSource?: string;

  @ApiPropertyOptional({ description: 'Motif de consultation' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  consultationReason?: string;
}
