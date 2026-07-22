export const CHALLENGES = [
  {
    id: "cafe-closing-time",
    revision: 2,
    number: 1,
    title: "Cafe Closing Time",
    subtitle: "Someone let a kid near the sales spreadsheet",
    difficulty: "Warm up",
    rowCount: 30,
    accent: "orange",
    parMoves: 8,
    story: [
      "Today is Bring Your Kid to Work Day at the cafe and the manager left the sales spreadsheet open on their laptop",
      "Five minutes later the kid discovered Backspace and started helping, now quantities prices and totals have vanished from random orders",
      "Fix the missing numbers and make every bill add up before you get demoted to customer",
    ],
    hints: [
      "Three column relationships can recover whichever value is missing.",
      "Scan again after applying the relationship fixes.",
    ],
    objectives: [
      { id: "math", title: "Make every total add up", kind: "formula", target: "Total", left: "Quantity", right: "Unit Price", operator: "*", tolerance: 0.01 },
      { id: "complete", title: "Leave no gaps in the three number columns", kind: "noMissing", columns: ["Quantity", "Unit Price", "Total"] },
    ],
    rules: [
      { id: "keep-orders", title: "Keep every cafe order", kind: "rowCount", minimum: 30, maximum: 30 },
    ],
    createRows: createCafeRows,
  },
  {
    id: "signup-swamp",
    revision: 2,
    number: 2,
    title: "Signup Swamp",
    subtitle: "Marketing collected leads with enthusiasm, not standards.",
    difficulty: "Messy",
    rowCount: 90,
    accent: "coral",
    parMoves: 12,
    story: [
      "Marketing ran a giveaway for a free air fryer and collected ninety leads from a form nobody tested",
      "Some emails forgot the @ sign and the phone numbers look like people entered them during an earthquake and Status has no idea what it wants to be",
      "Clean the contacts and calm down the Status column and remember that some people simply did not leave a phone number",
    ],
    hints: [
      "Status should only contain Active, Paused, or Closed.",
      "Phone is optional here; configure its missing-value policy before scanning.",
    ],
    objectives: [
      { id: "status-values", title: "Tame the status spellings", kind: "allowedValues", column: "Status", values: ["Active", "Paused", "Closed"] },
      { id: "phone-optional", title: "Allow genuinely missing phone numbers", kind: "missingPolicy", column: "Phone", policy: "allowed", tokens: ["NULL", "N/A"] },
      { id: "contacts-clean", title: "Clear the remaining contact issues", kind: "scanClean", columns: ["Email", "Phone", "Status"] },
    ],
    rules: [
      { id: "keep-leads", title: "Keep all ninety leads", kind: "rowCount", minimum: 90, maximum: 90 },
    ],
    createRows: createSignupRows,
  },
  {
    id: "warehouse-echoes",
    revision: 2,
    number: 3,
    title: "Warehouse Echoes",
    subtitle: "The scanner hiccupped and submitted orders twice.",
    difficulty: "Tricky",
    rowCount: 172,
    accent: "sand",
    parMoves: 10,
    story: [
      "The warehouse scanner started beeping twice and the supervisor fixed it using the ancient technique of hitting it with his hand",
      "The scanner took that personally and copied a bunch of orders and also threw random spaces and capital letters into Product and Zone",
      "Remove the clones and clean the labels and please keep one real copy of every order or the warehouse will ship nothing",
    ],
    hints: [
      "Order ID should be unique.",
      "Text Cleanup can fix casing and repeated spaces in batches.",
      "Duplicates can compare one or several selected columns.",
    ],
    objectives: [
      { id: "unique-orders", title: "Remove the duplicate orders", kind: "unique", columns: ["Order ID"] },
      { id: "zones", title: "Use one spelling for every warehouse zone", kind: "allowedValues", column: "Zone", values: ["North", "South", "East", "West"] },
      { id: "products", title: "Clean the product names", kind: "allowedValues", column: "Product", values: ["Cable", "Keyboard", "Monitor", "Mouse"] },
    ],
    rules: [
      { id: "keep-orders", title: "Keep one copy of every real order", kind: "rowCount", minimum: 150, maximum: 150 },
    ],
    createRows: createWarehouseRows,
  },
  {
    id: "support-night-shift",
    revision: 2,
    number: 4,
    title: "Support Night Shift",
    subtitle: "Resolution times vanished, but the team patterns survived.",
    difficulty: "Advanced",
    rowCount: 520,
    accent: "blue",
    parMoves: 10,
    story: [
      "The night shift somehow closed all 520 support tickets and everyone celebrated for about six minutes",
      "Then someone opened the report and found a bunch of missing resolution times and naturally nobody remembers what happened",
      "Tickets with the same Priority usually take similar time so use their group medians and do not solve the problem by deleting the customers",
    ],
    hints: [
      "Priority should contain only Low, Normal, High, and Urgent",
      "Resolution Minutes is the column you are filling. Priority only decides which tickets belong in each group.",
      "For each Priority group, fill the missing Resolution Minutes with that group's median.",
      "Do not use Current Distribution for measured values.",
    ],
    objectives: [
      { id: "priority-clean", title: "Clean up the Priority labels", kind: "allowedValues", column: "Priority", values: ["Low", "Normal", "High", "Urgent"] },
      { id: "resolution-complete", title: "Fill every missing resolution time", kind: "noMissing", columns: ["Resolution Minutes"] },
      { id: "resolution-medians", title: "Match each Priority median", kind: "groupMedianFill", idColumn: "Ticket ID", column: "Resolution Minutes", groupBy: "Priority", groups: ["Low", "Normal", "High", "Urgent"], tolerance: 0.01 },
    ],
    rules: [
      { id: "keep-tickets", title: "Keep every support ticket", kind: "rowCount", minimum: 520, maximum: 520 },
    ],
    createRows: createSupportRows,
  },
  {
    id: "dataset-from-hell",
    revision: 2,
    number: 5,
    title: "Dataset From Hell",
    subtitle: "Eight thousand rows. Thirty bad ideas. One export button.",
    difficulty: "Boss fight",
    rowCount: 8000,
    accent: "red",
    parMoves: 30,
    story: [
      "An 11 year old got into the production database using the password admin123 and nobody in engineering wants to talk about it",
      "He tried downloading everything but his internet died halfway through and while clicking random buttons he deleted half the database",
      "Engineering recovered the tables but the data came back cursed so fix it before management asks why admin123 was the real password",
    ],
    hints: [
      "Configure null markers before deciding which blanks are real problems.",
      "Relationships recover totals; bulk tools handle repeated text damage.",
    ],
    objectives: [
      { id: "boss-math", title: "Repair the order calculations", kind: "formula", target: "Order Total", left: "Quantity", right: "Unit Price", operator: "*", tolerance: 0.02 },
      { id: "boss-status", title: "Reduce Status to four real choices", kind: "allowedValues", column: "Status", values: ["Active", "Paused", "Closed", "Pending"] },
      { id: "boss-unique", title: "Remove duplicate row keys", kind: "unique", columns: ["Row Key"] },
      { id: "boss-scan", title: "Clear issues from the core columns", kind: "scanClean", columns: ["Email", "Phone", "Order Date", "Quantity", "Unit Price", "Order Total", "Status"] },
    ],
    rules: [
      { id: "boss-survivors", title: "Keep at least 7600 rows", kind: "rowCount", minimum: 7600 },
    ],
    createRows: createHellRows,
  },
  {
    id: "final-final-export",
    revision: 2,
    number: 6,
    title: "The Final Final Export",
    subtitle: "Half a million rows and nobody remembers what any of them mean",
    difficulty: "Real world boss",
    rowCount: 541910,
    accent: "orange",
    parMoves: 20,
    dataFile: "./challenges/online_retail_2010_2011.csv",
    story: [
      "Finance found an old sales file named FINAL final use this one and naturally nobody remembers who made it",
      "It has half a million transactions and thousands of duplicates and missing labels and enough strange numbers to start an argument",
      "Remove the actual junk without deleting anonymous buyers cancellations or accounting adjustments that only look suspicious",
    ],
    hints: [
      "Remove full duplicates by comparing all eight columns",
      "Rows without a Description have zero Price and should be removed",
      "Missing Customer ID values belong to anonymous buyers and are allowed",
      "Invoices beginning with C are cancellations so their negative Quantity is valid",
      "Adjust bad debt rows are accounting adjustments so their negative Price is valid",
    ],
    objectives: [
      { id: "retail-duplicates", title: "Remove duplicate transactions", kind: "unique", columns: ["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"] },
      { id: "retail-descriptions", title: "Remove rows with missing descriptions", kind: "noMissing", columns: ["Description"] },
      { id: "retail-anonymous", title: "Allow anonymous Customer IDs", kind: "missingPolicy", column: "Customer ID", policy: "allowed" },
    ],
    rules: [
      { id: "retail-row-count", title: "Finish with the expected transaction count", kind: "rowCount", minimum: 535188, maximum: 535188 },
      { id: "retail-cancellations", title: "Keep the cancelled transactions", kind: "minimumMatches", column: "Invoice", operator: "startsWith", value: "C", minimum: 9251 },
      { id: "retail-adjustments", title: "Keep the bad debt adjustments", kind: "minimumMatches", column: "Description", operator: "equals", value: "Adjust bad debt", minimum: 3 },
    ],
    credit: {
      creator: "Daqing Chen",
      dataset: "Online Retail II",
      source: "UCI Machine Learning Repository",
      sourceUrl: "https://archive.ics.uci.edu/dataset/502/online%2Bretail",
      license: "Creative Commons Attribution 4.0 International",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      doiUrl: "https://doi.org/10.24432/C5CG6D",
      changes: "Converted from Excel to CSV and limited to the 2010 to 2011 sheet",
    },
  },
];

