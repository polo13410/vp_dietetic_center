/*
 * The routes of the reports to the GP: path, HTTP method, access log entry and delegation to the
 * service (which checks the patient is the user's, see gp-reports.service.spec.ts).
 */
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AUDITED_KEY } from '../audit/audited.decorator';

import { PatientFileController } from './patient-file.controller';

const proto = PatientFileController.prototype as unknown as Record<string, () => unknown>;
const route = (name: string) => ({
  path: Reflect.getMetadata(PATH_METADATA, proto[name]),
  method: Reflect.getMetadata(METHOD_METADATA, proto[name]),
  audited: Reflect.getMetadata(AUDITED_KEY, proto[name]),
});

describe('GP report routes', () => {
  it.each([
    ['listGpReports', 'gp-reports', RequestMethod.GET, 'READ'],
    ['findGpReport', 'gp-reports/:id', RequestMethod.GET, 'READ'],
    ['gpReportDocument', 'gp-reports/:id/document', RequestMethod.GET, 'EXPORT'],
    ['createGpReport', 'gp-reports', RequestMethod.POST, 'CREATE'],
    ['updateGpReport', 'gp-reports/:id', RequestMethod.PATCH, 'UPDATE'],
    ['regenerateGpReport', 'gp-reports/:id/regenerate', RequestMethod.POST, 'UPDATE'],
    ['removeGpReport', 'gp-reports/:id', RequestMethod.DELETE, 'DELETE'],
  ])('%s: %s, logged as %s', (name, path, method, action) => {
    expect(route(name)).toEqual({
      path,
      method,
      audited: expect.objectContaining({ action, entity: 'gp_report', patientId: 'param:patientId' }),
    });
  });

  it('lives under the patient, for practitioners (assistants are refused by the access service)', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PatientFileController)).toBe('patients/:patientId');
    expect(Reflect.getMetadata(ROLES_KEY, PatientFileController)).toEqual(['PRATICIENNE', 'ASSISTANTE']);
  });

  it('passes the user and the patient to the service', async () => {
    const gpReports = {
      create: vi.fn().mockResolvedValue({ id: 'r1' }),
      regenerate: vi.fn().mockResolvedValue({ id: 'r1' }),
      document: vi.fn().mockResolvedValue({ id: 'r1', letterhead: [] }),
    };
    const controller = new PatientFileController({} as any, {} as any, gpReports as any);
    const user = { id: 'u1', role: 'PRATICIENNE' } as any;

    await controller.createGpReport(user, 'p1', {});
    await controller.regenerateGpReport(user, 'p1', 'r1');
    await controller.gpReportDocument(user, 'p1', 'r1');
    expect(gpReports.create).toHaveBeenCalledWith(user, 'p1', {});
    expect(gpReports.regenerate).toHaveBeenCalledWith(user, 'p1', 'r1');
    expect(gpReports.document).toHaveBeenCalledWith(user, 'p1', 'r1');
  });
});
