import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '../ui/input';

import { Field } from './Field';

describe('Field', () => {
  it('links the label to the control', () => {
    render(
      <Field label="Prénom">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Prénom')).toBeInstanceOf(HTMLInputElement);
  });

  it('spells out "obligatoire" and marks the control as required', () => {
    render(
      <Field label="E-mail" required>
        <Input />
      </Field>,
    );
    expect(screen.getByText('obligatoire')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('describes the control with the hint and the error', () => {
    render(
      <Field
        label="Mot de passe"
        hint="8 caractères au moins"
        error="Le mot de passe est trop court."
      >
        <Input type="password" data-testid="pw" />
      </Field>,
    );
    const input = screen.getByTestId('pw');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      '8 caractères au moins Le mot de passe est trop court.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Le mot de passe est trop court.');
  });

  it('keeps the id given to the control', () => {
    render(
      <Field label="Nom">
        <Input id="last-name" />
      </Field>,
    );
    expect(screen.getByLabelText('Nom')).toHaveAttribute('id', 'last-name');
  });
});
