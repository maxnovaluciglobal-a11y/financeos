import { describe, it, expect } from "vitest";
import { brandedSender, investSiteName, INVEST_SENDER_NAME } from "./emailSender.ts";

describe("brandedSender (rebranding moyiq)", () => {
  it("keeps the address of the secret and replaces the old display name", () => {
    expect(brandedSender("MOY IQ <hola@moyiq.app>", "x@moyiq.app")).toBe("moyiq <hola@moyiq.app>");
    expect(brandedSender("MOY IQ Invest <invest@moyiq.app>", "x@moyiq.app", INVEST_SENDER_NAME)).toBe("moyiq Inversiones <invest@moyiq.app>");
    expect(brandedSender("licencias@moyiq.app", "x@moyiq.app")).toBe("moyiq <licencias@moyiq.app>");
  });
  it("falls back to the given address when the secret is missing or broken", () => {
    expect(brandedSender(undefined, "hola@moyiq.app")).toBe("moyiq <hola@moyiq.app>");
    expect(brandedSender("", "hola@moyiq.app")).toBe("moyiq <hola@moyiq.app>");
    expect(brandedSender("MOY IQ", "hola@moyiq.app")).toBe("moyiq <hola@moyiq.app>");
  });
  it("names the investments site per language", () => {
    expect(investSiteName("es")).toBe("moyiq · Inversiones");
    expect(investSiteName("en")).toBe("moyiq · Investments");
    expect(investSiteName("pt")).toBe("moyiq · Investimentos");
    expect(investSiteName("de")).toBe("moyiq · Investments");
  });
});
