import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { DocumentType, User } from '@prisma/client';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { DocumentsService } from './documents.service';
import { UploadDocumentBodyDto } from './dto/upload-document.dto';
import { StorageService } from './storage.service';

/** Files a practice exchanges: analyses, prescriptions, reports, scans and photos. */
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

@ApiTags('documents')
@ApiBearerAuth()
// Patient data: never admins (they manage the app, not patients)
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les documents' })
  findAll(
    @CurrentUser() user: User,
    @Query('patientId') patientId?: string,
  ) {
    return this.service.findAll(user, patientId);
  }

  @Get(':id/download')
  @Audited({ action: AuditAction.EXPORT, entity: 'document', patientId: 'result:patientId' })
  @ApiOperation({ summary: 'Telecharger un document' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const doc = await this.service.findOne(id, user);
    const content = await this.storage.read(doc.gcsPath);
    // Always a download: the file is never rendered by the browser on the app's origin
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.attachment(doc.originalName);
    content.on('error', () => res.destroy());
    content.pipe(res);
    return { patientId: doc.patientId }; // for the audit trail (the response is the file)
  }

  @Post('upload')
  @Audited({ action: AuditAction.CREATE, entity: 'document', patientId: 'body:patientId', entityId: 'result:id' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, accept) =>
        ALLOWED_TYPES.has(file.mimetype)
          ? accept(null, true)
          : accept(new BadRequestException('Type de fichier non accepté (PDF, image, Word, Excel, texte)'), false),
    }),
  )
  @ApiOperation({ summary: 'Uploader un document' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        patientId: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: Object.values(DocumentType) },
        description: { type: 'string' },
      },
      required: ['file', 'patientId'],
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentBodyDto,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    await this.service.assertCanUpload(user, body.patientId);

    const uploaded = await this.storage.upload(file, body.patientId);

    return this.service.create(
      {
        patientId: body.patientId,
        name: body.name || file.originalname,
        originalName: file.originalname,
        type: body.type ?? DocumentType.OTHER,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        gcsPath: uploaded.storagePath,
        description: body.description,
      },
      user,
    );
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'document', patientId: 'result:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const { patientId } = await this.service.remove(id, user);
    return { patientId }; // for the audit trail (no body is sent)
  }
}
