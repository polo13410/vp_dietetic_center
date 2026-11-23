import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../test/setup';

import { MeService } from './me.service';

const user = {
  id: 'user-1',
  email: 'valerie@example.fr',
  firstName: 'Valérie',
  lastName: 'Perrot',
  phone: null,
  role: 'PRATICIENNE',
  preferences: null,
};

describe('MeService', () => {
  let service: MeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MeService(mockPrisma as any);
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue(user);
  });

  it('gives her profile, with the theme by default', async () => {
    const profile = await service.getProfile('user-1');
    expect(profile).toEqual({
      id: 'user-1',
      email: 'valerie@example.fr',
      firstName: 'Valérie',
      lastName: 'Perrot',
      phone: null,
      role: 'PRATICIENNE',
      theme: 'SYSTEM',
    });
  });

  it('gives the stored theme', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ ...user, preferences: { theme: 'DARK' } });
    const profile = await service.getProfile('user-1');
    expect(profile).toMatchObject({ theme: 'DARK' });
  });

  it('saves the name and phone on the user, the theme in her preferences', async () => {
    await service.updateProfile('user-1', { firstName: 'Val', phone: '06 12 34 56 78', theme: 'DARK' });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { firstName: 'Val', phone: '06 12 34 56 78' },
    });
    expect(mockPrisma.userPreferences.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', theme: 'DARK' },
      update: { theme: 'DARK' },
    });
  });

  it('changing only the theme leaves the user row alone', async () => {
    await service.updateProfile('user-1', { theme: 'LIGHT' });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.userPreferences.upsert).toHaveBeenCalled();
  });

  it('returns an empty activity when nothing is filled in yet', async () => {
    mockPrisma.practitionerProfile.findUnique.mockResolvedValue(null);
    expect(await service.getActivity('user-1')).toEqual({
      practiceName: null,
      siret: null,
      adeliRpps: null,
      vatMention: null,
      invoiceFooter: null,
    });
  });

  it('saves the activity of the signed-in practitioner only, and returns its fields', async () => {
    mockPrisma.practitionerProfile.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'user-1',
      siret: '91234567800011',
      createdAt: new Date(),
    });
    const practice = await service.updateActivity('user-1', { siret: '91234567800011' });
    expect(mockPrisma.practitionerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', siret: '91234567800011' },
      update: { siret: '91234567800011' },
    });
    expect(practice.siret).toBe('91234567800011');
    expect(practice).not.toHaveProperty('userId');
  });
});
