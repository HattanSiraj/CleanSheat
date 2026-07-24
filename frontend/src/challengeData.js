export const CHALLENGES = [
  {
    id: "cafe-closing-time",
    revision: 3,
    number: 1,
    title: "Cafe Closing Time",
    subtitle: "A kid on the loose",
    difficulty: "Warm up",
    rowCount: 30,
    accent: "orange",
    parMoves: 8,
    story: [
      "Today is Bring Your Kid to Work Day at the cafe and somebody left the stock spreadsheet open",
      "The kid deleted the closing stock column and replaced it with snack reviews because apparently the muffins needed feedback",
      "Put the stock count back together and remove the reviews before you get demoted to customer",
    ],
    hints: [
      "Opening Stock, Delivered, Sold, Wasted and Closing Stock should be Number columns",
      "Create Closing Stock and use [Opening Stock] + [Delivered] - [Sold] - [Wasted]",
      "Kid Notes does not belong in the final stock report",
    ],
    objectives: [
      { id: "closing-stock", title: "Rebuild the closing stock column", kind: "calculatedColumn", target: "Closing Stock", expectedType: "Number", formula: "[Opening Stock] + [Delivered] - [Sold] - [Wasted]", tolerance: 0.01 },
      { id: "remove-notes", title: "Delete the kid reviews", kind: "columnsAbsent", columns: ["Kid Notes"] },
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
      { id: "phone-optional", title: "Allow genuinely missing phone numbers", kind: "missingPolicy", column: "Phone", policy: "allowed" },
      { id: "emails-clean", title: "Fix the broken email addresses", kind: "scanClean", columns: ["Email"], expectedType: "Email" },
      { id: "phones-clean", title: "Fix the invalid phone numbers", kind: "scanClean", columns: ["Phone"], expectedType: "Phone" },
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
    revision: 3,
    number: 5,
    title: "Dataset From Hell",
    subtitle: "Eight thousand rows. Thirty bad ideas. One export button.",
    difficulty: "HELL",
    rowCount: 8000,
    accent: "red",
    parMoves: 30,
    story: [
      "An 11 year old got into the production database using the password admin123 and nobody in engineering wants to talk about it",
      "He tried downloading everything but his internet died halfway through and while clicking random buttons he deleted half the database",
      "Engineering recovered the tables but the data came back cursed so fix it before management asks why admin123 was the real password",
    ],
    hints: [
      "Configure null markers before deciding which blanks are real problems",
      "Delete Legacy Total because the recovered values inside it cannot be trusted",
      "Build Discount Amount first, then Tax Amount and finish with Final Charge because each formula needs the one before it",
      "Scan does not detect duplicates, open Cleaning Tools and compare Row Key in Duplicates",
    ],
    objectives: [
      { id: "boss-status", title: "Reduce Status to four real choices", kind: "allowedValues", column: "Status", values: ["Active", "Paused", "Closed", "Pending"] },
      { id: "boss-unique", title: "Remove duplicate row keys", kind: "unique", columns: ["Row Key"] },
      { id: "boss-scan", title: "Clear issues from the core columns", kind: "scanClean", columns: ["Email", "Phone", "Order Date", "Gross Amount", "Discount Percent", "Shipping Fee", "Tax Percent", "Status"], expectedTypes: { Email: "Email", Phone: "Phone", "Order Date": "Date", "Gross Amount": "Number", "Discount Percent": "Number", "Shipping Fee": "Number", "Tax Percent": "Number", Status: "Category" } },
      { id: "boss-legacy", title: "Delete the cursed old total", kind: "columnsAbsent", columns: ["Legacy Total"] },
      { id: "boss-discount", title: "Calculate every discount", kind: "calculatedColumn", target: "Discount Amount", expectedType: "Number", formula: "[Gross Amount] * [Discount Percent] / 100", tolerance: 0.02 },
      { id: "boss-tax", title: "Calculate tax after the discount", kind: "calculatedColumn", target: "Tax Amount", expectedType: "Number", formula: "([Gross Amount] - [Discount Amount]) * [Tax Percent] / 100", tolerance: 0.02 },
      { id: "boss-final", title: "Build the final charge", kind: "calculatedColumn", target: "Final Charge", expectedType: "Number", formula: "[Gross Amount] - [Discount Amount] + [Tax Amount] + [Shipping Fee]", tolerance: 0.02 },
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
    title: "The Final Export",
    subtitle: "Half a million rows and nobody remembers what any of them mean",
    difficulty: "HELL^2",
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
  const items = ["Coffee beans", "Oat milk", "Croissants", "Paper cups", "Chocolate syrup"];
  const kidReviews = ["Tastes suspicious", "Five stars", "Looks boring", "Needs more sugar"];
  return Array.from({ length: 30 }, (_, index) => {
    const openingStock = 45 + (index % 8) * 7;
    const delivered = 4 + (index * 3) % 17;
    const sold = 8 + (index * 5) % 22;
    const wasted = index % 4;
    return {
      "Stock Check ID": `CAFE-${String(index + 1).padStart(3, "0")}`,
      "Stock Date": `2026-07-${String(index % 20 + 1).padStart(2, "0")}`,
      Item: items[index % items.length],
      "Opening Stock": String(openingStock),
      Delivered: String(delivered),
      Sold: String(sold),
      Wasted: String(wasted),
      "Kid Notes": kidReviews[index % kidReviews.length],
    };
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
  const countries = [["Saudi Arabia", "Riyadh", "+966", 15], ["United States", "Austin", "+1", 8.25], ["Germany", "Berlin", "+49", 19]];
  const discountRates = [0, 5, 10, 15, 20];
  const shippingFees = [0, 5, 7.5, 12];
  const rows = Array.from({ length: 8000 }, (_, index) => {
    const [country, city, dial, taxPercent] = countries[index % countries.length];
    const grossAmount = 80 + (index % 31) * 7.5;
    const discountPercent = discountRates[index % discountRates.length];
    const shippingFee = shippingFees[index % shippingFees.length];
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
      "Gross Amount": grossAmount.toFixed(2),
      "Discount Percent": String(discountPercent),
      "Shipping Fee": shippingFee.toFixed(2),
      "Tax Percent": String(taxPercent),
      "Legacy Total": (grossAmount + shippingFee).toFixed(2),
      Paid: index % 5 ? "yes" : "no",
      Notes: index % 19 ? "" : "Customer asked, politely, for a callback",
    };
    if (index % 97 === 4) row.Email = row.Email.replace("@", " at ");
    if (index % 113 === 7) row.Phone = "not supplied";
    if (index % 127 === 9) row["Order Date"] = `${index % 28 + 1}/13/2025`;
    if (index % 89 === 11) row.Status = ` ${row.Status.toLowerCase()} `;
    if (index % 101 === 13) row["Gross Amount"] = pick(["", "NULL", "many"], random);
    if (index % 109 === 15) row["Discount Percent"] = "";
    if (index % 137 === 17) row["Shipping Fee"] = "N/A";
    if (index % 149 === 19) row["Tax Percent"] = "tax";
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