export function getChallenge(challengeId) {
  return CHALLENGES.find((challenge) => challenge.id === challengeId) ?? null;
}

export function hasCurrentChallengeRevision(challenge, revision) {
  return Boolean(challenge) && Number(revision) === challenge.revision;
}

function createCafeRows() {
  const items = [["Espresso", 9], ["Croissant", 12.5], ["Iced tea", 14], ["Sandwich", 24]];
  return Array.from({ length: 30 }, (_, index) => {
    const [item, price] = items[index % items.length];
    const quantity = index % 4 + 1;
    const row = {
      "Order ID": `CAFE-${String(index + 1).padStart(3, "0")}`,
      "Order Date": `2026-07-${String(index % 20 + 1).padStart(2, "0")}`,
      Item: item,
      Quantity: String(quantity),
      "Unit Price": price.toFixed(2),
      Total: (quantity * price).toFixed(2),
      Shift: index % 2 ? "Evening" : "Morning",
    };
    if (index % 7 === 2) row.Total = "";
    else if (index % 11 === 4) row.Quantity = "";
    else if (index % 13 === 6) row["Unit Price"] = "";
    return row;
  });
}

function createSignupRows() {
  const firstNames = ["Maya", "Omar", "Lina", "Sam", "Noor", "Alex"];
  const statuses = ["Active", "Paused", "Closed"];
  return Array.from({ length: 90 }, (_, index) => {
    const name = firstNames[index % firstNames.length];
    const row = {
      "Lead ID": `LEAD-${1000 + index}`,
      Name: `${name} ${String.fromCharCode(65 + index % 20)}.`,
      Email: `${name.toLowerCase()}.${index}@example.com`,
      Phone: index % 8 === 0 ? "" : `+966 55 ${String(1000000 + index).slice(-7)}`,
      Status: statuses[index % statuses.length],
      Source: ["Event", "Website", "Referral"][index % 3],
    };
    if (index % 17 === 3) row.Email = `${name.toLowerCase()}.${index}example.com`;
    if (index % 19 === 5) row.Phone = "NULL";
    if (index % 23 === 7) row.Phone = "12-3";
    if (index % 10 === 4) row.Status = ` ${row.Status.toLowerCase()} `;
    if (index % 29 === 8) row.Phone = "N/A";
    return row;
  });
}

