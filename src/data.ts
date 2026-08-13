/**
 * Fixture data pools. Nothing here is real customer, product, or company
 * data — it's a curated set of plausible-looking values so generated
 * documents don't scream "test fixture" at a glance the way spec examples
 * (ACME Corp, Widget A, qty 100) do.
 */

export const PART_NUMBER_PREFIXES = ["SKU", "PN", "ITM", "AX", "BR"] as const;

export const PRODUCT_DESCRIPTIONS = [
  "Hex Bolt 3/8-16 x 2in Zinc",
  "Ball Valve 1in NPT Brass",
  "Safety Glasses Clear Lens",
  "Nitrile Gloves Large Box/100",
  "Cable Tie 8in Black Bag/100",
  "Hydraulic Hose 1/2in x 10ft",
  "Bearing 6205-2RS",
  "Shop Towel Roll Blue",
  "Pipe Fitting Elbow 90deg 2in",
  "Work Gloves Leather Palm",
] as const;

export const UOM_CODES = ["EA", "CS", "BX", "FT"] as const;

export const SCAC_CODES = ["FXFE", "UPGF", "ODFL", "SAIA", "RDWY"] as const;

export const CARRIER_NAMES: Record<string, string> = {
  FXFE: "FedEx Freight",
  UPGF: "UPS Freight",
  ODFL: "Old Dominion",
  SAIA: "Saia LTL",
  RDWY: "Roadway Express",
};

export const CITY_STATE = [
  { city: "Columbus", state: "OH", zip: "43215" },
  { city: "Fort Worth", state: "TX", zip: "76102" },
  { city: "Reno", state: "NV", zip: "89501" },
  { city: "Allentown", state: "PA", zip: "18101" },
  { city: "Ontario", state: "CA", zip: "91761" },
] as const;

export const COMPANY_NAMES = [
  "Midstate Distributing",
  "Vantage Supply Co",
  "Crestline Industrial",
  "Harbor Point Logistics",
  "Redline Fastener Group",
] as const;
