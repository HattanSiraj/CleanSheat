import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HEADERS = [
  "Source System",
  "Row Key",
  "Customer Ref",
  "Customer Name",
  "Email",
  "Phone",
  "Birth Date",
  "Age",
  "Signup Date",
  "Status",
  "Segment",
  "Country",
  "City",
  "Postal Code",
  "Order Ref",
  "Order Date",
  "Item",
  "SKU",
  "Quantity",
  "Unit Price",
  "Discount",
  "Tax",
  "Order Total",
  "Currency",
  "Paid",
  "Shipping Address",
  "Last Contact",
  "Consent",
  "Account Balance",
  "Notes",
];

const SOURCES = ["CRM", "Web Shop", "Legacy ERP", "POS Export", "Support Desk"];
const FIRST_NAMES = ["Alex", "Maya", "Omar", "Nora", "Sam", "Lina", "José", "Zoë", "Yousef", "Marta", "Björn", "Noor"];
const LAST_NAMES = ["Stone", "Khan", "Saleh", "Martin", "Nasser", "Young", "García", "Müller", "Haddad", "Clark", "Aziz", "Baker"];
const LOCATIONS = [
  { country: "Saudi Arabia", city: "Riyadh", postal: "11564", currency: "SAR", dial: "966", local: "05" },
  { country: "Saudi Arabia", city: "Jeddah", postal: "21577", currency: "SAR", dial: "966", local: "05" },
  { country: "United States", city: "Austin", postal: "78701", currency: "USD", dial: "1", local: "512" },
  { country: "United Kingdom", city: "Manchester", postal: "M1 1AE", currency: "GBP", dial: "44", local: "07" },
  { country: "Germany", city: "Berlin", postal: "10115", currency: "EUR", dial: "49", local: "015" },
  { country: "Egypt", city: "Cairo", postal: "11511", currency: "EGP", dial: "20", local: "010" },
];
const ITEMS = [
  ["Notebook", "STA-001", 4.5],
  ["Desk Lamp", "HOME-19", 35.5],
  ["Coffee Beans", "FOOD-8", 12],
  ["USB-C Cable", "ELEC-04", 8.75],
  ["Office Chair", "FURN-200", 1299.5],
  ["Water Bottle", "SPORT-2", 19.99],
];
const MISSING_MARKERS = ["", "N/A", "NA", "NULL", "null", "-", "?", "unknown"];

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}

function mark(summary, issue) {
  summary[issue] = (summary[issue] ?? 0) + 1;
}

