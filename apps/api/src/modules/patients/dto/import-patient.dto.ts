import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, Sex } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const TEXT = 20_000;

/** One past session of the « Suivi » table, possibly corrected in the preview. */
export class ImportSessionDto {
  @IsString() @MaxLength(100) label: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsDateString({ strict: true })
  date: string;

  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) priceCents: number | null;

  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(400) weightKg: number | null;

  @IsOptional() @IsString() @MaxLength(TEXT) habits: string | null;
  @IsOptional() @IsString() @MaxLength(TEXT) sessionWork: string | null;
  @IsOptional() @IsString() @MaxLength(TEXT) advice: string | null;
  @IsOptional() @IsString() @MaxLength(TEXT) aversions: string | null;
  @IsOptional() @IsString() @MaxLength(TEXT) tastes: string | null;
}

/** The sections of the medical file found in « Dossier médical ». */
export class ImportFileDto {
  @IsOptional() @IsString() @MaxLength(TEXT) HEALTH?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) FAMILY_HISTORY?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) PSYCHOLOGY?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) PHYSICAL_ACTIVITY?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) WEIGHT_HISTORY?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) ALLERGIES?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) BLOOD_GLUCOSE?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) CHOLESTEROL_TRIGLYCERIDES?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) AVERSIONS?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) TASTES?: string;
}

/** The draft of the preview, as she checked it, to save. */
export class ImportPatientDto {
  @IsString() @IsNotEmpty({ message: 'Le prénom est obligatoire' }) @MaxLength(100) firstName: string;
  @IsString() @IsNotEmpty({ message: 'Le nom est obligatoire' }) @MaxLength(100) lastName: string;

  @ApiPropertyOptional({ enum: Sex, nullable: true })
  @IsOptional()
  @IsEnum(Sex)
  sex: Sex | null;

  @ApiPropertyOptional({ description: 'Age on `ageOn`: an estimated birth year is saved' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  age: number | null;

  @IsOptional() @IsDateString({ strict: true }) ageOn: string | null;

  // Not checked as an e-mail: her files hold what she typed, she corrects it in the profile
  @IsOptional() @IsString() @MaxLength(200) email: string | null;
  @IsOptional() @IsString() @MaxLength(50) phone: string | null;
  @IsOptional() @IsString() @MaxLength(500) address: string | null;
  @IsOptional() @IsString() @MaxLength(100) city: string | null;
  @IsOptional() @IsString() @MaxLength(20) zipCode: string | null;
  @IsOptional() @IsString() @MaxLength(2000) familySituation: string | null;
  @IsOptional() @IsString() @MaxLength(200) profession: string | null;
  @IsOptional() @IsString() @MaxLength(200) gpName: string | null;
  @IsOptional() @IsString() @MaxLength(5000) consultationReason: string | null;
  @IsOptional() @IsString() @MaxLength(200) referralSource: string | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(30) @Max(250) heightCm: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(400) weightKg: number | null;

  @ValidateNested() @Type(() => ImportFileDto) file: ImportFileDto;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportSessionDto)
  sessions: ImportSessionDto[];

  @ApiPropertyOptional({ description: 'Import even if she already has a patient with this name' })
  @IsOptional()
  @IsBoolean()
  allowDuplicate?: boolean;
}
