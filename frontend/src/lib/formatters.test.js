import { describe, it, expect } from 'vitest';
import { formatMoney, formatDuration, formatHours, initialsOf } from './formatters.js';

describe('formatMoney', () => {
  it('reads minor units, never a float', () => {
    expect(formatMoney(5000, 'USD')).toBe('$50');
    expect(formatMoney(1_066_000, 'USD')).toBe('$10,660');
  });

  it('shows cents only when there are cents', () => {
    expect(formatMoney(5050, 'USD')).toBe('$50.50');
    expect(formatMoney(5000, 'USD')).toBe('$50');
  });

  it('handles zero and missing values without producing NaN', () => {
    expect(formatMoney(0, 'USD')).toBe('$0');
    expect(formatMoney(undefined, 'USD')).toBe('$0');
    expect(formatMoney(null, 'USD')).toBe('$0');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0m'], [45, '45m'], [60, '1h 00m'], [245, '4h 05m'], [1440, '24h 00m'],
  ])('%i minutes → %s', (mins, expected) => {
    expect(formatDuration(mins)).toBe(expected);
  });

  it('pads the minute part so columns line up', () => {
    expect(formatDuration(65)).toBe('1h 05m');
  });

  it('never goes negative', () => {
    expect(formatDuration(-30)).toBe('0m');
  });

  it('survives undefined', () => {
    expect(formatDuration(undefined)).toBe('0m');
  });
});

describe('formatHours', () => {
  it('drops a trailing zero decimal', () => {
    expect(formatHours(3.0)).toBe('3h');
    expect(formatHours(3.5)).toBe('3.5h');
  });
});

describe('initialsOf', () => {
  it.each([
    ['Urooj Majeed', 'UM'],
    ['sarah okafor', 'SO'],
    ['Cher', 'C'],
    ['Ana Maria De Souza', 'AM'],
    ['', '?'],
  ])('%s → %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});
