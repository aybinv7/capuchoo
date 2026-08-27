import { describe, expect, it } from "vite-plus/test";
import { DatabaseError } from "./index.js";

describe("DatabaseError", () => {
  // A unique violation has to stay recognisable by SQLSTATE after wrapping, or
  // the caller cannot tell "you asked for something that already exists" from
  // "the database is broken" and every conflict becomes a 500.
  it("keeps the SQLSTATE it was given", () => {
    expect(new DatabaseError("Insert failed: duplicate key", "23505").code).toBe("23505");
  });

  it("has no code when none was reported", () => {
    expect(new DatabaseError("Insert failed").code).toBeUndefined();
  });

  it("is still a 500 - the code is for the caller to reinterpret", () => {
    expect(new DatabaseError("x", "23505").statusCode).toBe(500);
  });
});