function dateFromOffset(offset) {
  const date = new Date(Date.UTC(2019, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
}

function shiftYears(isoDate, years) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function excelSerial(isoDate) {
  const epoch = Date.UTC(1899, 11, 30);
  return String(Math.floor((Date.parse(`${isoDate}T00:00:00Z`) - epoch) / 86400000));
}

function formatDate(isoDate, style) {
  const [year, month, day] = isoDate.split("-");
  const monthName = new Date(`${isoDate}T00:00:00Z`).toLocaleString("en", { month: "short", timeZone: "UTC" });
  const formats = [
    isoDate,
    `${day}/${month}/${year}`,
    `${month}/${day}/${year}`,
    `${monthName} ${Number(day)}, ${year}`,
    `${isoDate}T14:32:00Z`,
    excelSerial(isoDate),
    `${Number(day)}-${Number(month)}-${year.slice(2)}`,
  ];
  return formats[style % formats.length];
}

function customerPhone(customerIndex, location) {
  const tail = String(1000000 + ((customerIndex * 7919) % 8999999));
  return `${location.local}${tail}`;
}

function internationalPhone(localPhone, location) {
  const withoutLeadingZero = localPhone.replace(/^0/, "");
  return `+${location.dial}${withoutLeadingZero}`;
}

function formatPhone(localPhone, location, style) {
  const international = internationalPhone(localPhone, location);
  const digits = international.replace(/\D/g, "");
  const formats = [
    international,
    localPhone,
    `00${digits}`,
    `${international.slice(0, 4)} ${international.slice(4, 7)} ${international.slice(7)}`,
    `(${localPhone.slice(0, 3)}) ${localPhone.slice(3, 6)}-${localPhone.slice(6)}`,
    `Mob: ${localPhone}`,
    `${international} ext 42`,
  ];
  return formats[style % formats.length];
}

function formatMoney(value, currency, style) {
  const fixed = value.toFixed(2);
  const symbols = { SAR: "SAR ", USD: "$", GBP: "£", EUR: "€", EGP: "EGP " };
  const grouped = value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formats = [
    fixed,
    `${symbols[currency]}${grouped}`,
    `${grouped} ${currency}`,
    fixed.replace(".", ","),
    value < 0 ? `(${Math.abs(value).toFixed(2)})` : fixed,
  ];
  return formats[style % formats.length];
}

function formatPercent(rate, source) {
  if (source === "CRM") return rate.toFixed(2);
  if (source === "Legacy ERP") return String(Math.round(rate * 100));
  if (source === "POS Export") return rate ? `${Math.round(rate * 100)} pct` : "none";
  return `${Math.round(rate * 100)}%`;
}

function buildCustomers(count, random) {
  return Array.from({ length: count }, (_, index) => {
    const firstName = pick(FIRST_NAMES, random);
    const lastName = pick(LAST_NAMES, random);
    const location = pick(LOCATIONS, random);
    const birthDate = dateFromOffset(-15000 + Math.floor(random() * 12000));
    return {
      ref: `CU-${String(10000 + index).padStart(5, "0")}`,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email: `customer.${10000 + index}@example.com`,
      phone: customerPhone(index, location),
      birthDate,
      signupDate: dateFromOffset(Math.floor(random() * 2400)),
      location,
      status: random() > 0.12 ? "Active" : "Inactive",
      segment: pick(["Consumer", "Small Business", "Enterprise", "VIP"], random),
    };
  });
}

function calculateAge(birthDate) {
  return String(2026 - Number(birthDate.slice(0, 4)));
}

function makeBaseRow(index, customers, random) {
  const source = SOURCES[index % SOURCES.length];
  const customer = customers[(index * 37 + Math.floor(random() * 31)) % customers.length];
  const [item, sku, listPrice] = pick(ITEMS, random);
  const quantity = 1 + Math.floor(random() * 8);
  const discountRate = pick([0, 0, 0.05, 0.1, 0.15, 0.25], random);
  const taxRate = customer.location.country === "United States" ? 0.0825 : pick([0, 0.05, 0.15, 0.2], random);
  const total = quantity * listPrice * (1 - discountRate) * (1 + taxRate);
  const orderDate = dateFromOffset(900 + (index % 1500));
  const phoneStyle = (index + SOURCES.indexOf(source)) % 7;
  const dateStyle = (index + customer.location.country.length) % 7;

  return {
    "Source System": source,
    "Row Key": `ROW-${String(index + 1).padStart(7, "0")}`,
    "Customer Ref": customer.ref,
    "Customer Name": customer.name,
    Email: customer.email,
    Phone: formatPhone(customer.phone, customer.location, phoneStyle),
    "Birth Date": formatDate(customer.birthDate, dateStyle),
    Age: calculateAge(customer.birthDate),
    "Signup Date": formatDate(customer.signupDate, dateStyle + 2),
    Status: source === "Legacy ERP" ? (customer.status === "Active" ? "A" : "I") : customer.status,
    Segment: customer.segment,
    Country: customer.location.country,
    City: customer.location.city,
    "Postal Code": customer.location.postal,
    "Order Ref": `INV-${String(500000 + index).padStart(7, "0")}`,
    "Order Date": formatDate(orderDate, dateStyle + 4),
    Item: item,
    SKU: sku,
    Quantity: String(quantity),
    "Unit Price": formatMoney(listPrice, customer.location.currency, index % 5),
    Discount: formatPercent(discountRate, source),
    Tax: formatPercent(taxRate, source),
    "Order Total": formatMoney(total, customer.location.currency, (index + 2) % 5),
    Currency: customer.location.currency,
    Paid: source === "CRM" ? (random() > 0.18 ? "true" : "false") : random() > 0.18 ? "Yes" : "No",
    "Shipping Address": `${Math.floor(random() * 999) + 1} Market Street | ${customer.location.city} | ${customer.location.postal}`,
    "Last Contact": formatDate(dateFromOffset(1800 + (index % 500)), dateStyle + 1),
    Consent: pick(["yes", "no", "Y", "N", "1", "0", "TRUE", "FALSE"], random),
    "Account Balance": formatMoney((random() - 0.35) * 2500, customer.location.currency, (index + 1) % 5),
    Notes: pick(["Leave at reception", "Called before delivery", "Gift order, add a card", "No notes", "Customer said \"thank you\""], random),
  };
}

function corruptRow(row, rowNumber, random, summary) {
  if (rowNumber % 7 === 0) {
    row["Customer Name"] = `  ${row["Customer Name"].replace(" ", "\u00a0  ")}  `;
    row.City = ` ${row.City.toUpperCase()} `;
    mark(summary, "invisible and repeated whitespace");
  }
  if (rowNumber % 11 === 0) {
    row.Email = ` ${row.Email.replace("@", " @ ")} `;
    mark(summary, "repairable email formatting");
  }
  if (rowNumber % 13 === 0) {
    row.Email = row.Email.replace("@", " at ");
    mark(summary, "emails written as words");
  }
  if (rowNumber % 17 === 0) {
    row.Email = row.Email.replace(".com", "com");
    row.Phone = row.Phone.replace(/\d(?=\D*$)/, "X");
    mark(summary, "broken emails and phones");
  }
  if (rowNumber % 19 === 0) {
    row.Email = `${row.Email}; backup.${rowNumber}@mail.test`;
    row.Phone = `${row.Phone} / +1 202 555 0199`;
    mark(summary, "multiple values in one cell");
  }
  if (rowNumber % 23 === 0) {
    row["Birth Date"] = pick(["31/02/2022", "2024-13-01", "Feb 30, 2023", "00/00/0000"], random);
    row["Signup Date"] = pick(["yesterday", "Spring 2020", "ASAP", "9999-99-99"], random);
    mark(summary, "impossible and vague dates");
  }
  if (rowNumber % 29 === 0) {
    row.Age = pick(["twenty nine", "-4", "999", row["Birth Date"]], random);
    mark(summary, "nonsensical ages");
  }
  if (rowNumber % 31 === 0) {
    row.Quantity = pick(["two", `${row.Quantity} pcs`, `${row.Quantity}.5`, "-1"], random);
    row["Unit Price"] = pick(["free", "ask manager", "$1O.99", "about twenty"], random);
    mark(summary, "numbers mixed with words");
  }
  if (rowNumber % 37 === 0) {
    row.Discount = pick(["110%", "-20%", "half", "BOGO"], random);
    row.Tax = pick(["included", "TBD", "tax free?", "-5%"], random);
    mark(summary, "nonsensical percentages");
  }
  if (rowNumber % 41 === 0) {
    const numericTotal = Number(String(row["Order Total"]).replace(/[^0-9.-]/g, ""));
    row["Order Total"] = Number.isFinite(numericTotal) ? (numericTotal + 73.41).toFixed(2) : "TOTAL??";
    mark(summary, "conflicting calculations");
  }
  if (rowNumber % 43 === 0) {
    row.Status = pick(["activ", "Closed-ish", "DO NOT USE", "3", "pending???"], random);
    row.Segment = pick(["V.I.P", "consumer ", "SMB/Enterprise", "other???"], random);
    row.Paid = pick(["maybe", "partly", "cash", "2"], random);
    mark(summary, "category drift");
  }
  if (rowNumber % 47 === 0) {
    const marker = pick(MISSING_MARKERS, random);
    for (const column of pick([
      ["Email", "Phone"],
      ["Birth Date", "Age"],
      ["Quantity", "Order Total"],
      ["Country", "Postal Code"],
    ], random)) {
      row[column] = marker;
    }
    mark(summary, "inconsistent missing markers");
  }
  if (rowNumber % 53 === 0) {
    [row.Email, row.Phone] = [row.Phone, row.Email];
    mark(summary, "email and phone swapped");
  }
  if (rowNumber % 59 === 0) {
    [row.Country, row.City] = [row.City, row.Country];
    mark(summary, "country and city swapped");
  }
  if (rowNumber % 61 === 0) {
    [row["Signup Date"], row["Order Date"]] = [row["Order Date"], row["Signup Date"]];
    mark(summary, "date columns swapped");
  }
  if (rowNumber % 67 === 0) {
    row.Email = `<${row.Email.toUpperCase()}>`;
    row.Phone = `Tel ${row.Phone} ext. ${100 + (rowNumber % 900)}`;
    mark(summary, "wrapped contact values");
  }
  if (rowNumber % 71 === 0) {
    row["Customer Name"] = row["Customer Name"].replace("José", "JosÃ©").replace("Müller", "MÃ¼ller").replace("Björn", "BjÃ¶rn");
    row.Notes = "Imported from old system: â€œverifiedâ€";
    mark(summary, "mojibake text");
  }
  if (rowNumber % 73 === 0) {
    row.Notes = `Customer called twice, then wrote:\n\"please don't call me again\"\nStatus in CRM says active`;
    row["Shipping Address"] = row["Shipping Address"].replaceAll(" | ", "\n");
    mark(summary, "quoted multiline cells");
  }
  if (rowNumber % 79 === 0) {
    row["Customer Name"] = `${row["Customer Name"].split(/\s+/).at(-1)}, ${row["Customer Name"].trim().split(/\s+/)[0]}`;
    mark(summary, "reversed names");
  }
  if (rowNumber % 83 === 0) {
    row["Customer Name"] = `Dr. ${row["Customer Name"].toUpperCase()} Jr.`;
    row.Item = `${row.Item} (old name: ${row.SKU})`;
    mark(summary, "labels embedded in values");
  }
  if (rowNumber % 89 === 0) {
    row["Customer Ref"] = row["Customer Ref"].replace("CU-", "").replace(/^0+/, "");
    row["Order Ref"] = `${row["Order Ref"]}.0`;
    row.SKU = row.SKU.toLowerCase().replace("-", " ");
    mark(summary, "identifier format drift");
  }
  if (rowNumber % 97 === 0) {
    row.Currency = pick(["$", "SR", "pounds", "EURO", "???"], random);
    row["Account Balance"] = pick(["(1,200.50)", "credit", "-", "1.2e3", "O.00"], random);
    mark(summary, "currency and balance chaos");
  }
  if (rowNumber % 101 === 0) {
    row.Email = `${row.Email} | ${row.Phone}`;
    row.Phone = "see email field";
    mark(summary, "combined contact fields");
  }
  if (rowNumber % 103 === 0) {
    row["Postal Code"] = Number.parseInt(row["Postal Code"], 10).toString();
    row["Row Key"] = ` ${row["Row Key"].toLowerCase()} `;
    mark(summary, "leading zeros and key drift");
  }
  if (rowNumber % 107 === 0) {
    row["Order Date"] = pick(["03/04/05", "04/03/05", "01/02/03"], random);
    mark(summary, "ambiguous dates");
  }
  if (rowNumber % 109 === 0) {
    row.Quantity = "";
    row["Unit Price"] = "0";
    row["Order Total"] = "0";
    mark(summary, "division by zero rows");
  }
  if (rowNumber % 113 === 0) {
    row["Source System"] = "manual-ish export v2 FINAL final";
    row["Customer Ref"] = "???";
    row.Item = "misc";
    row.Notes = "Nobody knows what this row means";
    mark(summary, "meaningless manual rows");
  }
  if (rowNumber % 127 === 0) {
    row["Customer Name"] = "TEST TEST";
    row.Email = "test@test";
    row.Phone = "123";
    row.Status = "DELETE?";
    row.Notes = "training row accidentally exported to production";
    mark(summary, "test records in production");
  }
}

export function generateDatasetFromHell(rowCount = 8000, seed = 666) {
  if (!Number.isInteger(rowCount) || rowCount < 1) throw new Error("Row count must be a positive integer");
  if (!Number.isInteger(seed)) throw new Error("Seed must be an integer");

  const random = createRandom(seed);
  const customers = buildCustomers(Math.max(40, Math.ceil(rowCount / 7)), random);
  const rows = [];
  const summary = {};

  for (let index = 0; index < rowCount; index += 1) {
    const rowNumber = index + 1;
    let row = makeBaseRow(index, customers, random);
    corruptRow(row, rowNumber, random, summary);

    if (rowNumber % 173 === 0 && rows.length > 20) {
      row = { ...rows[rows.length - 17] };
      mark(summary, "exact duplicate exports");
    } else if (rowNumber % 179 === 0 && rows.length > 20) {
      row = { ...rows[rows.length - 19] };
      row["Row Key"] = ` ${row["Row Key"].toLowerCase()} `;
      row["Customer Name"] = ` ${row["Customer Name"].toUpperCase()} `;
      row.Email = row.Email.toUpperCase();
      row.Phone = row.Phone.replaceAll(" ", "");
      mark(summary, "near duplicate exports");
    }

    rows.push(row);
  }

  return { rows, summary };
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows) {
  const lines = [HEADERS.map(escapeCsv).join(",")];
  for (const row of rows) lines.push(HEADERS.map((header) => escapeCsv(row[header])).join(","));
  return `${lines.join("\n")}\n`;
}

function parseArguments(argv) {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const options = {
    rows: 8000,
    seed: 666,
    output: resolve(scriptDirectory, "../test-data/dataset_from_hell.csv"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (!["--rows", "--seed", "--output"].includes(argument)) throw new Error(`Unknown option: ${argument}`);
    if (!value) throw new Error(`${argument} requires a value`);
    if (argument === "--rows") options.rows = Number(value);
    if (argument === "--seed") options.seed = Number(value);
    if (argument === "--output") options.output = resolve(value);
    index += 1;
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { rows, summary } = generateDatasetFromHell(options.rows, options.seed);
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, toCsv(rows), "utf8");

  console.log(`Wrote ${rows.length.toLocaleString()} rows to ${options.output}`);
  console.log(`Seed: ${options.seed}`);
  console.log("Injected chaos (cases overlap):");
  for (const [name, count] of Object.entries(summary)) console.log(`  ${name}: ${count.toLocaleString()}`);
}

const isMainModule = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMainModule) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
