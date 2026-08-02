const RETAIL_SOURCE_COLUMNS = ["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"];
const RETAIL_COUNTRIES = [
  "Southern Wilds",
  "Alpine Court",
  "Pearl Island",
  "Waffle District",
  "Tidal Outposts",
  "Copper Island",
  "Crown Coast",
  "Midnight Lakes",
  "Velvet Republic",
  "Iron Workshop",
  "Marble Isles",
  "Neon Harbor",
  "Frost Island",
  "Emerald Island",
  "Crossroads",
  "Boot Kingdom",
  "Sunrise Island",
  "Cedar Coast",
  "Amber Woods",
  "Windmill Lowlands",
  "Fjord Kingdom",
  "White Eagle Plains",
  "Atlantic Gate",
  "Lion City",
  "Sunstone Kingdom",
  "Northern Workshop",
  "Clockwork Alps",
  "Mirage Towers",
  "Rainy Kingdom",
];
const RETAIL_EXPORT_COLUMNS = [
  "Invoice",
  "InvoiceDate",
  "Invoice Date",
  "Invoice Time",
  "StockCode",
  "Description",
  "Product Label",
  "Quantity",
  "Price",
  "Line Total",
  "Customer ID",
  "Country",
];
const BOOT_ITEMS = ["Cake", "Coffee", "Cookie", "Juice", "Salad", "Sandwich", "Smoothie", "Tea"];

