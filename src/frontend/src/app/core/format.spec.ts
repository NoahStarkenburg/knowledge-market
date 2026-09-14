import { formatDate, formatDateLong, formatPrice } from './format';

describe('formatPrice', () => {
  it('shows Free for a zero price', () => {
    expect(formatPrice(0, 'USD')).toBe('Free');
  });

  it('formats a currency amount without forcing cents', () => {
    expect(formatPrice(49, 'USD')).toBe('$49');
    expect(formatPrice(19.5, 'USD')).toBe('$19.5');
  });

  it('falls back to a plain amount when the currency code is invalid', () => {
    expect(formatPrice(5, 'NOT-A-CODE')).toBe('NOT-A-CODE 5.00');
  });
});

describe('formatDate', () => {
  it('returns an empty string for a missing date', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDateLong(undefined)).toBe('—');
  });

  it('formats short and long dates', () => {
    // Midday UTC, so the calendar date is the same in every time zone the tests run in.
    const iso = '2026-03-05T12:00:00Z';
    expect(formatDate(iso)).toBe('MAR 5');
    expect(formatDateLong(iso)).toBe('Mar 5, 2026');
  });
});
