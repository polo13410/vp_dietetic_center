import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** A period of issue dates, as Paris days, both included. */
export class InvoicePeriodQueryDto {
  @ApiProperty({ example: '2026-11-01' })
  @Matches(DAY, { message: 'from doit être une date AAAA-MM-JJ' })
  from!: string;

  @ApiProperty({ example: '2026-11-30' })
  @Matches(DAY, { message: 'to doit être une date AAAA-MM-JJ' })
  to!: string;
}

export class CancelInvoiceDto {
  @ApiPropertyOptional({ description: 'Motif, facultatif (« séance offerte »)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
