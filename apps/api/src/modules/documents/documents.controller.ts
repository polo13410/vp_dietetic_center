import {
  BadRequestException,
  Body,
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
import { UserRole } from '@prisma/client';
import { DocumentType, User } from '@prisma/client';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { DocumentsService } from './documents.service';
import { UploadDocumentBodyDto } from './dto/upload-document.dto';
import { StorageService } from './storage.service';

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

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Telecharger un document' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const doc = await this.service.findOne(id, user);
    let filePath: string;
    try {
      filePath = await this.storage.getFilePath(doc.gcsPath);
    } catch {
      throw new NotFoundException('Fichier introuvable sur le stockage');
    }
    res.setHeader('Content-Type', doc.mimeType);
    res.attachment(doc.originalName);
    res.sendFile(filePath);
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.service.remove(id, user);
  }
}
