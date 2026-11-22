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
  passwordHash: '$2b$12$hash',
  googleId: null,
  preferences: null,
};

describe('MeService', () => {
  let service: MeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MeService(mockPrisma as any);
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue(user);
  });

  it('says whether there is a password, never giving the hash', async () => {
    const profile = await service.getProfile('user-1');
    expect(profile).toEqual({
      id: 'user-1',
      email: 'valerie@example.fr',
      firstName: 'Valérie',
      lastName: 'Perrot',
      phone: null,
      role: 'PRATICIENNE',
      hasPassword: true,
      googleLinked: false,
      theme: 'SYSTEM',
    });
  });

  it('recognises a Google-only account and the stored theme', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      passwordHash: null,
      googleId: 'google-sub',
      preferences: { theme: 'DARK' },
    });
    const profile = await service.getProfile('user-1');
    expect(profile).toMatchObject({ hasPassword: false, googleLinked: true, theme: 'DARK' });
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

  it('returns an empty practice when nothing is filled in yet', async () => {
    mockPrisma.practitionerProfile.findUnique.mockResolvedValue(null);
    expect(await service.getPractice('user-1')).toEqual({
      practiceName: null,
      address: null,
      zipCode: null,
      city: null,
      siret: null,
      adeliRpps: null,
      vatMention: null,
      invoiceFooter: null,
    });
  });

  it('saves the practice of the signed-in practitioner only, and returns its fields', async () => {
    mockPrisma.practitionerProfile.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'user-1',
      siret: '91234567800011',
      createdAt: new Date(),
    });
    const practice = await service.updatePractice('user-1', { siret: '91234567800011' });
    expect(mockPrisma.practitionerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', siret: '91234567800011' },
      update: { siret: '91234567800011' },
    });
    expect(practice.siret).toBe('91234567800011');
    expect(practice).not.toHaveProperty('userId');
  });
});
