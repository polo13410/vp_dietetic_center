import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, User, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { ImportPatientDto } from './dto/import-patient.dto';
import { PatientImportService } from './patient-import.service';

/** Her files are Numbers ones; an Excel export of the same file reads the same. */
const EXTENSIONS = /\.(numbers|xlsx)$/i;
/** Both are zip archives */
const isZip = (buffer: Buffer) => buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;

@ApiTags('patients')
@ApiBearerAuth()
// Creates patients: the practitioner only
@Roles(UserRole.PRATICIENNE)
@Controller({ path: 'patients/import', version: '1' })
export class PatientImportController {
  constructor(private readonly service: PatientImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, accept) =>
        EXTENSIONS.test(file.originalname)
          ? accept(null, true)
          : accept(new BadRequestException('Choisissez un fichier Numbers (.numbers) ou Excel (.xlsx)'), false),
    }),
  )
  @ApiOperation({ summary: 'Lire un dossier patient Numbers, sans rien enregistrer' })
  preview(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: User) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    // A Numbers « package » folder (not compressed) arrives empty or as something else
    if (!isZip(file.buffer)) {
      throw new BadRequestException(
        'Fichier illisible. Dans Numbers, enregistrez-le en un seul fichier (Fichier › Avancé › Enregistrer en un seul fichier) ou exportez-le en Excel.',
      );
    }
    return this.service.preview(user.id, file);
  }

  @Post()
  @Audited({ action: AuditAction.CREATE, entity: 'patient', patientId: 'result:id', entityId: 'result:id' })
  @ApiOperation({ summary: 'Importer le dossier relu : patient, dossier médical et séances' })
  import(@Body() dto: ImportPatientDto, @CurrentUser() user: User) {
    return this.service.import(user.id, dto);
  }
}
