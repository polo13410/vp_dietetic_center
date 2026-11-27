import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';

function Day({ initial = '', onDay = vi.fn(), ...props }: { initial?: string; onDay?: (d: string) => void; max?: string; upcoming?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <DatePicker
      aria-label="Date"
      value={value}
      onChange={(d) => {
        setValue(d);
        onDay(d);
      }}
      {...props}
    />
  );
}

function Time({ initial = '', onTime = vi.fn() }: { initial?: string; onTime?: (t: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <TimePicker
      aria-label="Heure"
      value={value}
      onChange={(t) => {
        setValue(t);
        onTime(t);
      }}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 27, 10));
});
afterEach(() => vi.useRealTimers());

describe('DatePicker', () => {
  it('shows the day as jj/mm/aaaa with its weekday, and reads a short entry on leaving', () => {
    const onDay = vi.fn();
    render(<Day initial="2026-11-27" onDay={onDay} upcoming />);
    const field = screen.getByLabelText('Date');
    expect(field).toHaveValue('27/11/2026');
    expect(screen.getByText('ven.')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: '3' } });
    fireEvent.blur(field);
    expect(onDay).toHaveBeenLastCalledWith('2026-12-03');
    expect(field).toHaveValue('03/12/2026');
  });

  it('takes a whole date as it is typed', () => {
    const onDay = vi.fn();
    render(<Day onDay={onDay} />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '15/01/2027' } });
    expect(onDay).toHaveBeenCalledWith('2027-01-15');
  });

  it('moves by a day with the arrows and stops at the limit', () => {
    const onDay = vi.fn();
    render(<Day initial="2026-11-26" max="2026-11-27" onDay={onDay} />);
    const field = screen.getByLabelText('Date');
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(field).toHaveValue('27/11/2026');
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(field).toHaveValue('27/11/2026');
    fireEvent.keyDown(field, { key: 'ArrowDown', shiftKey: true });
    expect(onDay).toHaveBeenLastCalledWith('2026-11-20');
  });

  it('keeps what was typed when it is not a date, marks it and clears the value', () => {
    const onDay = vi.fn();
    render(<Day initial="2026-11-26" onDay={onDay} />);
    const field = screen.getByLabelText('Date');
    fireEvent.change(field, { target: { value: '31/02' } });
    fireEvent.blur(field);
    expect(field).toHaveValue('31/02');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(onDay).toHaveBeenLastCalledWith('');
  });
});

describe('TimePicker', () => {
  it('reads a short time on leaving', () => {
    const onTime = vi.fn();
    render(<Time onTime={onTime} />);
    const field = screen.getByLabelText('Heure');
    fireEvent.change(field, { target: { value: '930' } });
    fireEvent.blur(field);
    expect(onTime).toHaveBeenLastCalledWith('09:30');
    expect(field).toHaveValue('09:30');
  });

  it('opens the slots near the typed time and picks one with the keyboard', () => {
    const onTime = vi.fn();
    render(<Time initial="10:00" onTime={onTime} />);
    const field = screen.getByLabelText('Heure');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(field.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: '10:00' }).id);
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onTime).toHaveBeenLastCalledWith('10:15');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('picks a slot with the mouse', () => {
    const onTime = vi.fn();
    render(<Time onTime={onTime} />);
    fireEvent.click(screen.getByLabelText('Heure'));
    fireEvent.click(screen.getByRole('option', { name: '14:45' }));
    expect(onTime).toHaveBeenLastCalledWith('14:45');
  });
});
