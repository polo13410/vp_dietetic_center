import { describe, expect, it } from 'vitest';

import { buildGpReportDraft, formatDate, formatNumber, type GpReportDraftInput, letterhead } from './gp-report-draft';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const at10 = (iso: string) => new Date(`${iso}T09:00:00Z`);

/** The test patient of docs/REFONTE.md § 3.1: woman, 56, 1.59 m, 79 → 78.2 → 76.5 kg. */
function martine(): GpReportDraftInput {
  return {
    today: day('2026-11-22'),
    practice: {
      practiceName: 'Valérie Dupont, diététicienne nutritionniste',
      address: '12 rue des Oliviers',
      zipCode: '13100',
      city: 'Aix-en-Provence',
      adeliRpps: '139512345',
    },
    practitioner: { firstName: 'Valérie', lastName: 'Dupont', phone: '06 12 34 56 78', email: 'michelle@example.fr' },
    patient: {
      firstName: 'Martine',
      lastName: 'Roux',
      sex: 'F',
      dateOfBirth: day('1970-08-24'),
      gpName: 'Dr Laurent Garnier',
      consultationReason: 'Perte de poids (+15 kg depuis la ménopause), cholestérol un peu élevé.',
    },
    heights: [{ value: 159, measuredAt: day('2026-09-23') }],
    weights: [
      { value: 79, measuredAt: day('2026-09-23') },
      { value: 78.2, measuredAt: day('2026-10-23') },
      { value: 76.5, measuredAt: day('2026-11-15') },
    ],
    sessions: [
      {
        date: at10('2026-09-23'),
        sessionWork: 'Bilan : histoire du poids, rythme des repas, motivation.',
        advice: 'Petit-déjeuner chaque matin. Collation à 16 h : un fruit et quelques amandes.',
      },
      {
        date: at10('2026-10-23'),
        sessionWork: "Travail sur la faim et l'envie de manger.",
        advice: 'Garder le petit-déjeuner. Légumes en soupe le soir.',
      },
      {
        date: at10('2026-11-15'),
        sessionWork: 'Point sur les repas au restaurant. Travail sur les portions',
        advice: 'Au restaurant : une entrée ou un dessert, pas les deux.',
      },
    ],
    file: [
      { field: 'HEALTH', content: 'Hypertension traitée (amlodipine). Arthrose des genoux.' },
      { field: 'FAMILY_HISTORY', content: 'Mère diabétique de type 2.' },
      { field: 'PHYSICAL_ACTIVITY', content: 'Marche 30 minutes trois fois par semaine, aquagym le mardi.' },
      { field: 'BLOOD_GLUCOSE', content: 'Glycémie à jeun 1,08 g/L (bilan sanguin de septembre).' },
      { field: 'CHOLESTEROL_TRIGLYCERIDES', content: 'LDL 1,45 g/L, triglycérides 1,60 g/L.' },
      { field: 'AVERSIONS', content: "N'aime pas les légumes cuits." },
      { field: 'TASTES', content: 'Aime les fruits.' },
    ],
  };
}

