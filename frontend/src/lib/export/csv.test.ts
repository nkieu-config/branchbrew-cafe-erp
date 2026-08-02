import { describe, it, expect } from "vitest";
import { buildCsvFilename, escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("passes plain values through untouched", () => {
    expect(escapeCsvCell("Latte")).toBe("Latte");
    expect(escapeCsvCell(1250.5)).toBe("1250.5");
  });

  it("renders null and undefined as empty, not as the words", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    expect(escapeCsvCell("Downtown, Bangkok")).toBe('"Downtown, Bangkok"');
    expect(escapeCsvCell('He said "no"')).toBe('"He said ""no"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(escapeCsvCell("-2")).toBe("'-2");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
  });
});

describe("toCsv", () => {
  it("writes a header row then one row per record", () => {
    const csv = toCsv(
      [
        { name: "Latte", price: 85 },
        { name: "Cold brew, large", price: 120 },
      ],
      [
        { header: "Name", value: (row) => row.name },
        { header: "Price", value: (row) => row.price },
      ],
    );

    expect(csv).toBe(
      'Name,Price\r\nLatte,85\r\n"Cold brew, large",120',
    );
  });

  it("still emits headers for an empty result set", () => {
    const csv = toCsv([], [{ header: "Name", value: (row: { name: string }) => row.name }]);
    expect(csv).toBe("Name");
  });
});

describe("buildCsvFilename", () => {
  it("slugifies the base and stamps the date", () => {
    expect(buildCsvFilename("Trial Balance", new Date(2026, 7, 2))).toBe(
      "trial-balance-20260802.csv",
    );
  });

  it("falls back when the base has nothing usable", () => {
    expect(buildCsvFilename("!!!", new Date(2026, 0, 9))).toBe("export-20260109.csv");
  });
});