const CORE_CHALLENGES = [
  {
    id: "boot-scan-training",
    revision: 2,
    number: 0,
    tutorialStage: 1,
    title: "Scanner Training",
    subtitle: "The ABC 123",
    difficulty: "Boot 1",
    preview: [
      "Start with twelve rows and learn how column types change what Scan looks for",
      "The values are already trustworthy and Clipbit will show you how to prove it",
    ],
    rowCount: 12,
    accent: "teal",
    tutorial: true,
    story: [
      "The AI overlord has agreed to start with something small and simple because the last test subjects could not handle the pressure",
      "PLEASE DO NOT FREAK OUT, grab yourself a cup of coffee and give it a shot because we believe in you, human",
      "Change the column type and prove the report is clean, you cannot break anything here because you can always restart",
    ],
    hints: [],
    assistant: {
      start: "Welcome to Stage 1 and please enjoy this very reasonable twelve row file",
      noProgress: "Click Tickets Closed and set it to Integer before scanning again",
      win: "You cleaned one column and the computer has decided you may see a second one",
    },
    office: {
      sender: "Mona",
      department: "IT training",
      start: "This is the easy file and I have personally removed every possible surprise",
      trouble: [
        "The scanner found {{issueLabel}} in Tickets Closed so open the walkthrough if you need the next click",
        "Still seeing {{issueLabel}} and fortunately all of them are in the same column",
      ],
      progress: "{{objective}} is fixed and Stage 1 is almost done",
      cleanScan: "Tickets Closed looks clean so the boot check should be ready",
      delete: "You were not supposed to delete anyone from training but I admire the confidence",
      formula: "There are no formulas here and somehow you found one anyway",
      schema: "The training file changed shape and I am pretending that was planned",
      win: "Stage 1 complete and the second training file is unlocked",
    },
    objectives: [
      { id: "boot-scan-column", title: "Verify Tickets Closed", kind: "scanClean", columns: ["Tickets Closed"], expectedType: "Integer" },
    ],
    rules: [
      { id: "boot-scan-rows", title: "Keep all twelve agents", kind: "rowCount", minimum: 12, maximum: 12 },
    ],
    toolAccess: { cleaningTools: ["dataBin"] },
    createRows: createBootScanRows,
  },
  {
    id: "boot-category-training",
    revision: 2,
    number: 0,
    tutorialStage: 2,
    title: "Category Training",
    subtitle: "Three allowed choices and four creative mistakes",
    difficulty: "Boot 2",
    preview: [
      "Learn Text Cleanup and turn a cleaned column into a Category",
      "Repair a tiny request queue before the full Boot Sequence starts",
    ],
    rowCount: 15,
    accent: "orange",
    tutorial: true,
    story: [
      "The second training file came from a request form with exactly three Status buttons",
      "People still managed to submit lowercase words and extra spaces even with only three buttons",
      "Normalize the writing then turn Status into a Category",
    ],
    hints: [],
    assistant: {
      start: "Stage 2 contains three valid choices and four values trying to become a fourth choice",
      noProgress: "Clean the Status writing then set the column to Category",
      win: "The request queue agrees on three words and another training file just appeared",
    },
    office: {
      sender: "Mona",
      department: "IT training",
      start: "The form had three buttons and somehow received seven spellings",
      trouble: [
        "Status still has {{issueLabel}} and all three correct choices are in the walkthrough",
        "The queue is still inventing new Status values so check Allowed Values",
      ],
      progress: "{{objective}} is fixed and the request queue has stopped arguing",
      cleanScan: "The Status column looks clean so run the final boot check",
      delete: "The requests needed a Status and not a disappearance",
      formula: "A formula will not teach Status how to spell Open",
      schema: "The request queue changed shape and now I have questions",
      win: "Stage 2 complete and Issue Training is ready",
    },
    objectives: [
      { id: "boot-category-values", title: "Repair the Status choices", kind: "allowedValues", column: "Status", expectedType: "Category", values: ["Open", "Waiting", "Closed"] },
      { id: "boot-category-scan", title: "Pass the Status scan", kind: "scanClean", columns: ["Status"], expectedType: "Category" },
    ],
    rules: [
      { id: "boot-category-rows", title: "Keep all fifteen requests", kind: "rowCount", minimum: 15, maximum: 15 },
    ],
    toolAccess: { cleaningTools: ["textCleanup", "dataBin"] },
    createRows: createBootCategoryRows,
  },
  {
    id: "boot-issue-training",
    revision: 1,
    number: 0,
    tutorialStage: 3,
    title: "Issue Training",
    subtitle: "The daily target is eight and three cells disagree",
    difficulty: "Boot 3",
    preview: [
      "Learn how Scan feeds Validation Issues and Fill Issues",
      "Repair three bad targets with one known replacement value",
    ],
    rowCount: 18,
    accent: "orange",
    tutorial: true,
    story: [
      "Every support agent has the same daily target of eight tickets",
      "Three cells forgot the number and replaced it with nothing, a word, and whatever two question marks are supposed to mean",
      "Find all three problems and repair them together because clicking every cell would be deeply embarrassing for the computer",
    ],
    hints: [],
    assistant: {
      start: "The target is eight and I have checked this twice because trust is currently unavailable",
      noProgress: "Scan Daily Target as Integer then let Fill Issues replace every broken target with 8",
      win: "All eighteen agents have the same target and nobody had to count on their fingers",
    },
    office: {
      sender: "Mona",
      department: "IT training",
      start: "Daily Target should be eight for everyone and three cells are being difficult",
      trouble: [
        "Daily Target still has {{issueLabel}} so check Validation Issues before guessing",
        "The target is still eight and the broken cells remain committed to being wrong",
      ],
      progress: "{{objective}} is fixed and the training queue is almost believable",
      cleanScan: "Daily Target passed the scan so the next dial position should wake up",
      delete: "Those agents needed a target and not a trip to the Data Bin",
      formula: "Eight does not need a formula but I admire the machinery",
      schema: "The tiny training file changed shape and somehow became more complicated",
      win: "Issue Training complete and Recovery Training is online",
    },
    objectives: [
      { id: "boot-issue-values", title: "Restore every daily target to 8", kind: "patternMatch", column: "Daily Target", expectedType: "Integer", pattern: "^8$" },
      { id: "boot-issue-scan", title: "Pass the Daily Target scan", kind: "scanClean", columns: ["Daily Target"], expectedType: "Integer" },
    ],
    rules: [
      { id: "boot-issue-rows", title: "Keep all eighteen agents", kind: "rowCount", minimum: 18, maximum: 18 },
    ],
    toolAccess: { cleaningTools: ["fillIssues", "dataBin"] },
    createRows: createBootIssueRows,
  },
  {
    id: "boot-recovery-training",
    revision: 1,
    number: 0,
    tutorialStage: 4,
    title: "Recovery Training",
    subtitle: "Meter readings, one formula and one lost row",
    difficulty: "Boot 4",
    preview: [
      "Build one subtraction relationship and repair every recoverable Usage value",
      "Learn why one row belongs in Data Bin while the others do not",
    ],
    rowCount: 16,
    accent: "teal",
    tutorial: true,
    story: [
      "A training meter records its Start Reading, End Reading, and Usage for every shift",
      "Usage can be recovered by subtracting Start Reading from End Reading unless both Start Reading and Usage disappear",
      "Repair what the numbers can prove and move the one hopeless row to Data Bin",
    ],
    hints: [],
    assistant: {
      start: "This file only needs one formula and one responsible act of giving up",
      noProgress: "Build Usage from End Reading minus Start Reading then check every fixable row",
      win: "The meter report works and the one impossible row is waiting in Data Bin for future scientists",
    },
    office: {
      sender: "Mona",
      department: "IT training",
      start: "Usage equals End Reading minus Start Reading and one row has lost too much information",
      trouble: [
        "The meter report still has {{issueLabel}} so check the relationship results",
        "Some Usage values can be calculated and one row absolutely cannot",
      ],
      progress: "{{objective}} is fixed and the meter has stopped lying about one more shift",
      cleanScan: "The remaining readings look clean so check that the impossible row reached Data Bin",
      delete: "Only the row missing both Start Reading and Usage belongs in Data Bin",
      formula: "The subtraction worked and several Usage cells have returned from the void",
      schema: "The meter report changed shape which was not part of this training exercise",
      win: "Recovery Training complete and the final Boot Sequence is ready",
    },
    objectives: [
      { id: "boot-recovery-types", title: "Set all meter readings to Number", kind: "types", expected: { "Start Reading": "Number", "End Reading": "Number", Usage: "Number" } },
      { id: "boot-recovery-formula", title: "Make every remaining Usage value add up", kind: "formula", left: "End Reading", right: "Start Reading", target: "Usage", operator: "-", tolerance: 0.001 },
      { id: "boot-recovery-scan", title: "Pass the meter reading scan", kind: "scanClean", columns: ["Start Reading", "End Reading", "Usage"], expectedType: "Number" },
    ],
    rules: [
      {
        id: "boot-recovery-bin",
        title: "Move only the unrecoverable meter row",
        kind: "guidedRowCleanup",
        requiredColumns: ["Start Reading", "End Reading", "Usage"],
        minimumValidRequiredValues: 2,
        requiredDeletions: 1,
      },
    ],
    toolAccess: { cleaningTools: ["dataBin"] },
    createRows: createBootRecoveryRows,
  },
  {
    id: "boot-sequence",
    revision: 5,
    number: 0,
    tutorialStage: 5,
    title: "Boot Sequence",
    subtitle: "The training file is somehow already broken",
    difficulty: "Boot 5",
    preview: [
      "Learn the cleaning tools by repairing a small sales file one problem at a time",
      "You will set types, build formulas, handle dates and quarantine rows that cannot be recovered",
    ],
    rowCount: 10000,
    accent: "teal",
    tutorial: true,
    dataFile: "./sample_sales.csv",
    story: [
      "CleanSheet OS failed its morning check and the training file is leaking ERROR and UNKNOWN everywhere",
      "I am Clipbit your highly qualified recovery assistant and I definitely did not break it before you arrived",
      "Repair the numbers and dates then move rows that cannot be calculated to the Data Bin and the rest of the desktop will wake up",
    ],
    hints: [],
    assistant: {
      start: "Welcome to Boot Sequence and yes the tutorial file is ten thousand rows because nobody here understands restraint",
      noProgress: "That scan found the same mess again so try changing one column type before we stare at it a third time",
      win: "The desktop booted and against every prediction you are now allowed near the real files",
    },
    office: {
      sender: "Mona",
      department: "IT desk",
      start: "Morning and please ignore the smoke coming from the training file",
      trouble: [
        "The scanner found {{issueLabel}} which is more than zero and therefore officially your problem",
        "Still seeing {{issueLabel}} and the computer has started making a noise I do not recognize",
      ],
      progress: "{{objective}} is fixed and one of the warning lights just turned off",
      cleanScan: "The visible columns look clean so check the objectives before celebrating near the server",
      delete: "Those rows were beyond repair and I have placed them in the digital bin",
      formula: "The totals are calculating again and finance can stop breathing into my phone",
      schema: "A column changed and somehow the machine accepted it",
      win: "Boot complete and I am closing this ticket before anything else catches fire",
    },
    objectives: [
      { id: "boot-items", title: "Keep only the eight real Items", kind: "allowedValues", column: "Item", expectedType: "Category", values: BOOT_ITEMS },
      { id: "boot-price-lookup", title: "Recover prices from Item", kind: "lookupRecovery", source: "Item", target: "Price Per Unit", minimumFixes: 25 },
      { id: "boot-item-lookup", title: "Recover Items from price", kind: "lookupRecovery", source: "Price Per Unit", target: "Item", minimumFixes: 500 },
      { id: "boot-one-price-per-item", title: "Keep one price for every Item", kind: "groupConsistencyRecovery", column: "Price Per Unit", groupBy: "Item", valueType: "Number", tolerance: 0.01, minimumGroups: 8 },
      { id: "boot-one-item-per-price", title: "Keep one Item for every price", kind: "groupConsistencyRecovery", column: "Item", groupBy: "Price Per Unit", groupType: "Number", minimumGroups: 8 },
      { id: "boot-numbers", title: "Clean the three number columns", kind: "scanClean", columns: ["Quantity", "Price Per Unit", "Total Spent"], expectedTypes: { Quantity: "Number", "Price Per Unit": "Number", "Total Spent": "Number" } },
      { id: "boot-formula", title: "Make every total add up", kind: "formula", left: "Quantity", right: "Price Per Unit", target: "Total Spent", operator: "*", tolerance: 0.02 },
      { id: "boot-dates", title: "Clean every transaction date", kind: "patternMatch", column: "Transaction Date", expectedType: "Date", pattern: "^\\d{4}-\\d{2}-\\d{2}$", allowBlank: true, requireAllowedMissingWhenBlank: true },
    ],
    rules: [
      {
        id: "boot-row-cleanup",
        title: "Only move rows that cannot be recovered",
        kind: "guidedRowCleanup",
        requiredColumns: ["Quantity", "Price Per Unit", "Total Spent"],
        minimumValidRequiredValues: 2,
        requiredDeletions: 26,
        optionalColumn: "Transaction Date",
        optionalInvalidValues: ["", "ERROR", "UNKNOWN"],
      },
    ],
  },
  {
    id: "cafe-closing-time",
    revision: 5,
    number: 1,
    title: "Cafe Closing Time",
    subtitle: "A kid on the loose",
    difficulty: "Warm up",
    preview: [
      "Rebuild a cafe stock report and make every closing count believable again",
      "Expect ID and date formats, category cleanup, formulas and one completely useless column",
    ],
    rowCount: 30,
    accent: "orange",
    story: [
      "Today is Bring Your Kid to Work Day at the cafe and somebody left the stock spreadsheet open",
      "The kid deleted the closing stock column and replaced it with snack reviews because apparently the muffins needed feedback",
      "Put the stock count back together and remove the reviews before you get demoted to customer",
    ],
    hints: [
      "Stock Check ID follows CAFE-001 and Stock Date follows YYYY-MM-DD",
      "Opening Stock, Delivered, Sold, Wasted and Closing Stock should be Number columns",
      "Create Closing Stock and use [Opening Stock] + [Delivered] - [Sold] - [Wasted]",
      "Kid Notes does not belong in the final stock report",
    ],
    assistant: {
      start: "A child reviewed the inventory and the chocolate syrup received five stars so we should probably move quickly",
      noProgress: "The muffins remain reviewed and the closing stock remains missing which is a strange way to run finance",
      win: "Stock restored and the child has been moved away from the keyboard for legal reasons",
    },
    office: {
      sender: "Samir",
      department: "Cafe manager",
      start: "Please fix the stock file and do not read the review about my muffins",
      trouble: [
        "The report still has {{issueLabel}} and the lunch rush starts soon",
        "I checked again and the spreadsheet is still more organized than the kitchen",
      ],
      progress: "{{objective}} is done and I may let you have one free coffee",
      cleanScan: "The scan is clean but the closing stock still needs to make sense",
      delete: "If those rows were snack reviews then they deserved it",
      formula: "Closing stock is back and I am choosing to trust the numbers",
      schema: "That new column looks useful which is already better than Kid Notes",
      win: "The report is fixed and you are no longer being demoted to customer",
    },
    objectives: [
      { id: "cafe-id", title: "Repair the stock check IDs", kind: "patternMatch", column: "Stock Check ID", pattern: "^CAFE-[0-9]{3}$" },
      { id: "cafe-date", title: "Repair the stock dates", kind: "patternMatch", column: "Stock Date", expectedType: "Date", pattern: "^2026-07-[0-9]{2}$" },
      { id: "cafe-items", title: "Put the Item choices in Title Case", kind: "allowedValues", column: "Item", expectedType: "Category", values: ["Coffee Beans", "Oat Milk", "Croissants", "Paper Cups", "Chocolate Syrup"] },
      { id: "cafe-numbers", title: "Set the stock columns to Number", kind: "types", expected: { "Opening Stock": "Number", Delivered: "Number", Sold: "Number", Wasted: "Number" } },
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
    revision: 3,
    number: 2,
    title: "Signup Swamp",
    subtitle: "Marketing collected leads with enthusiasm, not standards.",
    difficulty: "Messy",
    preview: [
      "Turn a giveaway signup dump into contact data that can actually be used",
      "Repair IDs, emails and phones then split names and decide which empty values are allowed",
    ],
    rowCount: 90,
    accent: "coral",
    story: [
      "Marketing ran a giveaway for a free air fryer and collected ninety leads from a form nobody tested",
      "Some emails forgot the @ sign and the phone numbers look like people entered them during an earthquake and Status has no idea what it wants to be",
      "Clean the contacts and calm down the Status column and remember that some people simply did not leave a phone number",
    ],
    hints: [
      "Lead ID should look like LEAD-1000",
      "Split Name on the space into First Name and Last Initial",
      "Status should only contain Active, Paused, or Closed",
      "Phone is optional here and NULL or N/A should count as missing",
    ],
    assistant: {
      start: "Marketing promised these leads are valuable and marketing also thinks NULL is a phone number",
      noProgress: "The leads are still swamp shaped so Email or Phone would be a good place to begin",
      win: "The contacts are usable and the air fryer giveaway can continue ruining everyone else's day",
    },
    office: {
      sender: "Lina",
      department: "Marketing",
      start: "These leads are extremely valuable because ninety people wanted a free air fryer",
      trouble: [
        "The scanner found {{issueLabel}} in the contact data and I blame the form",
        "Somebody entered an email without an at sign and honestly I respect the confidence",
      ],
      progress: "{{objective}} is done and the campaign dashboard has stopped yelling",
      cleanScan: "The visible contacts look clean so make sure the optional phone rules are not forgotten",
      delete: "Please do not delete all my leads or I will have to run another giveaway",
      formula: "I did not know marketing had formulas but nice work",
      schema: "New columns for the names look much better than one giant Name blob",
      win: "The swamp is gone and these people can finally receive too many emails",
    },
    objectives: [
      { id: "lead-ids", title: "Repair the lead IDs", kind: "patternMatch", column: "Lead ID", pattern: "^LEAD-[0-9]{4}$" },
      { id: "split-names", title: "Split Name into First Name and Last Initial", kind: "transformedColumns", operation: "split", source: "Name", outputs: ["First Name", "Last Initial"], separator: "whitespace" },
      { id: "emails-clean", title: "Fix the broken email addresses", kind: "scanClean", columns: ["Email"], expectedType: "Email" },
      { id: "phones-clean", title: "Fix the invalid phone numbers", kind: "scanClean", columns: ["Phone"], expectedType: "Phone" },
      { id: "phone-optional", title: "Allow genuinely missing phone numbers", kind: "missingPolicy", column: "Phone", policy: "allowed", tokens: ["NULL", "N/A"] },
      { id: "status-values", title: "Tame the status spellings", kind: "allowedValues", column: "Status", expectedType: "Category", values: ["Active", "Paused", "Closed"] },
      { id: "source-values", title: "Clean the signup sources", kind: "allowedValues", column: "Source", expectedType: "Category", values: ["Event", "Website", "Referral"] },
    ],
    rules: [
      { id: "keep-leads", title: "Keep all ninety leads", kind: "rowCount", minimum: 90, maximum: 90 },
    ],
    createRows: createSignupRows,
  },
  {
    id: "warehouse-echoes",
    revision: 4,
    number: 3,
    title: "Warehouse Echoes",
    subtitle: "The scanner hiccupped and submitted orders twice.",
    difficulty: "Tricky",
    preview: [
      "Untangle repeated warehouse orders without deleting the real shipments",
      "Normalize messy labels, remove duplicates and build totals plus storage labels",
    ],
    rowCount: 172,
    accent: "sand",
    story: [
      "The warehouse scanner started beeping twice and the supervisor fixed it using the ancient technique of hitting it with his hand",
      "The scanner took that personally and copied a bunch of orders and also threw random spaces and capital letters into Product and Zone",
      "Remove the clones and clean the labels and please keep one real copy of every order or the warehouse will ship nothing",
    ],
    hints: [
      "Order ID follows WH-0001 and should stay unique",
      "Text Cleanup can fix casing and repeated spaces in batches",
      "Bins multiplied by Quantity gives Total Units",
      "Use Product Code as a Logical relation source to recover missing Product values",
      "Combine Product and Zone using a space, vertical bar and another space",
    ],
    assistant: {
      start: "The scanner made clones and the supervisor hit it again which somehow did not improve the situation",
      noProgress: "I can still hear duplicate orders echoing through the warehouse",
      win: "One real order remains for every shipment and the scanner has been placed in timeout",
    },
    office: {
      sender: "Omar",
      department: "Warehouse floor",
      start: "The scanner beeped twice again and the supervisor is warming up his hitting hand",
      trouble: [
        "The map shows {{issueLabel}} and at least three boxes are where boxes should not be",
        "The orders still have clones and nobody knows which scanner started it",
      ],
      progress: "{{objective}} is done and the echo in aisle four got quieter",
      cleanScan: "The scan looks clean but duplicates do not care about scans",
      delete: "One copy is enough and the warehouse does not need backup shipments",
      formula: "Total Units is calculating and the forklift driver says thanks",
      schema: "The new storage label may actually help us find things",
      win: "Every real order has one copy and the scanner is facing the wall",
    },
    objectives: [
      { id: "warehouse-ids", title: "Repair the warehouse order IDs", kind: "patternMatch", column: "Order ID", pattern: "^WH-[0-9]{4}$" },
      { id: "unique-orders", title: "Remove the duplicate orders", kind: "unique", columns: ["Order ID"] },
      { id: "zones", title: "Use one spelling for every warehouse zone", kind: "allowedValues", column: "Zone", expectedType: "Category", values: ["North", "South", "East", "West"] },
      { id: "products", title: "Clean the product names", kind: "allowedValues", column: "Product", expectedType: "Category", values: ["Cable", "Keyboard", "Monitor", "Mouse"] },
      { id: "warehouse-product-lookup", title: "Recover Products from Product Code", kind: "lookupRecovery", source: "Product Code", target: "Product", minimumFixes: 5 },
      { id: "warehouse-numbers", title: "Clean Bins and Quantity", kind: "scanClean", columns: ["Bins", "Quantity"], expectedTypes: { Bins: "Integer", Quantity: "Integer" } },
      { id: "total-units", title: "Calculate Total Units", kind: "calculatedColumn", target: "Total Units", expectedType: "Integer", formula: "[Bins] * [Quantity]", tolerance: 0 },
      { id: "storage-label", title: "Build the Storage Label", kind: "transformedColumns", operation: "combine", sources: ["Product", "Zone"], target: "Storage Label", separator: " | " },
    ],
    rules: [
      { id: "keep-orders", title: "Keep one copy of every real order", kind: "rowCount", minimum: 150, maximum: 150 },
    ],
    createRows: createWarehouseRows,
  },
  {
    id: "support-night-shift",
    revision: 3,
    number: 4,
    title: "Support Night Shift",
    subtitle: "Resolution times vanished, but the team patterns survived.",
    difficulty: "Advanced",
    preview: [
      "Recover missing support times using patterns hidden inside each priority group",
      "This challenge focuses on grouped medians, strict categories and calculated hours",
    ],
    rowCount: 520,
    accent: "blue",
    story: [
      "The night shift somehow closed all 520 support tickets and everyone celebrated for about six minutes",
      "Then someone opened the report and found a bunch of missing resolution times and naturally nobody remembers what happened",
      "Tickets with the same Priority usually take similar time so use their group medians and do not solve the problem by deleting the customers",
    ],
    hints: [
      "Ticket ID follows T-20000 and Opened At follows YYYY-MM-DD HH:00",
      "Priority should contain only Low, Normal, High, and Urgent",
      "Resolution Minutes is the column you are filling and Priority decides the groups",
      "For each Priority group fill the missing Resolution Minutes with that group's median",
      "Resolution Minutes divided by 60 gives Resolution Hours",
    ],
    assistant: {
      start: "The night shift solved every ticket and forgot how long any of it took which feels emotionally accurate",
      noProgress: "Resolution time is still missing and pretending the clock did not exist will not complete the report",
      win: "Every ticket has a believable time and management can return to measuring the wrong thing",
    },
    office: {
      sender: "Maya",
      department: "Support lead",
      start: "Everyone closed their tickets and nobody recorded how long it took so naturally I need this report today",
      trouble: [
        "The scan found {{issueLabel}} and the morning shift is pretending not to see them",
        "Resolution times are still missing and management has already opened the chart template",
      ],
      progress: "{{objective}} is done and one section of the report can finally be trusted",
      cleanScan: "The visible data looks clean so check that each Priority received its own median",
      delete: "Please keep the customers even if deleting them makes the report easier",
      formula: "Resolution Hours now exists and management can have the unit they actually asked for",
      schema: "The report has a new column and nobody filed a ticket about it",
      win: "The report is ready and I can return to solving problems people caused by restarting nothing",
    },
    objectives: [
      { id: "ticket-ids", title: "Repair the ticket IDs", kind: "patternMatch", column: "Ticket ID", pattern: "^T-[0-9]{5}$" },
      { id: "opened-format", title: "Repair the Opened At format", kind: "patternMatch", column: "Opened At", expectedType: "Date", pattern: "^2026-06-[0-9]{2} [0-9]{2}:00$" },
      { id: "priority-clean", title: "Clean up the Priority labels", kind: "allowedValues", column: "Priority", expectedType: "Category", values: ["Low", "Normal", "High", "Urgent"] },
      { id: "agent-clean", title: "Clean up the Agent labels", kind: "allowedValues", column: "Agent", expectedType: "Category", values: ["Mina", "Omar", "Sara", "Yousef"] },
      { id: "channel-clean", title: "Clean up the Channel labels", kind: "allowedValues", column: "Channel", expectedType: "Category", values: ["Email", "Chat", "Phone"] },
      { id: "resolution-number", title: "Clean Resolution Minutes", kind: "scanClean", columns: ["Resolution Minutes"], expectedType: "Number" },
      { id: "resolution-complete", title: "Fill every missing resolution time", kind: "noMissing", columns: ["Resolution Minutes"] },
      { id: "resolution-medians", title: "Match each Priority median", kind: "groupMedianFill", idColumn: "Ticket ID", column: "Resolution Minutes", groupBy: "Priority", groups: ["Low", "Normal", "High", "Urgent"], tolerance: 0.01 },
      { id: "resolution-hours", title: "Calculate Resolution Hours", kind: "calculatedColumn", target: "Resolution Hours", expectedType: "Number", formula: "[Resolution Minutes] / 60", tolerance: 0.01 },
    ],
    rules: [
      { id: "keep-tickets", title: "Keep every support ticket", kind: "rowCount", minimum: 520, maximum: 520 },
    ],
    createRows: createSupportRows,
  },
  {
    id: "dataset-from-hell",
    revision: 4,
    number: 5,
    title: "Dataset From Hell",
    subtitle: "Eight thousand rows. Thirty bad ideas. One export button.",
    difficulty: "HELL",
    preview: [
      "Face a large mixed corruption test where nearly every cleaning tool joins the fight",
      "Fix contacts, dates, money and categories before rebuilding a chained final charge",
    ],
    rowCount: 8000,
    accent: "red",
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
    assistant: {
      start: "Eight thousand rows entered and common sense immediately left through the emergency exit",
      noProgress: "The corruption meter did not move and the dataset appears pleased with itself",
      win: "The curse is gone and admin123 has been promoted to admin1234",
    },
    office: {
      sender: "Fahad",
      department: "Engineering",
      start: "We recovered the database and I need you to not ask how many times we used the word backup incorrectly",
      trouble: [
        "The scanner found {{issueLabel}} and the recovered file is somehow getting smug",
        "The corruption is still alive and admin123 is no longer allowed in meetings",
      ],
      progress: "{{objective}} is done and the incident report just became slightly less embarrassing",
      cleanScan: "Visible data is clean but this file hides problems like it was paid to do it",
      delete: "Those rows have returned to the void where engineering found them",
      formula: "One calculation chain is working so apply the rules in the correct order",
      schema: "The table shape changed and nothing exploded which counts as a deployment",
      win: "The database is clean and the password has been changed to something I am not telling you",
    },
    objectives: [
      { id: "boss-row-key", title: "Repair every Row Key", kind: "patternMatch", column: "Row Key", pattern: "^ROW-[0-9]{6}$" },
      { id: "boss-unique", title: "Remove duplicate row keys", kind: "unique", columns: ["Row Key"] },
      { id: "boss-email", title: "Clean every Email", kind: "scanClean", columns: ["Email"], expectedType: "Email" },
      { id: "boss-phone", title: "Clean every Phone", kind: "scanClean", columns: ["Phone"], expectedType: "Phone" },
      { id: "boss-date", title: "Clean every Order Date", kind: "scanClean", columns: ["Order Date"], expectedType: "Date" },
      { id: "boss-numbers", title: "Clean the money columns", kind: "scanClean", columns: ["Gross Amount", "Discount Percent", "Shipping Fee", "Tax Percent"], expectedTypes: { "Gross Amount": "Number", "Discount Percent": "Number", "Shipping Fee": "Number", "Tax Percent": "Number" } },
      { id: "boss-status", title: "Reduce Status to four real choices", kind: "allowedValues", column: "Status", expectedType: "Category", values: ["Active", "Paused", "Closed", "Pending"] },
      { id: "boss-paid", title: "Turn Paid into a real Boolean", kind: "scanClean", columns: ["Paid"], expectedType: "Boolean" },
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
    revision: 7,
    number: 6,
    title: "The Final Export",
    subtitle: "One hundred thousand rows and nobody remembers what any of them mean",
    difficulty: "HELL^2",
    preview: [
      "Prepare a huge retail archive for a strict export without flattening its strange accounting rules",
      "Normalize text, recover groups, remove true duplicates and match an exact final schema",
    ],
    rowCount: 100000,
    accent: "orange",
    dataFile: "./challenges/online_retail_2010_2011.csv",
    story: [
      "Finance found an old sales file named FINAL final use this one and naturally nobody remembers who made it",
      "It has one hundred thousand transactions and hundreds of duplicates and some of those duplicates are hiding behind spaces and lowercase stock codes",
      "Remove the actual junk without deleting anonymous buyers cancellations or accounting adjustments that only look suspicious",
    ],
    hints: [
      "Invoice accepts six digits with an optional A or C prefix and InvoiceDate follows M/D/YYYY H:mm",
      "Customer ID accepts five digits but an empty Customer ID belongs to an anonymous buyer and is allowed",
      "Description needs trimmed edges and collapsed spaces but keep its original capitalization",
      "StockCode needs uppercase without removing special codes such as POST, D, M, or BANK CHARGES",
      "Replace EIRE with Emerald Island before building the Country allowed values list",
      "A missing Country can be recovered with Most Common Value inside Customer ID groups",
      "Use StockCode as a Logical relation source first because 231 missing Descriptions have one verified answer",
      "Move the remaining Description gaps to the Data Bin because their StockCode is ambiguous or has no evidence",
      "Normalize Description and StockCode before comparing all eight source columns for duplicates",
      "Split InvoiceDate on whitespace and combine StockCode with Description using a space, vertical bar, and another space",
      "Line Total is Quantity multiplied by Price and the final column order is part of the export",
      "Invoices beginning with C are cancellations so their negative Quantity is valid",
      "Adjust bad debt rows are accounting adjustments so their negative Price is valid",
    ],
    assistant: {
      start: "One hundred thousand rows and the file name says final twice so this must be extremely trustworthy",
      noProgress: "The file is still enormous and somehow not cleaner which is an impressive use of time",
      win: "The final final export is actually final and nobody is allowed to rename it again",
    },
    office: {
      sender: "Nora",
      department: "Finance",
      start: "This is the final file and yes I said that about the previous four files too",
      trouble: [
        "The scan found {{issueLabel}} and the monthly meeting is approaching at dangerous speed",
        "The file is still dirty and Excel has already declined to comment",
      ],
      progress: "{{objective}} is done and the final export is becoming less fictional",
      cleanScan: "The visible columns pass but check duplicates, transforms and the final column order",
      delete: "Please remove junk rows and keep the strange accounting rows because apparently those are real",
      formula: "Line Total is calculating and the accountants have stopped checking it by hand",
      schema: "The export shape changed so compare it with the required order before sending anything",
      win: "It is actually final and I have hidden the Save As button from everyone",
    },
    objectives: [
      {
        id: "retail-contract",
        title: "Lock the transaction formats",
        kind: "validationContract",
        checks: [
          {
            column: "Invoice",
            type: "Text",
            mode: "customRegex",
            matchMode: "full",
            validSamples: ["536365", "C536379", "A563185"],
            invalidSamples: ["53636", "X536365", "5363657"],
          },
          {
            column: "InvoiceDate",
            type: "Text",
            mode: "customRegex",
            matchMode: "full",
            validSamples: ["12/1/2010 8:26", "8/12/2011 14:50"],
            invalidSamples: ["2010-12-01", "13/1/2010 08:00", "12/1/2010"],
          },
          { column: "Quantity", type: "Integer" },
          { column: "Price", type: "Number" },
        ],
      },
      {
        id: "retail-customer-contract",
        title: "Protect anonymous Customer IDs",
        kind: "validationContract",
        checks: [
          {
            column: "Customer ID",
            type: "Text",
            mode: "customRegex",
            matchMode: "full",
            missingPolicy: "allowed",
            validSamples: ["17850", "12347"],
            invalidSamples: ["1785", "ABCDE", "123456"],
          },
        ],
      },
      { id: "retail-description-text", title: "Remove the whitespace mess", kind: "textNormalized", column: "Description", trimEdges: true, collapseWhitespace: true, caseMode: "keep" },
      { id: "retail-stock-code-text", title: "Use one StockCode casing", kind: "textNormalized", column: "StockCode", trimEdges: false, collapseWhitespace: false, caseMode: "upper" },
      { id: "retail-description-lookup", title: "Recover safe Descriptions from StockCode", kind: "lookupRecovery", source: "StockCode", target: "Description", minimumFixes: 200 },
      {
        id: "retail-countries",
        title: "Build the Country list",
        kind: "allowedValues",
        column: "Country",
        expectedType: "Category",
        values: RETAIL_COUNTRIES,
        allowBlank: true,
        requireConfiguredValues: true,
      },
      {
        id: "retail-country-recovery",
        title: "Recover every missing Country",
        kind: "groupConsistencyRecovery",
        column: "Country",
        groupBy: "Customer ID",
        selector: { numericModulo: 7, remainder: 0 },
        minimumGroups: 200,
      },
      { id: "retail-descriptions", title: "Move unresolved product rows to the Data Bin", kind: "noMissing", columns: ["Description"], minimumRows: 99008 },
      { id: "retail-duplicates", title: "Reveal and remove duplicate transactions", kind: "unique", columns: RETAIL_SOURCE_COLUMNS },
      {
        id: "retail-export-schema",
        title: "Prepare the export layout",
        kind: "exportSchema",
        split: { operation: "split", source: "InvoiceDate", outputs: ["Invoice Date", "Invoice Time"], separator: "whitespace" },
        combine: { operation: "combine", sources: ["StockCode", "Description"], target: "Product Label", separator: " | " },
        checks: [
          { column: "Invoice Date", type: "Date", presetId: "date-us" },
          {
            column: "Invoice Time",
            type: "Text",
            mode: "customRegex",
            matchMode: "full",
            validSamples: ["8:26", "14:50", "23:59"],
            invalidSamples: ["24:00", "8.26", "14:5"],
          },
        ],
        expectedColumns: RETAIL_EXPORT_COLUMNS,
      },
      { id: "retail-line-total", title: "Calculate every Line Total", kind: "calculatedColumn", target: "Line Total", expectedType: "Number", formula: "[Quantity] * [Price]", tolerance: 0.01 },
    ],
    rules: [
      { id: "retail-row-count", title: "Finish with the expected transaction count", kind: "rowCount", minimum: 99008, maximum: 99008 },
      { id: "retail-cancellations", title: "Keep the cancelled transactions", kind: "minimumMatches", column: "Invoice", operator: "startsWith", value: "C", minimum: 1855 },
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
      changes: "Converted from Excel to CSV, sampled to 100,000 rows, given controlled spacing, casing, and recoverable Country gaps, and renamed countries with fictional location titles for this challenge",
    },
  },
];

export const CHALLENGES = [
  ...CORE_CHALLENGES.map((challenge) => ({
    pack: challenge.tutorial ? "boot" : "core",
    packOrder: challenge.number,
    ...challenge,
  })),
  ...HELL_CHALLENGES,
];

export function getChallenge(challengeId) {
  return CHALLENGES.find((challenge) => challenge.id === challengeId) ?? null;
}

export function hasCurrentChallengeRevision(challenge, revision) {
  return Boolean(challenge) && Number(revision) === challenge.revision;
}

function createBootScanRows() {
  const agents = ["Aisha", "Omar", "Lina", "Sam", "Noor", "Maya", "Yousef", "Sara", "Rami", "Dana", "Alex", "Huda"];
  const tickets = ["8", "5", "12", "11", "7", "13", "4", "9", "6", "2", "10", "3"];
  return agents.map((agent, index) => ({
    Agent: agent,
    "Tickets Closed": tickets[index],
  }));
}

function createBootCategoryRows() {
  const statuses = ["Open", "Waiting", "Closed", "open", "Open", "CLOSED", "Waiting", " closed ", "Closed", "Open", " waiting ", "Closed", "Open", "Waiting", "Closed"];
  return statuses.map((status, index) => ({
    "Request ID": `REQ-${String(index + 1).padStart(3, "0")}`,
    Status: status,
  }));
}

function createBootIssueRows() {
  const agents = ["Aisha", "Omar", "Lina", "Sam", "Noor", "Maya", "Yousef", "Sara", "Rami", "Dana", "Alex", "Huda", "Nora", "Faris", "Laila", "Zaid", "Mona", "Tariq"];
  return agents.map((agent, index) => ({
    Agent: agent,
    "Daily Target": index === 4 ? "" : index === 9 ? "eight" : index === 14 ? "??" : "8",
  }));
}

function createBootRecoveryRows() {
  return Array.from({ length: 16 }, (_, index) => {
    const start = 1000 + index * 37;
    const usage = 12 + (index * 5) % 20;
    const row = {
      Shift: `SHIFT-${String(index + 1).padStart(2, "0")}`,
      "Start Reading": String(start),
      "End Reading": String(start + usage),
      Usage: String(usage),
    };
    if ([3, 8, 13].includes(index)) row.Usage = index === 8 ? "ERROR" : "";
    if (index === 15) {
      row["Start Reading"] = "";
      row.Usage = "";
    }
    return row;
  });
}

function createCafeRows() {
  const items = ["Coffee beans", "Oat milk", "Croissants", "Paper cups", "Chocolate syrup"];
  const kidReviews = ["Tastes suspicious", "Five stars", "Looks boring", "Needs more sugar"];
  return Array.from({ length: 30 }, (_, index) => {
    const openingStock = 45 + (index % 8) * 7;
    const delivered = 4 + (index * 3) % 17;
    const sold = 8 + (index * 5) % 22;
    const wasted = index % 4;
    const row = {
      "Stock Check ID": `CAFE-${String(index + 1).padStart(3, "0")}`,
      "Stock Date": `2026-07-${String(index % 20 + 1).padStart(2, "0")}`,
      Item: items[index % items.length],
      "Opening Stock": String(openingStock),
      Delivered: String(delivered),
      Sold: String(sold),
      Wasted: String(wasted),
      "Kid Notes": kidReviews[index % kidReviews.length],
    };
    if (index === 4) row["Stock Check ID"] = "CAFE_005";
    if (index === 17) row["Stock Check ID"] = "17";
    if (index === 6) row["Stock Date"] = "07/07/2026";
    if (index === 21) row["Stock Date"] = "";
    if (index % 11 === 3) row.Item = ` ${row.Item.toUpperCase()} `;
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
    if (index % 31 === 6) row["Lead ID"] = row["Lead ID"].replace("-", "_");
    if (index % 22 === 9) row.Source = ` ${row.Source.toLowerCase()} `;
    return row;
  });
}

function createWarehouseRows() {
  const products = ["Cable", "Keyboard", "Monitor", "Mouse"];
  const productCodes = ["P100", "P200", "P300", "P400"];
  const zones = ["North", "South", "East", "West"];
  const base = Array.from({ length: 150 }, (_, index) => ({
    "Order ID": `WH-${String(index + 1).padStart(4, "0")}`,
    "Product Code": productCodes[index % productCodes.length],
    Product: products[index % products.length],
    Zone: zones[index % zones.length],
    Bins: String(index % 12 + 1),
    Quantity: String(index % 8 + 1),
  }));
  base.forEach((row, index) => {
    if (index % 14 === 2) row.Product = `  ${row.Product.toUpperCase()}  `;
    if (index % 29 === 9) row.Product = "";
    if (index % 17 === 3) row.Zone = row.Zone.toLowerCase();
    if (index % 41 === 5) row["Order ID"] = row["Order ID"].replace("-", "_");
    if (index % 47 === 8) row.Bins = "many";
    if (index % 53 === 12) row.Quantity = "";
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
    const row = {
      "Ticket ID": `T-${20000 + index}`,
      Priority: priority,
      Agent: agents[(index * 3) % agents.length],
      "Opened At": `2026-06-${String(index % 28 + 1).padStart(2, "0")} ${String(index % 24).padStart(2, "0")}:00`,
      "Resolution Minutes": index % 13 === 4 ? "" : String(baseMinutes + index % 15 - 7),
      Channel: ["Email", "Chat", "Phone"][index % 3],
    };
    if (index % 101 === 6) row["Ticket ID"] = row["Ticket ID"].replace("-", "_");
    if (index % 83 === 9) row["Opened At"] = row["Opened At"].replace(" ", "T");
    if (index % 71 === 13) row.Agent = ` ${row.Agent.toLowerCase()} `;
    if (index % 67 === 17) row.Channel = row.Channel.toUpperCase();
    return row;
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
    if (index % 163 === 23) row.Paid = "maybe";
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

import { HELL_CHALLENGES } from "./hellChallengeData.js";
