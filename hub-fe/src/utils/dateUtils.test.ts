import { formatDate } from './dateUtils';

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    // Built with local parts, so the expectation holds whatever timezone the tests run in
    expect(formatDate(new Date(2026, 10, 9, 12))).toBe('2026-11-09');
  });

  it('pads single-digit months and days', () => {
    expect(formatDate(new Date(2026, 0, 2, 12))).toBe('2026-01-02');
  });

  it("renders a stored UTC timestamp as the viewer's local calendar date", () => {
    const stored = '2026-11-09T23:30:00.000Z';
    // sv-SE formats as YYYY-MM-DD, so ICU gives us an independent local-date oracle
    expect(formatDate(stored)).toBe(new Intl.DateTimeFormat('sv-SE').format(new Date(stored)));
  });

  it('returns an empty string for a missing or unparseable date', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});
