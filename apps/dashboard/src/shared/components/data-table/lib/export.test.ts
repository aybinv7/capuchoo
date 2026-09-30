import { describe, expect, it } from "vite-plus/test";
import {
  csvCell,
  exportFilename,
  neutraliseFormula,
  toCsv,
  toJson,
  type ExportColumn,
} from "./export";

interface Row {
  name: string;
  count: number | null;
}

const COLUMNS: ExportColumn<Row>[] = [
  { id: "name", title: "Name", value: (row) => row.name },
  { id: "count", title: "Count", value: (row) => row.count },
];

describe("csv export", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("writes empty cells for missing values", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
  });

  it("neutralises cells a spreadsheet would run as a formula", () => {
    for (const lead of ["=", "+", "-", "@"])
      expect(neutraliseFormula(`${lead}1`)).toBe(`'${lead}1`);
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(neutraliseFormula("1-2")).toBe("1-2");
  });

  it("writes a header then one line per row with CRLF", () => {
    expect(
      toCsv(
        [
          { name: "a", count: 1 },
          { name: "b", count: null },
        ],
        COLUMNS,
      ),
    ).toBe("Name,Count\r\na,1\r\nb,");
  });
});

describe("json export", () => {
  it("keys by column id and turns missing values into null", () => {
    expect(JSON.parse(toJson([{ name: "a", count: null }], COLUMNS))).toEqual([
      { name: "a", count: null },
    ]);
  });
});

describe("export filename", () => {
  it("is filesystem-safe and stamped", () => {
    expect(exportFilename("Presalio Store/devices", new Date("2026-09-30T10:11:12Z"))).toBe(
      "Presalio-Store-devices-2026-09-30-10-11-12",
    );
  });
});
