const HELL_TOOL_ACCESS = {
  cleaningTools: [
    "fillIssues",
    "findReplace",
    "missingValues",
    "duplicates",
    "textCleanup",
    "manageColumns",
  ],
};

const LOCALE_FINAL_COLUMNS = [
  "Record ID",
  "Region",
  "Currency",
  "Sale Date",
  "Settlement Date",
  "Gross Amount",
  "FX Rate",
  "Fee Percent",
  "Base Amount",
  "Processing Fee",
  "Net Amount",
];

const SCHEMA_FINAL_COLUMNS = [
  "Archive Blob",
  "Person Blob",
  "Region",
  "Department",
  "Serial",
  "Last Name",
  "First Name",
  "Display Name",
  "Street",
  "City",
  "Country",
  "Location",
];

const MANIFEST_FINAL_COLUMNS = [
  "Manifest ID",
  "Truck",
  "Dispatch Date",
  "Driver Email",
  "Route Blob",
  "Origin",
  "Destination",
  "Route Label",
  "Status",
  "Distance KM",
  "Fuel Used",
  "Cargo KG",
  "Packaging KG",
  "Damaged KG",
  "Gross Load",
  "Fuel Efficiency",
  "Chargeable Load",
];

export const HELL_CHALLENGES = [
  {
    id: "hell-locale-collision",
    revision: 1,
    number: 1,
    pack: "hell",
    packOrder: 1,
    title: "L0C4L3//C0LL1S10N",
    subtitle: "DATE_FORMAT_NOT_FOUND ████ CALENDAR STILL RUNNING",
    difficulty: "NIGHTMARE",
    preview: [
      "[03:14:08] THE MONTH FIELD HAS SPLIT INTO THREE",
      "€ $ SAR ████ VALUE ACCEPTED // MEANING REJECTED",
    ],
    rowCount: 2400,
    accent: "hell-red",
    story: [
      "[03:14:08] LOCALE MERGE ACCEPTED // 3 CALENDARS ENTERED",
      "[03:14:09] DAY IS MONTH // MONTH IS ████ // YEAR DENIES INVOLVEMENT",
      "[03:14:10] DO NOT TRUST THE SECOND SLASH",
    ],
    hints: [
      "Sale Date uses MM/DD/YYYY and Settlement Date uses DD/MM/YYYY before both become YYYY-MM-DD",
      "Hide the other columns while removing currency symbols and commas from Gross Amount",
      "Build Base Amount first then Processing Fee and Net Amount",
    ],
    assistant: {
      start: "The dates are arguing about which number is the month and I am staying out of it",
      noProgress: "Nothing moved and three regional managers just replied all",
      win: "Every office now agrees what a date is which may be a company first",
    },
    office: createOffice(
      "Rami",
      "Regional finance",
      "The payment export merged itself into one giant cultural disagreement",
      "The locale pile still has {{issueLabel}}",
      "{{objective}} is fixed and one office has stopped yelling",
      "The visible formats look clean so check the calculated amounts",
      "The exchange report works again and nobody is allowed to change their laptop region",
    ),
    objectives: [
      { id: "locale-id", title: "Repair every regional record ID", kind: "patternMatch", column: "Record ID", expectedType: "Text", pattern: "^(EU|US|GCC)-[0-9]{5}$" },
      { id: "locale-dates", title: "Put both date columns into YYYY-MM-DD", kind: "scanClean", columns: ["Sale Date", "Settlement Date"], expectedTypes: { "Sale Date": "Date", "Settlement Date": "Date" } },
      { id: "locale-currency", title: "Reduce Currency to three real choices", kind: "allowedValues", column: "Currency", expectedType: "Category", values: ["EUR", "USD", "SAR"] },
      { id: "locale-region", title: "Repair the Region choices", kind: "allowedValues", column: "Region", expectedType: "Category", values: ["Europe", "United States", "Gulf"] },
      { id: "locale-numbers", title: "Clean the imported money fields", kind: "scanClean", columns: ["Gross Amount", "FX Rate", "Fee Percent"], expectedTypes: { "Gross Amount": "Number", "FX Rate": "Number", "Fee Percent": "Number" } },
      { id: "locale-base", title: "Calculate Base Amount", kind: "calculatedColumn", target: "Base Amount", expectedType: "Number", formula: "[Gross Amount] / [FX Rate]", tolerance: 0.02 },
      { id: "locale-fee", title: "Calculate Processing Fee", kind: "calculatedColumn", target: "Processing Fee", expectedType: "Number", formula: "[Gross Amount] * [Fee Percent] / 100", tolerance: 0.02 },
      { id: "locale-net", title: "Calculate Net Amount", kind: "calculatedColumn", target: "Net Amount", expectedType: "Number", formula: "[Gross Amount] - [Processing Fee]", tolerance: 0.02 },
      { id: "locale-schema", title: "Remove the legacy date and finish the export order", kind: "exportSchema", removedColumns: ["Legacy Date"], expectedColumns: LOCALE_FINAL_COLUMNS },
    ],
    rules: [{ id: "locale-rows", title: "Keep every payment record", kind: "rowCount", minimum: 2400, maximum: 2400 }],
    toolAccess: HELL_TOOL_ACCESS,
    createRows: createLocaleRows,
  },
  {
    id: "hell-identity-crisis",
    revision: 1,
    number: 2,
    pack: "hell",
    packOrder: 2,
    title: "1D3NT1TY_[DUPLICATED]",
    subtitle: "THERE ARE TWO OF YOU // ONE IS STILL TYPING",
    difficulty: "NIGHTMARE",
    preview: [
      "CONTACT_001 CLAIMS CONTACT_001 DOES NOT EXIST",
      "NAME NAME N4ME █████@████ PHONE ANSWERED ITSELF",
    ],
    rowCount: 3200,
    accent: "hell-cyan",
    story: [
      "[DUPLICATE SCAN] 3040 PEOPLE FOUND // 3200 PEOPLE RESPONDED",
      "[VOICE MATCH] SAME MOUTH // DIFFERENT PHONE // BOTH LINES OPEN",
      "DELETE THE COPY ████ DO NOT ASK WHICH ONE",
    ],
    hints: [
      "Normalize Full Name and Email before looking for duplicates",
      "Phone can be genuinely empty after NULL and N/A are configured as missing markers",
      "Compare Email and Phone together when removing duplicates",
    ],
    assistant: {
      start: "Several customers have two identities and one of them has four",
      noProgress: "The contacts remain spiritually unique and technically duplicated",
      win: "Every person has returned to one identity which is enough paperwork for today",
    },
    office: createOffice(
      "Lina",
      "Marketing",
      "The giveaway leads are multiplying and we only ran one giveaway",
      "The contact pile still has {{issueLabel}}",
      "{{objective}} is fixed and the mailing list got slightly cheaper",
      "The visible contacts pass but duplicates may still be wearing disguises",
      "The list is usable and we have thrown the signup napkin away",
    ),
    objectives: [
      { id: "identity-id", title: "Repair every Contact ID", kind: "patternMatch", column: "Contact ID", expectedType: "Text", pattern: "^CONTACT-[A-Z]{2}-[0-9]{5}$" },
      { id: "identity-name", title: "Clean the Full Name spacing and casing", kind: "textNormalized", column: "Full Name", trimEdges: true, collapseWhitespace: true, caseMode: "title" },
      { id: "identity-email", title: "Repair every Email", kind: "scanClean", columns: ["Email"], expectedType: "Email" },
      { id: "identity-phone", title: "Repair every supplied Phone", kind: "scanClean", columns: ["Phone"], expectedType: "Phone" },
      { id: "identity-phone-policy", title: "Allow genuinely missing phones", kind: "missingPolicy", column: "Phone", policy: "allowed", tokens: ["NULL", "N/A"] },
      { id: "identity-country", title: "Repair the Country choices", kind: "allowedValues", column: "Country", expectedType: "Category", values: ["Saudi Arabia", "United States", "Germany", "Japan"] },
      { id: "identity-source", title: "Repair the Source choices", kind: "allowedValues", column: "Source", expectedType: "Category", values: ["Event", "Website", "Referral", "Paper Form"] },
      { id: "identity-split", title: "Split Full Name into First Name and Last Name", kind: "transformedColumns", operation: "split", source: "Full Name", outputs: ["First Name", "Last Name"], separator: "whitespace" },
      { id: "identity-label", title: "Build the Contact Label", kind: "transformedColumns", operation: "combine", sources: ["Last Name", "First Name"], target: "Contact Label", separator: ", " },
      { id: "identity-unique", title: "Remove duplicate people", kind: "unique", columns: ["Email", "Phone"] },
    ],
    rules: [{ id: "identity-rows", title: "Finish with one copy of every contact", kind: "rowCount", minimum: 3040, maximum: 3040 }],
    toolAccess: HELL_TOOL_ACCESS,
    createRows: createIdentityRows,
  },
  {
    id: "hell-accounting-crime-scene",
    revision: 1,
    number: 3,
    pack: "hell",
    packOrder: 3,
    title: "ACC0UNT1NG ████ SC3N3",
    subtitle: "THE TOTAL CHANGED WHILE YOU WERE READING IT",
    difficulty: "NIGHTMARE",
    preview: [
      "LABOR = HOURS × RATE // HOURS = ████ // LABOR STILL KNOWS",
      "SUBTOTAL > DISCOUNT > TAX > DUE // BREAK THE ORDER AND IT BREAKS BACK",
    ],
    rowCount: 4000,
    accent: "hell-orange",
    story: [
      "[CALCULATION STARTED] [CALCULATION STARTED] [CALCULATION STARTED]",
      "HOURS MISSING // LABOR PRESENT // SOMETHING WORKED THE SHIFT",
      "THE LAST TOTAL IS WAITING FOR THE FIRST TOTAL TO REMEMBER",
    ],
    hints: [
      "Hours can be recovered with Labor Cost divided by Hourly Rate",
      "Repair Labor Cost before Subtotal then Discount Amount before Tax Amount",
      "Amount Due is Subtotal minus Discount Amount plus Tax Amount minus Refund",
    ],
    assistant: {
      start: "The totals all look professional and that is the most dangerous part",
      noProgress: "Accounting has confirmed the numbers are still numbers",
      win: "The invoices add up and the refund button has been placed under supervision",
    },
    office: createOffice(
      "Noura",
      "Accounting",
      "Please treat the invoice file like a crime scene because it basically is one",
      "The ledger still has {{issueLabel}}",
      "{{objective}} is fixed and one calculator has been retired",
      "The visible numbers pass so check the formula order",
      "The invoices balance and nobody needs to fake a power outage",
    ),
    objectives: [
      { id: "accounting-id", title: "Repair every Billing Case ID", kind: "patternMatch", column: "Billing Case ID", expectedType: "Text", pattern: "^BILL-[0-9]{6}$" },
      { id: "accounting-numbers", title: "Clean every billing number", kind: "scanClean", columns: ["Hours", "Hourly Rate", "Labor Cost", "Parts Cost", "Subtotal", "Discount Percent", "Discount Amount", "Tax Percent", "Tax Amount", "Refund", "Amount Due"], expectedTypes: billingNumberTypes() },
      { id: "accounting-labor", title: "Make every Labor Cost add up", kind: "calculatedColumn", target: "Labor Cost", expectedType: "Number", formula: "[Hours] * [Hourly Rate]", tolerance: 0.02 },
      { id: "accounting-subtotal", title: "Make every Subtotal add up", kind: "calculatedColumn", target: "Subtotal", expectedType: "Number", formula: "[Labor Cost] + [Parts Cost]", tolerance: 0.02 },
      { id: "accounting-discount", title: "Calculate every Discount Amount", kind: "calculatedColumn", target: "Discount Amount", expectedType: "Number", formula: "[Subtotal] * [Discount Percent] / 100", tolerance: 0.02 },
      { id: "accounting-tax", title: "Calculate tax after the discount", kind: "calculatedColumn", target: "Tax Amount", expectedType: "Number", formula: "([Subtotal] - [Discount Amount]) * [Tax Percent] / 100", tolerance: 0.02 },
      { id: "accounting-due", title: "Calculate every Amount Due", kind: "calculatedColumn", target: "Amount Due", expectedType: "Number", formula: "[Subtotal] - [Discount Amount] + [Tax Amount] - [Refund]", tolerance: 0.02 },
      { id: "accounting-complete", title: "Recover every missing billing value", kind: "noMissing", columns: ["Hours", "Labor Cost", "Subtotal", "Discount Amount", "Tax Amount", "Amount Due"] },
      { id: "accounting-legacy", title: "Delete Legacy Quote", kind: "columnsAbsent", columns: ["Legacy Quote"] },
    ],
    rules: [{ id: "accounting-rows", title: "Keep every billing case", kind: "rowCount", minimum: 4000, maximum: 4000 }],
    toolAccess: HELL_TOOL_ACCESS,
    createRows: createAccountingRows,
  },
  {
    id: "hell-schema-graveyard",
    revision: 1,
    number: 4,
    pack: "hell",
    packOrder: 4,
    title: "SCH3M4_GR4V3Y4RD",
    subtitle: "COLUMNS BURIED VERTICALLY // ROWS REFUSE TO LEAVE",
    difficulty: "NIGHTMARE",
    preview: [
      "ARCHIVE/BLOB/████ CONTAINS MORE COLUMNS THAN THE TABLE",
      "FINAL ORDER REQUIRED // ORDER FILE ███████████",
    ],
    rowCount: 1800,
    accent: "hell-purple",
    story: [
      "[MIGRATION COMPLETE] OUTPUT EXISTS // STRUCTURE DOES NOT",
      "FIRST NAME FOUND INSIDE LAST NAME FOUND INSIDE █████████",
      "PUT THE COLUMNS BACK BEFORE THE BLOB CLOSES",
    ],
    hints: [
      "Archive Blob splits on / and Person Blob splits on a comma",
      "Build Display Name from First Name and Last Name then Location from City and Country",
      "Use Manage Columns to drag the final columns into the required order",
    ],
    assistant: {
      start: "The database has been compressed into two columns and one bad decision",
      noProgress: "The schema remains buried and the migration report still says success",
      win: "The archive has columns again and the migration report has been deleted",
    },
    office: createOffice(
      "Maya",
      "Records",
      "The archive migration says success and I need you to ignore that",
      "The rebuilt archive still has {{issueLabel}}",
      "{{objective}} is fixed and one field has escaped the blob",
      "The visible values pass so inspect the final schema order",
      "The archive looks like a table again which is a huge improvement",
    ),
    objectives: [
      { id: "schema-archive", title: "Split Archive Blob", kind: "transformedColumns", operation: "split", source: "Archive Blob", outputs: ["Region", "Department", "Serial"], separator: "/" },
      { id: "schema-person", title: "Split Person Blob", kind: "transformedColumns", operation: "split", source: "Person Blob", outputs: ["Last Name", "First Name"], separator: "," },
      { id: "schema-first", title: "Clean First Name", kind: "textNormalized", column: "First Name", trimEdges: true, collapseWhitespace: true, caseMode: "title" },
      { id: "schema-last", title: "Clean Last Name", kind: "textNormalized", column: "Last Name", trimEdges: true, collapseWhitespace: true, caseMode: "title" },
      { id: "schema-display", title: "Build Display Name", kind: "transformedColumns", operation: "combine", sources: ["First Name", "Last Name"], target: "Display Name", separator: " " },
      { id: "schema-location", title: "Build Location", kind: "transformedColumns", operation: "combine", sources: ["City", "Country"], target: "Location", separator: ", " },
      { id: "schema-department", title: "Repair Department choices", kind: "allowedValues", column: "Department", expectedType: "Category", values: ["FIN", "OPS", "HR", "ENG"] },
      { id: "schema-region", title: "Repair Region choices", kind: "allowedValues", column: "Region", expectedType: "Category", values: ["ME", "EU", "NA", "AP"] },
      {
        id: "schema-export",
        title: "Finish the archive schema",
        kind: "exportSchema",
        transforms: [
          { operation: "split", source: "Archive Blob", outputs: ["Region", "Department", "Serial"], separator: "/" },
          { operation: "split", source: "Person Blob", outputs: ["Last Name", "First Name"], separator: "," },
          { operation: "combine", sources: ["First Name", "Last Name"], target: "Display Name", separator: " " },
          { operation: "combine", sources: ["City", "Country"], target: "Location", separator: ", " },
        ],
        removedColumns: ["Old Label", "Temp Import", "Migration Comment"],
        expectedColumns: SCHEMA_FINAL_COLUMNS,
      },
    ],
    rules: [{ id: "schema-rows", title: "Keep every archive record", kind: "rowCount", minimum: 1800, maximum: 1800 }],
    toolAccess: HELL_TOOL_ACCESS,
    createRows: createSchemaRows,
  },
  {
    id: "hell-missing-value-cult",
    revision: 1,
    number: 5,
    pack: "hell",
    packOrder: 5,
    title: "NULL_NULL_NULL_████",
    subtitle: "THE BLANKS ARE ORGANIZED // THE BLANKS EXPECT YOU",
    difficulty: "NIGHTMARE",
    preview: [
      "EMPTY ≠ EMPTY ≠ EMPTY // EACH GAP WANTS A DIFFERENT ANSWER",
      "6000 ROWS ENTERED // DELETION PERMISSION █████ DENIED",
    ],
    rowCount: 6000,
    accent: "hell-green",
    story: [
      "[NULL PATTERN DETECTED] IT IS REPEATING ON PURPOSE",
      "AVERAGE MEDIAN MODE PREVIOUS DISTRIBUTION // CHOOSE WRONG AND IT SPREADS",
      "DO NOT DELETE THE EMPTY ROWS // THEY ARE COUNTING YOU TOO",
    ],
    hints: [
      "Temperature uses Average inside Machine groups and Pressure uses Median inside Shift groups",
      "Operator uses Most Common Value inside Machine groups",
      "Condition uses Current Distribution and Recorded At uses Previous Valid Value ordered by Reading ID inside Machine groups",
    ],
    assistant: {
      start: "The missing values have formed patterns and I do not like organized blanks",
      noProgress: "The blanks remain in formation",
      win: "Every reading is back and the missing value cult has lost its membership list",
    },
    office: createOffice(
      "Omar",
      "Sensor audit",
      "Do not delete anything because the inspectors counted every row",
      "The audit still has {{issueLabel}}",
      "{{objective}} is fixed and the inspectors crossed out one complaint",
      "The visible readings pass so verify every filling method",
      "The audit is complete and all six thousand rows survived",
    ),
    objectives: [
      { id: "missing-id", title: "Repair every Reading ID", kind: "patternMatch", column: "Reading ID", expectedType: "Text", pattern: "^READ-[0-9]{6}$" },
      { id: "missing-machine", title: "Repair the Machine choices", kind: "allowedValues", column: "Machine", expectedType: "Category", values: ["Mixer", "Press", "Cutter", "Kiln"] },
      { id: "missing-shift", title: "Repair the Shift choices", kind: "allowedValues", column: "Shift", expectedType: "Category", values: ["Morning", "Evening", "Night"] },
      { id: "missing-temperature", title: "Fill Temperature with each Machine average", kind: "fillContract", idColumn: "Reading ID", column: "Temperature", expectedType: "Number", method: "average", groupBy: "Machine", tolerance: 0.01 },
      { id: "missing-pressure", title: "Fill Pressure with each Shift median", kind: "fillContract", idColumn: "Reading ID", column: "Pressure", expectedType: "Number", method: "median", groupBy: "Shift", tolerance: 0.01 },
      { id: "missing-operator", title: "Fill Operator with each Machine mode", kind: "fillContract", idColumn: "Reading ID", column: "Operator", expectedType: "Category", method: "mode", groupBy: "Machine" },
      { id: "missing-condition", title: "Preserve the Condition distribution", kind: "fillContract", idColumn: "Reading ID", column: "Condition", expectedType: "Category", method: "distribution" },
      { id: "missing-time", title: "Carry the previous timestamp within each Machine", kind: "fillContract", idColumn: "Reading ID", column: "Recorded At", expectedType: "Date", method: "previous", groupBy: "Machine", orderBy: "Reading ID" },
      { id: "missing-comment", title: "Allow empty inspector comments", kind: "missingPolicy", column: "Inspector Comment", policy: "allowed", tokens: ["N/A"] },
      { id: "missing-complete", title: "Recover every required reading", kind: "noMissing", columns: ["Temperature", "Pressure", "Operator", "Condition", "Recorded At"] },
    ],
    rules: [{ id: "missing-rows", title: "Keep all six thousand readings", kind: "rowCount", minimum: 6000, maximum: 6000 }],
    toolAccess: HELL_TOOL_ACCESS,
    createRows: createMissingRows,
  },
  {
    id: "hell-everything-is-fine",
    revision: 1,
    number: 6,
    pack: "hell",
    packOrder: 6,
    title: "EVERYTHING_IS_F1N3 :)",
    subtitle: "ERROR COLUMN DELETED // ERROR COUNT NOW ZERO",
    difficulty: "NIGHTMARE",
    preview: [
      "TRUCK MOVED 700 KM // FUEL USED 0 // STATUS PERFECT",
      "MANIFEST MANIFEST MAN1FEST ████ ALL CHECKS PASSED",
    ],
    rowCount: 8000,
    accent: "hell-red",
    story: [
      "[HEALTH CHECK] ERROR COLUMN NOT FOUND // ASSUMING NO ERRORS",
      "[TRIP COMPLETE] 0.00 FUEL USED // DRIVER EMAIL STILL SCREAMING",
      "EVERYTHING IS FINE EVERYTHING IS FINE EVERYTHING IS ████",
    ],
    hints: [
      "Fuel Used must be a positive Number because zero breaks Fuel Efficiency",
      "Split Route Blob on > then combine Origin and Destination with an arrow",
      "Remove duplicate Manifest IDs and the impossible zero fuel trips before matching the final row count",
    ],
    assistant: {
      start: "The system says everything is fine and that is usually when we should run",
      noProgress: "Everything remains fine according to the machine that caused this",
      win: "The manifest is actually fine and the system has lost permission to grade itself",
    },
    office: createOffice(
      "Sara",
      "Logistics",
      "The shipping system gave itself a perfect score and I need a second opinion",
      "The manifest still has {{issueLabel}}",
      "{{objective}} is fixed and one truck has admitted it used fuel",
      "The visible values pass so check formulas duplicates and schema",
      "The manifest is clean and the self review feature has been disabled",
    ),
    objectives: [
      { id: "fine-id", title: "Repair every Manifest ID", kind: "patternMatch", column: "Manifest ID", expectedType: "Text", pattern: "^MAN-[0-9]{7}$" },
      { id: "fine-date", title: "Repair every Dispatch Date", kind: "scanClean", columns: ["Dispatch Date"], expectedType: "Date" },
      { id: "fine-email", title: "Repair every Driver Email", kind: "scanClean", columns: ["Driver Email"], expectedType: "Email" },
      { id: "fine-categories", title: "Repair Truck and Status choices", kind: "types", expected: { Truck: "Category", Status: "Category" } },
      { id: "fine-truck", title: "Reduce Truck to four real choices", kind: "allowedValues", column: "Truck", expectedType: "Category", values: ["Atlas", "Comet", "Mantis", "Rook"] },
      { id: "fine-status", title: "Reduce Status to three real choices", kind: "allowedValues", column: "Status", expectedType: "Category", values: ["Delivered", "Delayed", "Returned"] },
      {
        id: "fine-fuel-contract",
        title: "Reject zero fuel trips",
        kind: "validationContract",
        checks: [
          {
            column: "Fuel Used",
            type: "Number",
            mode: "customRegex",
            matchMode: "full",
            validSamples: ["1", "42.50", "0.25"],
            invalidSamples: ["0", "0.00", "-4", "none"],
          },
        ],
      },
      { id: "fine-numbers", title: "Clean the shipping numbers", kind: "scanClean", columns: ["Distance KM", "Fuel Used", "Cargo KG", "Packaging KG", "Damaged KG"], expectedTypes: shippingNumberTypes() },
      { id: "fine-route", title: "Split Route Blob", kind: "transformedColumns", operation: "split", source: "Route Blob", outputs: ["Origin", "Destination"], separator: ">" },
      { id: "fine-label", title: "Build Route Label", kind: "transformedColumns", operation: "combine", sources: ["Origin", "Destination"], target: "Route Label", separator: " -> " },
      { id: "fine-gross", title: "Calculate Gross Load", kind: "calculatedColumn", target: "Gross Load", expectedType: "Number", formula: "[Cargo KG] + [Packaging KG]", tolerance: 0.02 },
      { id: "fine-efficiency", title: "Calculate Fuel Efficiency", kind: "calculatedColumn", target: "Fuel Efficiency", expectedType: "Number", formula: "[Distance KM] / [Fuel Used]", tolerance: 0.02 },
      { id: "fine-chargeable", title: "Calculate Chargeable Load", kind: "calculatedColumn", target: "Chargeable Load", expectedType: "Number", formula: "[Gross Load] - [Damaged KG]", tolerance: 0.02 },
      { id: "fine-unique", title: "Remove duplicate manifests", kind: "unique", columns: ["Manifest ID"] },
      {
        id: "fine-export",
        title: "Prepare the final manifest layout",
        kind: "exportSchema",
        transforms: [
          { operation: "split", source: "Route Blob", outputs: ["Origin", "Destination"], separator: ">" },
          { operation: "combine", sources: ["Origin", "Destination"], target: "Route Label", separator: " -> " },
        ],
        removedColumns: ["Ghost Total"],
        expectedColumns: MANIFEST_FINAL_COLUMNS,
      },
    ],
    rules: [{ id: "fine-rows", title: "Keep every believable trip", kind: "rowCount", minimum: 7800, maximum: 7800 }],
    toolAccess: HELL_TOOL_ACCESS,
    createRows: createManifestRows,
  },
];

