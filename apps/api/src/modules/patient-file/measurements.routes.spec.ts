/*
 * The routes of the « Mesures » tab: path, HTTP method, access log entry and delegation to the
 * service (which checks the patient is the user's, see patient-file.service.spec.ts).
 */
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { AUDITED_KEY } from '../audit/audited.decorator';

import { PatientFileController } from './patient-file.controller';

const proto = PatientFileController.prototype as unknown as Record<string, () => unknown>;
const route = (name: string) => ({
  path: Reflect.getMetadata(PATH_METADATA, proto[name]),
  method: Reflect.getMetadata(METHOD_METADATA, proto[name]),
  audited: Reflect.getMetadata(AUDITED_KEY, proto[name]),
});

describe('measurement routes', () => {
  it.each([
    ['measureTimeline', 'measurements/timeline', RequestMethod.GET, 'READ'],
    ['createMeasurement', 'measurements', RequestMethod.POST, 'CREATE'],
    ['updateMeasurement', 'measurements/:id', RequestMethod.PATCH, 'UPDATE'],
    ['removeMeasurement', 'measurements/:id', RequestMethod.DELETE, 'DELETE'],
  ])('%s: %s, logged as %s', (name, path, method, action) => {
    expect(route(name)).toEqual({
      path,
      method,
      audited: expect.objectContaining({ action, entity: 'measurement', patientId: 'param:patientId' }),
    });
  });

  it('passes the user and the patient to the service', async () => {
    const file = { getMeasureTimeline: vi.fn().mockResolvedValue({ measurements: [] }) };
    const controller = new PatientFileController(file as any, {} as any, {} as any);
    const user = { id: 'u1', role: 'PRATICIENNE' } as any;

    await controller.measureTimeline(user, 'p1');
    expect(file.getMeasureTimeline).toHaveBeenCalledWith(user, 'p1');
  });
});