function createWarehouseRows() {
  const products = ["Cable", "Keyboard", "Monitor", "Mouse"];
  const zones = ["North", "South", "East", "West"];
  const base = Array.from({ length: 150 }, (_, index) => ({
    "Order ID": `WH-${String(index + 1).padStart(4, "0")}`,
    Product: products[index % products.length],
    Zone: zones[index % zones.length],
    Bins: String(index % 12 + 1),
    Quantity: String(index % 8 + 1),
  }));
  base.forEach((row, index) => {
    if (index % 14 === 2) row.Product = `  ${row.Product.toUpperCase()}  `;
    if (index % 17 === 3) row.Zone = row.Zone.toLowerCase();
  });
  return [...base, ...base.filter((_, index) => index % 7 === 0).map((row) => ({ ...row }))];
}

function createSupportRows() {
  const priorities = ["Low", "Normal", "High", "Urgent"];
  const agents = ["Mina", "Omar", "Sara", "Yousef"];
  return Array.from({ length: 520 }, (_, index) => {
    const cleanPriority = priorities[index % priorities.length];
    const baseMinutes = { Low: 180, Normal: 95, High: 42, Urgent: 18 }[cleanPriority];
    let priority = cleanPriority;
    if (index % 29 === 3) priority = priority.toLowerCase();
    else if (index % 31 === 7) priority = priority.toUpperCase();
    else if (index % 37 === 11) priority = ` ${priority} `;
    return {
      "Ticket ID": `T-${20000 + index}`,
      Priority: priority,
      Agent: agents[(index * 3) % agents.length],
      "Opened At": `2026-06-${String(index % 28 + 1).padStart(2, "0")} ${String(index % 24).padStart(2, "0")}:00`,
      "Resolution Minutes": index % 13 === 4 ? "" : String(baseMinutes + index % 15 - 7),
      Channel: ["Email", "Chat", "Phone"][index % 3],
    };
  });
}