function createLocaleRows() {
  const regions = [
    { name: "Europe", code: "EU", currency: "EUR", symbol: "€", fx: 0.92 },
    { name: "United States", code: "US", currency: "USD", symbol: "$", fx: 1 },
    { name: "Gulf", code: "GCC", currency: "SAR", symbol: "SAR ", fx: 3.75 },
  ];
  return Array.from({ length: 2400 }, (_, index) => {
    const region = regions[index % regions.length];
    const month = index % 12 + 1;
    const day = index % 27 + 1;
    const gross = 500 + index % 41 * 27.5;
    const row = {
      "Record ID": `${region.code}-${String(index + 1).padStart(5, "0")}`,
      Region: region.name,
      Currency: region.currency,
      "Sale Date": `${pad(month)}/${pad(day)}/2026`,
      "Settlement Date": `${pad(Math.min(28, day + 1))}/${pad(month)}/2026`,
      "Gross Amount": `${region.symbol}${gross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      "FX Rate": String(region.fx),
      "Fee Percent": String([1.5, 2, 2.5, 3][index % 4]),
      "Legacy Date": `${day}.${month}.26`,
    };
    if (index % 211 === 7) row["Record ID"] = row["Record ID"].replace("-", "_");
    if (index % 173 === 11) row.Region = ` ${row.Region.toUpperCase()} `;
    if (index % 181 === 13) row.Currency = row.Currency.toLowerCase();
    if (index % 199 === 17) row["Sale Date"] = "";
    if (index % 227 === 19) row["Settlement Date"] = "tomorrow";
    if (index % 239 === 23) row["FX Rate"] = "rate pending";
    return row;
  });
}

function createIdentityRows() {
  const firstNames = ["Maya", "Omar", "Lina", "Noor", "Alex", "Kenji", "Hattan", "Sara"];
  const lastNames = ["Stone", "Saleh", "Khan", "Aziz", "Martin", "Sato", "Siraj", "Miller"];
  const countries = ["Saudi Arabia", "United States", "Germany", "Japan"];
  const sources = ["Event", "Website", "Referral", "Paper Form"];
  const base = Array.from({ length: 3040 }, (_, index) => {
    const first = firstNames[index % firstNames.length];
    const last = lastNames[(index * 3) % lastNames.length];
    const phone = index % 17 === 4 ? "" : `+966 55 ${String(1000000 + index).slice(-7)}`;
    const row = {
      "Contact ID": `CONTACT-${["SA", "US", "DE", "JP"][index % 4]}-${String(index + 1).padStart(5, "0")}`,
      "Full Name": `${first} ${last}`,
      Email: `${first}.${last}.${index}@example.com`.toLowerCase(),
      Phone: phone,
      Country: countries[index % countries.length],
      Source: sources[index % sources.length],
    };
    if (index % 83 === 5) row["Full Name"] = `  ${row["Full Name"].toUpperCase()}  `;
    if (index % 97 === 7) row.Email = row.Email.replace("@", " at ");
    if (index % 109 === 9) row.Phone = "NULL";
    if (index % 127 === 11) row.Phone = "N/A";
    if (index % 139 === 13) row.Phone = "123";
    if (index % 151 === 17) row.Country = ` ${row.Country.toUpperCase()} `;
    if (index % 163 === 19) row.Source = row.Source.toLowerCase();
    if (index % 179 === 23) row["Contact ID"] = row["Contact ID"].replaceAll("-", "_");
    return row;
  });
  const duplicates = base.slice(0, 160).map((row, index) => ({
    ...row,
    "Contact ID": `CONTACT-DU-${String(index + 1).padStart(5, "0")}`,
    "Full Name": ` ${row["Full Name"].toUpperCase()} `,
    Email: row.Email.toUpperCase(),
  }));
  return [...base, ...duplicates];
}

function createAccountingRows() {
  return Array.from({ length: 4000 }, (_, index) => {
    const hours = 1 + index % 12;
    const rate = 45 + index % 8 * 5;
    const labor = hours * rate;
    const parts = 20 + index % 17 * 8;
    const subtotal = labor + parts;
    const discountPercent = [0, 5, 10, 15][index % 4];
    const discount = subtotal * discountPercent / 100;
    const taxPercent = [5, 10, 15][index % 3];
    const tax = (subtotal - discount) * taxPercent / 100;
    const refund = index % 19 === 0 ? 25 : 0;
    const amountDue = subtotal - discount + tax - refund;
    const row = {
      "Billing Case ID": `BILL-${String(index + 1).padStart(6, "0")}`,
      Hours: String(hours),
      "Hourly Rate": rate.toFixed(2),
      "Labor Cost": labor.toFixed(2),
      "Parts Cost": parts.toFixed(2),
      Subtotal: subtotal.toFixed(2),
      "Discount Percent": String(discountPercent),
      "Discount Amount": discount.toFixed(2),
      "Tax Percent": String(taxPercent),
      "Tax Amount": tax.toFixed(2),
      Refund: refund.toFixed(2),
      "Amount Due": amountDue.toFixed(2),
      "Legacy Quote": (amountDue * 1.07).toFixed(2),
    };
    if (index % 89 === 3) row.Hours = "";
    else if (index % 97 === 5) row["Labor Cost"] = "";
    if (index % 103 === 7) row.Subtotal = "";
    if (index % 107 === 9) row["Discount Amount"] = "old formula";
    if (index % 109 === 11) row["Tax Amount"] = "";
    if (index % 113 === 13) row["Amount Due"] = (amountDue + 10).toFixed(2);
    if (index % 211 === 17) row["Billing Case ID"] = row["Billing Case ID"].replace("-", "/");
    return row;
  });
}

function createSchemaRows() {
  const firstNames = ["Maya", "Omar", "Lina", "Noor", "Alex", "Sara"];
  const lastNames = ["Stone", "Saleh", "Khan", "Aziz", "Martin", "Miller"];
  const regions = ["ME", "EU", "NA", "AP"];
  const departments = ["FIN", "OPS", "HR", "ENG"];
  const countries = ["Saudi Arabia", "Germany", "United States", "Japan"];
  const cities = ["Riyadh", "Berlin", "Austin", "Tokyo"];
  return Array.from({ length: 1800 }, (_, index) => {
    const first = firstNames[index % firstNames.length];
    const last = lastNames[(index * 5) % lastNames.length];
    const region = regions[index % regions.length];
    const department = departments[(index * 3) % departments.length];
    return {
      "Archive Blob": `${region}/${department}/${String(index + 1).padStart(6, "0")}`,
      "Person Blob": `${last},${first}`,
      Street: `${index % 220 + 1} Archive Road`,
      City: cities[index % cities.length],
      Country: countries[index % countries.length],
      "Old Label": `${last}_${index}`,
      "Temp Import": index % 2 ? "Y" : "N",
      "Migration Comment": "SUCCESS",
    };
  });
}

function createMissingRows() {
  const machines = ["Mixer", "Press", "Cutter", "Kiln"];
  const shifts = ["Morning", "Evening", "Night"];
  const operators = {
    Mixer: ["Maya", "Maya", "Omar"],
    Press: ["Sara", "Sara", "Lina"],
    Cutter: ["Noor", "Noor", "Alex"],
    Kiln: ["Hattan", "Hattan", "Kenji"],
  };
  const conditions = ["Stable", "Stable", "Watch", "Critical"];
  return Array.from({ length: 6000 }, (_, index) => {
    const machine = machines[index % machines.length];
    const shift = shifts[index % shifts.length];
    const day = index % 28 + 1;
    const row = {
      "Reading ID": `READ-${String(index + 1).padStart(6, "0")}`,
      Machine: machine,
      Shift: shift,
      "Recorded At": `2026-07-${pad(day)}`,
      Temperature: (35 + machines.indexOf(machine) * 12 + index % 9 * 0.5).toFixed(2),
      Pressure: (90 + shifts.indexOf(shift) * 18 + index % 11).toFixed(2),
      Operator: operators[machine][index % operators[machine].length],
      Condition: conditions[index % conditions.length],
      "Inspector Comment": index % 7 ? "" : "Checked",
    };
    if (index % 41 === 7) row.Temperature = "";
    if (index % 43 === 9) row.Pressure = "";
    if (index % 47 === 11) row.Operator = "";
    if (index % 53 === 13) row.Condition = "";
    if (index % 59 === 15) row["Recorded At"] = "";
    return row;
  });
}

function createManifestRows() {
  const trucks = ["Atlas", "Comet", "Mantis", "Rook"];
  const cities = ["Riyadh", "Jeddah", "Dammam", "Tabuk", "Abha"];
  const statuses = ["Delivered", "Delayed", "Returned"];
  const cleanRows = Array.from({ length: 7920 }, (_, index) => {
    const distance = 120 + index % 73 * 11;
    const fuel = index >= 7800 ? 0 : 18 + index % 31;
    const cargo = 400 + index % 59 * 25;
    const packaging = 20 + index % 9 * 5;
    const damaged = index % 23 === 0 ? 15 : 0;
    const origin = cities[index % cities.length];
    const destination = cities[(index + 2) % cities.length];
    const row = {
      "Manifest ID": `MAN-${String(index + 1).padStart(7, "0")}`,
      Truck: trucks[index % trucks.length],
      "Dispatch Date": `${pad(index % 12 + 1)}/${pad(index % 27 + 1)}/2026`,
      "Driver Email": `driver.${index}@fleet.example.com`,
      "Route Blob": `${origin}>${destination}`,
      Status: statuses[index % statuses.length],
      "Distance KM": String(distance),
      "Fuel Used": fuel.toFixed(2),
      "Cargo KG": cargo.toFixed(2),
      "Packaging KG": packaging.toFixed(2),
      "Damaged KG": damaged.toFixed(2),
      "Ghost Total": String(cargo + packaging + 999),
    };
    if (index % 257 === 5) row["Manifest ID"] = row["Manifest ID"].replace("-", "_");
    if (index % 263 === 7) row["Driver Email"] = row["Driver Email"].replace("@", " at ");
    if (index % 269 === 9) row.Truck = row.Truck.toLowerCase();
    if (index % 271 === 11) row.Status = ` ${row.Status.toUpperCase()} `;
    if (index % 277 === 13) row["Cargo KG"] = "heavy";
    return row;
  });
  const duplicates = cleanRows.slice(0, 80).map((row) => ({ ...row }));
  return [...cleanRows, ...duplicates];
}

function createOffice(sender, department, start, trouble, progress, cleanScan, win) {
  return {
    sender,
    department,
    start,
    trouble: [trouble, `${trouble} and the machine has started making opinions`],
    progress,
    cleanScan,
    delete: "Those rows are gone and the recycle bin refuses to comment",
    formula: "The calculation worked so apply any dependent rules after it",
    schema: "The table shape changed and the machine noticed",
    win,
  };
}

function billingNumberTypes() {
  return Object.fromEntries([
    "Hours",
    "Hourly Rate",
    "Labor Cost",
    "Parts Cost",
    "Subtotal",
    "Discount Percent",
    "Discount Amount",
    "Tax Percent",
    "Tax Amount",
    "Refund",
    "Amount Due",
  ].map((column) => [column, "Number"]));
}

function shippingNumberTypes() {
  return Object.fromEntries([
    "Distance KM",
    "Fuel Used",
    "Cargo KG",
    "Packaging KG",
    "Damaged KG",
  ].map((column) => [column, "Number"]));
}

function pad(value) {
  return String(value).padStart(2, "0");
}
