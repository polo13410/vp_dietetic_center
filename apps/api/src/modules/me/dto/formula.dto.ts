import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Up to 10 000 €: anything above is a typing mistake. */
const MAX_PRICE_CENTS = 1_000_000;

export class CreateFormulaDto {
  @ApiProperty({ example: 'Bilan' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Donnez un nom à la formule.' })
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional({ nullable: true, example: 6000, description: 'Prix en centimes (vide : à compléter)' })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'Le prix n’est pas valide.' })
  @Min(0, { message: 'Le prix ne peut pas être négatif.' })
  @Max(MAX_PRICE_CENTS, { message: 'Le prix ne peut pas dépasser 10 000 €.' })
  priceCents?: number | null;
}

export class UpdateFormulaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Donnez un nom à la formule.' })
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Prix en centimes (null : à compléter)' })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'Le prix n’est pas valide.' })
  @Min(0, { message: 'Le prix ne peut pas être négatif.' })
  @Max(MAX_PRICE_CENTS, { message: 'Le prix ne peut pas dépasser 10 000 €.' })
  priceCents?: number | null;

  @ApiPropertyOptional({ description: 'false : proposer à nouveau une formule retirée' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ReorderFormulasDto {
  @ApiProperty({ type: [String], description: 'Les formules proposées, dans le nouvel ordre' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}
