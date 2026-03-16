/**
 * data/truckingGlossary.ts
 *
 * Plain-English definitions for trucking industry terms.
 * Used by GlossaryTooltip to surface contextual help throughout the UI.
 */

export const glossary: Record<string, string> = {
  IFTA: "International Fuel Tax Agreement — a multi-state fuel tax program that simplifies reporting for carriers operating in multiple jurisdictions.",
  BOL: "Bill of Lading — the legal shipping document that serves as a receipt for freight and a contract between shipper and carrier.",
  POD: "Proof of Delivery — signed documentation confirming freight was delivered to the consignee.",
  RPM: "Rate Per Mile — the dollar amount earned per mile driven, used to compare load profitability.",
  HOS: "Hours of Service — federal regulations limiting how many hours a driver can work and drive before mandatory rest.",
  ELD: "Electronic Logging Device — a GPS-connected device that automatically records a driver's HOS data.",
  MC: "Motor Carrier — the operating authority number issued by FMCSA allowing a company to haul freight for hire.",
  DOT: "Department of Transportation — the federal agency overseeing transportation safety; also refers to a carrier's DOT number.",
  TONU: "Truck Ordered Not Used — a penalty fee charged when a shipper books a truck but cancels after it arrives.",
  LUMPER:
    "A third-party worker hired to load or unload freight at a warehouse; the cost is often passed through to the shipper.",
  DETENTION:
    "Additional pay for a driver when loading or unloading takes longer than the agreed free time (typically 2 hours).",
  DEADHEAD:
    "Miles driven without a paying load — also called 'empty miles'. High deadhead reduces overall profitability.",
  ACCESSORIAL:
    "Extra charges added to a base rate for services such as detention, fuel surcharge, TONU, or layover.",
  LAYOVER:
    "A fee paid when a driver is forced to wait overnight at a shipper or receiver due to delays.",
  FUEL_SURCHARGE:
    "A variable charge added to the base rate that compensates for fluctuating diesel prices.",
  LTL: "Less Than Truckload — a shipment that doesn't fill an entire trailer; multiple LTL shipments share a truck.",
  FTL: "Full Truckload — a shipment large enough to fill or exclusively book an entire trailer.",
  DRAYAGE:
    "Short-distance trucking, often the movement of containers between a port and a nearby rail or warehouse.",
  INTERMODAL:
    "Freight transported using more than one mode (e.g., ship + rail + truck) without reloading cargo.",
  BROKER:
    "A licensed intermediary who connects shippers needing freight moved with carriers who have available capacity.",
  FACTORING:
    "Selling outstanding invoices to a third party at a discount in exchange for immediate cash payment.",
  TARE_WEIGHT:
    "The weight of an empty truck and trailer, subtracted from gross weight to determine cargo weight.",
  GROSS_WEIGHT:
    "The total weight of the truck, trailer, and all cargo combined.",
  SCALE_TICKET:
    "An official weight receipt from a certified weigh station confirming the truck's weight.",
  RATE_CON:
    "Rate Confirmation — a binding document from a broker or shipper confirming load details, rate, and pickup/delivery.",
  HAZMAT:
    "Hazardous Materials — cargo classified as dangerous goods; requires special placards, training, and endorsements.",
  CDL: "Commercial Driver's License — the federal license required to operate a commercial motor vehicle over 26,001 lbs.",
  FMCSA:
    "Federal Motor Carrier Safety Administration — the federal agency that regulates commercial trucking safety.",
  OTR: "Over The Road — a driver or carrier that operates long-haul routes across state lines rather than local runs.",
  REEFER:
    "A refrigerated trailer used for temperature-sensitive cargo such as food or pharmaceuticals.",
};