function createHellRows() {
  const random = createRandom(666);
  const names = ["Maya Stone", "Omar Saleh", "Lina Khan", "Alex Martin", "Noor Aziz"];
  const statuses = ["Active", "Paused", "Closed", "Pending"];
  const countries = [["Saudi Arabia", "Riyadh", "+966"], ["United States", "Austin", "+1"], ["Germany", "Berlin", "+49"]];
  const rows = Array.from({ length: 8000 }, (_, index) => {
    const [country, city, dial] = countries[index % countries.length];
    const quantity = index % 9 + 1;
    const price = 4.5 + (index % 31) * 1.75;
    const name = names[index % names.length];
    const row = {
      "Source System": ["CRM", "Web Shop", "Legacy ERP", "POS Export"][index % 4],
      "Row Key": `ROW-${String(index + 1).padStart(6, "0")}`,
      "Customer Name": name,
      Email: `${name.toLowerCase().replace(" ", ".")}.${index}@example.com`,
      Phone: `${dial} ${String(500000000 + index).slice(-9)}`,
      "Order Date": `2025-${String(index % 12 + 1).padStart(2, "0")}-${String(index % 28 + 1).padStart(2, "0")}`,
      Status: statuses[index % statuses.length],
      Country: country,
      City: city,
      Quantity: String(quantity),
      "Unit Price": price.toFixed(2),
      "Order Total": (quantity * price).toFixed(2),
      Paid: index % 5 ? "yes" : "no",
      Notes: index % 19 ? "" : "Customer asked, politely, for a callback",
    };
    if (index % 97 === 4) row.Email = row.Email.replace("@", " at ");
    if (index % 113 === 7) row.Phone = "not supplied";
    if (index % 127 === 9) row["Order Date"] = `${index % 28 + 1}/13/2025`;
    if (index % 89 === 11) row.Status = ` ${row.Status.toLowerCase()} `;
    if (index % 101 === 13) row.Quantity = pick(["", "NULL", "many"], random);
    if (index % 109 === 15) row["Order Total"] = "";
    if (index % 137 === 17) row["Unit Price"] = "N/A";
    return row;
  });
  for (let index = 499; index < rows.length; index += 997) rows[index]["Row Key"] = rows[index - 1]["Row Key"];
  return rows;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}
