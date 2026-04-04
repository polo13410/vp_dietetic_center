import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { DocumentsService } from './documents.service';
import { StorageService } from './storage.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les documents' })
  findAll(@Query('patientId') patientId?: string) {
    return this.service.findAll(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Telecharger un document' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.service.findOne(id);
    try {
      const filePath = await this.storage.getFilePath(doc.gcsPath);
      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName}"`);
      res.sendFile(filePath);
    } catch {
      throw new NotFoundException('Fichier introuvable sur le stockage');
    }
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
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
      required: ['file', 'patientId', 'name', 'type'],
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('patientId') queryPatientId: string,
    @Query('name') queryName: string,
    @Query('type') queryType: string,
    @Query('description') queryDescription: string,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    // Accept params from query or body (form-data fields come as body in multer)
    const body = (user as any)?._body ?? {};
    const patientId = queryPatientId || body.patientId;
    const name = queryName || body.name || file.originalname;
    const type = queryType || body.type || 'OTHER';
    const description = queryDescription || body.description;

    if (!patientId) throw new BadRequestException('patientId requis');

    const uploaded = await this.storage.upload(file, patientId);

    return this.service.create(
      {
        patientId,
        name,
        originalName: file.originalname,
        type: type as DocumentType,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        gcsPath: uploaded.storagePath,
        description,
      },
      user,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
