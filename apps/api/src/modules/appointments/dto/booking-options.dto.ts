import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class BookingOptionsQueryDto {
  @ApiPropertyOptional({ description: "The patient: the options of their practitioner (by default the user's own)" })
  @IsOptional()
  @IsUUID()
  patientId?: string;
}