describe('buildGpReportDraft', () => {
  it('writes the § 3.1 test patient’s letter with the right figures', () => {
    expect(buildGpReportDraft(martine())).toBe(
      [
        'Dr Laurent Garnier',
        'Aix-en-Provence, le 22 novembre 2026',
        'Objet : suivi diététique de Mme Martine Roux',
        'Docteur,',
        'Je vous fais part du suivi diététique de Mme Martine Roux, 56 ans, qui me consulte pour le motif suivant : perte de poids (+15 kg depuis la ménopause), cholestérol un peu élevé.',
        'Le suivi a débuté par un bilan le 23 septembre 2026. Nous en sommes à 3 séances, la dernière ayant eu lieu le 15 novembre 2026.',
        'Lors du bilan, son poids était de 79 kg (IMC 31,25). Au 15 novembre 2026, il est de 76,5 kg (IMC 30,26), soit une perte de 2,5 kg.',
        'Son métabolisme de base, estimé à 5,86 MJ (1 400,3 kcal) par jour au bilan, est aujourd’hui de 5,77 MJ (1 378,9 kcal) par jour.',
        [
          'Au fil de nos échanges, j’ai relevé les éléments suivants :',
          '– Santé : hypertension traitée (amlodipine). Arthrose des genoux.',
          '– Antécédents familiaux : mère diabétique de type 2.',
          '– Activité physique : marche 30 minutes trois fois par semaine, aquagym le mardi.',
          '– Glycémie : glycémie à jeun 1,08 g/L (bilan sanguin de septembre).',
          '– Cholestérol et triglycérides : LDL 1,45 g/L, triglycérides 1,60 g/L.',
        ].join('\n'),
        [
          'Au cours des dernières séances, nous avons travaillé sur :',
          '– le 23 septembre : bilan : histoire du poids, rythme des repas, motivation.',
          "– le 23 octobre : travail sur la faim et l'envie de manger.",
          '– le 15 novembre : point sur les repas au restaurant. Travail sur les portions.',
        ].join('\n'),
        [
          'Les conseils donnés :',
          '– le 23 septembre : petit-déjeuner chaque matin. Collation à 16 h : un fruit et quelques amandes.',
          '– le 23 octobre : garder le petit-déjeuner. Légumes en soupe le soir.',
          '– le 15 novembre : au restaurant : une entrée ou un dessert, pas les deux.',
        ].join('\n'),
        'Je reste à votre disposition pour tout complément d’information.',
        'Je vous prie d’agréer, Docteur, l’expression de mes salutations distinguées.',
        'Valérie Dupont\nDiététicienne nutritionniste',
      ].join('\n\n'),
    );
  });

  it('never prints a missing value or an empty heading', () => {
    const text = buildGpReportDraft({
      today: day('2026-11-22'),
      practice: null,
      practitioner: { firstName: 'Valérie', lastName: 'Dupont' },
      patient: { firstName: 'Jean', lastName: 'Martin' },
      weights: [],
      sessions: [],
      file: [{ field: 'HEALTH', content: '   ' }],
    });
    expect(text).toBe(
      [
        'Le 22 novembre 2026',
        'Objet : suivi diététique de Jean Martin',
        'Madame, Monsieur,',
        'Je vous fais part du suivi diététique de Jean Martin.',
        'Je reste à votre disposition pour tout complément d’information.',
        'Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.',
        'Valérie Dupont',
      ].join('\n\n'),
    );
    expect(text).not.toMatch(/undefined|null|NaN|: *\n|: *$/m);
  });

  it('leaves out the BMI without height and the BMR without sex or age', () => {
    const input = martine();
    const text = buildGpReportDraft({
      ...input,
      heights: [],
      patient: { ...input.patient, sex: null, dateOfBirth: null },
    });
    expect(text).toContain('Lors du bilan, son poids était de 79 kg. Au 15 novembre 2026, il est de 76,5 kg, soit une perte de 2,5 kg.');
    expect(text).toContain('suivi diététique de Martine Roux, qui me consulte');
    expect(text).not.toMatch(/IMC|métabolisme|ans,/);
  });

  it('handles a single session and a single weight', () => {
    const input = martine();
    const text = buildGpReportDraft({
      ...input,
      weights: input.weights.slice(0, 1),
      sessions: input.sessions.slice(0, 1),
      file: [{ field: 'ALLERGIES', content: 'Aucune connue' }],
    });
    expect(text).toContain('Le bilan diététique a eu lieu le 23 septembre 2026.');
    expect(text).toContain('Son poids est de 79 kg (IMC 31,25) au 23 septembre 2026.');
    expect(text).toContain('Son métabolisme de base est estimé à 5,86 MJ (1 400,3 kcal) par jour.');
    expect(text).toContain('Au fil de nos échanges, j’ai relevé : Allergies : aucune connue.');
    expect(text).toContain('nous avons travaillé sur : le 23 septembre : bilan : histoire du poids');
  });

  it('says a gain or a stable weight, and dates a weight taken outside a session', () => {
    const input = martine();
    const gain = buildGpReportDraft({
      ...input,
      weights: [
        { value: 76.5, measuredAt: day('2026-09-30') },
        { value: 77.3, measuredAt: day('2026-11-15') },
      ],
    });
    expect(gain).toContain('Le 30 septembre 2026, son poids était de 76,5 kg');
    expect(gain).toContain('soit une prise de 0,8 kg');
    expect(gain).toContain('au départ, est aujourd’hui');

    const stable = buildGpReportDraft({
      ...input,
      weights: [input.weights[0], { value: 79, measuredAt: day('2026-11-15') }],
    });
    expect(stable).toContain('soit un poids stable');
  });

  it('leaves out a weight history entered before the bilan', () => {
    const input = martine();
    const text = buildGpReportDraft({
      ...input,
      weights: [{ value: 70, measuredAt: day('2019-05-01') }, ...input.weights],
    });
    expect(text).toContain('Lors du bilan, son poids était de 79 kg (IMC 31,25)');
    expect(text).not.toContain('70 kg');
  });

  it('takes the work and advice of the latest sessions only, and skips empty ones', () => {
    const input = martine();
    const sessions = [
      { date: at10('2025-12-01'), sessionWork: 'Très ancien travail', advice: null },
      ...input.sessions.map((s, i) => (i === 1 ? { ...s, advice: '' } : s)),
    ];
    const text = buildGpReportDraft({ ...input, sessions });
    expect(text).not.toContain('Très ancien');
    expect(text).toContain('Les conseils donnés :\n– le 23 septembre : petit-déjeuner');
    expect(text).not.toContain('garder le petit-déjeuner');
    expect(text).toContain('Nous en sommes à 4 séances');
  });

  it('describes a man', () => {
    const input = martine();
    const text = buildGpReportDraft({ ...input, patient: { ...input.patient, sex: 'M', firstName: 'Paul' } });
    expect(text).toContain('Objet : suivi diététique de M. Paul Roux');
  });
});

describe('letterhead', () => {
  it('lists the practice, then how to reach her', () => {
    expect(letterhead(martine().practice, martine().practitioner)).toEqual([
      'Valérie Dupont, diététicienne nutritionniste',
      '12 rue des Oliviers',
      '13100 Aix-en-Provence',
      'Tél. 06 12 34 56 78',
      'michelle@example.fr',
      'N° ADELI : 139512345',
    ]);
  });

  it('falls back to her name, and labels an RPPS number', () => {
    expect(letterhead({ adeliRpps: '10001234567', city: 'Aix' }, { firstName: 'Valérie', lastName: 'Dupont' })).toEqual([
      'Valérie Dupont',
      'Aix',
      'N° RPPS : 10001234567',
    ]);
  });
});

describe('formatting', () => {
  it('writes French numbers and dates', () => {
    expect(formatNumber(1378.94, 1, true)).toBe('1 378,9');
    expect(formatNumber(76.5, 2)).toBe('76,5');
    expect(formatNumber(79, 2)).toBe('79');
    expect(formatNumber(5.8, 2, true)).toBe('5,80');
    expect(formatDate(day('2026-11-01'))).toBe('1er novembre 2026');
  });
});
