import React, { forwardRef, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AgGridReact } from "ag-grid-react";
import Papa from "papaparse";
import { ALL_ISSUE_COLUMNS, calculateColumnFill, calculateMultiColumnCustomFill, getFillMethodsForType } from "./fillMethods.js";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "./styles.css";
//npm.cmd run dev
const TYPE_OPTIONS = ["Text", "Number", "Integer", "Date", "Email", "Phone", "Boolean", "Category"];
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,}[0-9]$/;
const NUMBER_PATTERN = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
const INTEGER_PATTERN = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)$/;
const VALIDATION_PRESETS = [
  { id: "text-any", type: "Text", name: "Any text" },
  { id: "text-letters", type: "Text", name: "Letters and spaces" },
  { id: "text-alphanumeric", type: "Text", name: "Alphanumeric" },
  { id: "number-standard", type: "Number", name: "Standard number" },
  { id: "number-positive", type: "Number", name: "Positive number" },
  { id: "integer-standard", type: "Integer", name: "Standard integer" },
  { id: "integer-positive", type: "Integer", name: "Positive integer" },
  { id: "date-iso-dash", type: "Date", name: "YYYY-MM-DD" },
  { id: "date-iso-slash", type: "Date", name: "YYYY/MM/DD" },
  { id: "date-us", type: "Date", name: "MM/DD/YYYY" },
  { id: "date-eu", type: "Date", name: "DD/MM/YYYY" },
  { id: "email-standard", type: "Email", name: "Standard email" },
  { id: "phone-common", type: "Phone", name: "International/common" },
  { id: "phone-digits", type: "Phone", name: "Digits only" },
  { id: "boolean-true-false", type: "Boolean", name: "true/false" },
  { id: "boolean-yes-no", type: "Boolean", name: "yes/no" },
  { id: "boolean-common", type: "Boolean", name: "true/false/yes/no" },
  { id: "category-existing", type: "Category", name: "Existing values only" },
];
const DEFAULT_PRESET_BY_TYPE = {
  Text: "text-any",
  Number: "number-standard",
  Integer: "integer-standard",
  Date: "date-iso-dash",
  Email: "email-standard",
  Phone: "phone-common",
  Boolean: "boolean-common",
  Category: "category-existing",
};
const CUSTOM_REGEX_PRESET_ID = "__custom_regex__";
const REGEX_STORAGE_KEY = "cleansheet.saved-regex-rules";
const RELATIONSHIP_STORAGE_KEY = "cleansheet.column-relationships";
const RELATIONSHIP_TOLERANCE = 0.01;
const HISTORY_LIMIT = 25;
const EMPTY_RELATIONSHIP_DRAFT = { id: "", name: "", targetColumn: "", formula: "", enabled: true };
const EMPTY_FILL_DRAFT = { column: "", scope: "both", method: "custom", customValue: "" };
const DEFAULT_REGEX_BUILDER = {
  allowed: "alphanumeric",
  customCharacters: "",
  prefix: "",
  suffix: "",
  minLength: "",
  maxLength: "",
};
const REGEX_CHEAT_SHEET = [
  createTemplateRule("template-email", "Email address", "[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+", "Email with a domain and one or more endings.", "alex@company.com", "alex@company"),
  createTemplateRule("template-phone", "Phone number", "\\+?[0-9][0-9 ()-]{6,}[0-9]", "International-style phone number with optional spaces and separators.", "+966 55 123 4567", "55-12"),
  createTemplateRule("template-url", "Website URL", "https?://[^\\s/$.?#][^\\s]*", "Web address starting with http:// or https://.", "https://example.com", "example.com"),
  createTemplateRule("template-postal", "Postal code", "[A-Za-z0-9][A-Za-z0-9 -]{2,9}", "Short postal or ZIP code using letters, digits, spaces, or hyphens.", "SW1A 1AA", "!123"),
  createTemplateRule("template-username", "Username", "[A-Za-z][A-Za-z0-9_]{2,19}", "3-20 characters, beginning with a letter.", "alex_2026", "2alex"),
  createTemplateRule("template-id", "Positive number", "[1-9][0-9]*", "Whole number greater than zero.", "248195", "-24"),
  createTemplateRule("template-numeric-id", "Numeric ID", "[0-9]{6,12}", "Numeric identifier from 6 to 12 digits.", "00248195", "A-0024"),
  createTemplateRule("template-currency", "Currency amount", "(?:[A-Z]{3} )?[0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{2})?", "Optional ISO currency code followed by an amount.", "SAR 1,250.00", "SAR twelve"),
  createTemplateRule("template-code", "Alphanumeric code", "[A-Z0-9]{4,12}", "Uppercase letters and digits, 4-12 characters.", "AB12CD", "ab-12"),
];

function App() {
  const gridRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [columnRules, setColumnRules] = useState({});
  const [fileName, setFileName] = useState("No file loaded");
  const [validationIssues, setValidationIssues] = useState([]);
  const [lastScannedAt, setLastScannedAt] = useState(null);
  const [hasUnscannedChanges, setHasUnscannedChanges] = useState(false);
  const [showRowNumbers, setShowRowNumbers] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [isValidationPanelOpen, setIsValidationPanelOpen] = useState(false);
  const [currentIssueIndex, setCurrentIssueIndex] = useState(-1);
  const [numericConversionNotice, setNumericConversionNotice] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState(null);
  const [allowedValueInput, setAllowedValueInput] = useState("");
  const [existingCategoryValue, setExistingCategoryValue] = useState("");
  const [isExistingCategoryListOpen, setIsExistingCategoryListOpen] = useState(false);
  const [existingCategoryFilter, setExistingCategoryFilter] = useState("");
  const [ruleBuilderTestValue, setRuleBuilderTestValue] = useState("");
  const [savedRegexRules, setSavedRegexRules] = useState(readSavedRegexRules);
  const [isInformationOpen, setIsInformationOpen] = useState(false);
  const [regexTestValue, setRegexTestValue] = useState("");
  const [columnRegexSummary, setColumnRegexSummary] = useState(null);
  const [regexBuilder, setRegexBuilder] = useState(DEFAULT_REGEX_BUILDER);
  const [editingSavedRegexId, setEditingSavedRegexId] = useState("");
  const [relationshipRules, setRelationshipRules] = useState(readSavedRelationships);
  const [relationshipDraft, setRelationshipDraft] = useState(EMPTY_RELATIONSHIP_DRAFT);
  const [relationshipIssues, setRelationshipIssues] = useState([]);
  const [selectedRelationshipFixes, setSelectedRelationshipFixes] = useState([]);
  const [isRelationshipPanelOpen, setIsRelationshipPanelOpen] = useState(false);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findReplaceDraft, setFindReplaceDraft] = useState({ find: "", replace: "", mode: "exact", caseSensitive: true });
  const [isFillDialogOpen, setIsFillDialogOpen] = useState(false);
  const [fillDraft, setFillDraft] = useState(EMPTY_FILL_DRAFT);
  const deferredFillDraft = useDeferredValue(fillDraft);

  useEffect(() => {
    window.localStorage.setItem(REGEX_STORAGE_KEY, JSON.stringify(savedRegexRules));
  }, [savedRegexRules]);

  useEffect(() => {
    window.localStorage.setItem(RELATIONSHIP_STORAGE_KEY, JSON.stringify(relationshipRules));
  }, [relationshipRules]);

  useEffect(() => {
    if (!pendingConfirmation && !isRuleBuilderOpen && !isFillDialogOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPendingConfirmation(null);
      if (event.key === "Escape") setIsRuleBuilderOpen(false);
      if (event.key === "Escape") setIsFillDialogOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFillDialogOpen, isRuleBuilderOpen, pendingConfirmation]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history]);

  const relationshipRuleStates = useMemo(
    () => relationshipRules.map((rule) => ({ ...rule, validation: validateRelationshipRule(rule, columns) })),
    [columns, relationshipRules],
  );
  const relationshipDraftValidation = useMemo(
    () => validateRelationshipRule(relationshipDraft, columns),
    [columns, relationshipDraft],
  );

  const regexRuleLibrary = useMemo(
    () => [...REGEX_CHEAT_SHEET, ...savedRegexRules],
    [savedRegexRules],
  );

  const visibleRows = useMemo(
    () => rows.map((row) => pickColumns(row, visibleColumns)),
    [rows, visibleColumns],
  );

  const visibleColumnRules = useMemo(
    () => Object.fromEntries(visibleColumns.map((column) => [column, resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary)])),
    [columnRules, regexRuleLibrary, visibleColumns],
  );
  const relationshipColumnRules = useMemo(
    () => Object.fromEntries(columns.map((column) => [column, resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary)])),
    [columns, columnRules, regexRuleLibrary],
  );

  const issueCountByColumn = useMemo(() => {
    const counts = {};
    for (const issue of validationIssues) {
      counts[issue.column] = (counts[issue.column] ?? 0) + 1;
    }
    return counts;
  }, [validationIssues]);

  const fillIssueColumns = useMemo(
    () => visibleColumns.filter((column) => (issueCountByColumn[column] ?? 0) > 0),
    [issueCountByColumn, visibleColumns],
  );

  const categoryOptionsByColumn = useMemo(() => {
    const optionsByColumn = {};
    for (const column of columns) {
      const seen = new Set();
      const options = [];
      for (const row of rows) {
        const value = String(row[column] ?? "").trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        options.push(value);
      }
      optionsByColumn[column] = options;
    }
    return optionsByColumn;
  }, [columns, rows]);

  const selectedRule = selectedColumn ? resolveColumnRule(columnRules[selectedColumn] ?? createColumnRule("Text"), regexRuleLibrary) : null;
  const selectedColumnIssueCount = selectedColumn ? issueCountByColumn[selectedColumn] ?? 0 : 0;
  const activeIssue = currentIssueIndex >= 0 ? validationIssues[currentIssueIndex] : null;
  const selectedRegexState = selectedRule ? getCustomRegexState(selectedRule) : { valid: true, error: "" };
  const ruleBuilderRegexState = ruleDraft && isCustomRegexMode(ruleDraft) ? getCustomRegexState(ruleDraft) : { valid: true, error: "" };
  const ruleBuilderTestResult = ruleDraft && ruleBuilderTestValue
    ? validateValue(ruleBuilderTestValue, ruleDraft)
    : null;
  const findReplacePreview = useMemo(
    () => isFindReplaceOpen ? getFindReplacePreview() : { valid: true, count: 0, examples: [] },
    [findReplaceDraft, isFindReplaceOpen, rows, visibleColumns],
  );
  const fillColumnRule = fillDraft.column && fillDraft.column !== ALL_ISSUE_COLUMNS
    ? resolveColumnRule(columnRules[fillDraft.column] ?? createColumnRule("Text"), regexRuleLibrary)
    : null;
  const fillMethods = fillDraft.column === ALL_ISSUE_COLUMNS
    ? getFillMethodsForType("").filter((method) => method.id === "custom")
    : getFillMethodsForType(fillColumnRule?.type ?? "Text");
  const fillPreview = useMemo(() => {
    if (!isFillDialogOpen || !deferredFillDraft.column) return { valid: false, error: "Choose a column.", targetCount: 0, changeCount: 0, skippedCount: 0, examples: [], allocations: [] };
    if (deferredFillDraft.column === ALL_ISSUE_COLUMNS) {
      const columnOptions = fillIssueColumns.map((column) => {
        const rule = resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
        return { column, isValid: (value) => validateValue(value, rule).valid };
      });
      return calculateMultiColumnCustomFill(rows, columnOptions, deferredFillDraft);
    }
    const rule = resolveColumnRule(columnRules[deferredFillDraft.column] ?? createColumnRule("Text"), regexRuleLibrary);
    return calculateColumnFill(rows, {
      ...deferredFillDraft,
      type: rule.type,
      isValid: (value) => validateValue(value, rule).valid,
    });
  }, [columnRules, deferredFillDraft, fillIssueColumns, isFillDialogOpen, regexRuleLibrary, rows]);
  const isFillPreviewPending = deferredFillDraft !== fillDraft;
  const customFillWarning = useMemo(() => {
    if (!isFillDialogOpen || fillDraft.method !== "custom") return "";
    if (isEmptyValue(fillDraft.customValue)) return "Empty replacements will still be reported as missing on the next scan.";
    const columnsToCheck = fillDraft.column === ALL_ISSUE_COLUMNS ? fillIssueColumns : [fillDraft.column];
    const failingColumns = columnsToCheck.filter((column) => {
      const rule = resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
      return !validateValue(fillDraft.customValue, rule).valid;
    });
    if (!failingColumns.length) return "";
    return fillDraft.column === ALL_ISSUE_COLUMNS
      ? `This value will still be invalid in ${failingColumns.length.toLocaleString()} column${failingColumns.length === 1 ? "" : "s"}. You can apply it anyway.`
      : "This value does not pass the current column rule. You can apply it anyway.";
  }, [columnRules, fillDraft, fillIssueColumns, isFillDialogOpen, regexRuleLibrary]);
  const invalidVisibleRegexColumns = useMemo(
    () => visibleColumns.filter((column) => {
      const rule = visibleColumnRules[column];
      return isCustomRegexMode(rule) && !getCustomRegexState(rule).valid;
    }),
    [visibleColumnRules, visibleColumns],
  );
  const canScan = visibleRows.length > 0 && invalidVisibleRegexColumns.length === 0;
  const regexTestResult = selectedRule && isCustomRegexMode(selectedRule) && regexTestValue
    ? validateWithCustomRegex(regexTestValue, selectedRule.customPattern, selectedRule.matchMode)
    : null;
  const fixableRelationshipIssues = useMemo(
    () => relationshipIssues.filter((issue) => issue.fixable),
    [relationshipIssues],
  );
  const validationIssueRowCount = useMemo(
    () => new Set(validationIssues.map((issue) => issue.row)).size,
    [validationIssues],
  );

  const gridColumns = useMemo(
    () =>
      [
        ...(showRowNumbers
          ? [
              {
                headerName: "#",
                valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
                editable: false,
                filter: false,
                sortable: false,
                pinned: "left",
                width: 82,
              },
            ]
          : []),
        ...visibleColumns.map((field) => {
          const rule = resolveColumnRule(columnRules[field] ?? createColumnRule("Text"), regexRuleLibrary);
          return {
            field,
            editable: true,
            filter: true,
            sortable: true,
            resizable: true,
            minWidth: 150,
            cellDataType: false,
            cellEditorSelector: (params) => getCellEditorForType(rule.type, params.value, getCategoryOptionsForRule(rule, categoryOptionsByColumn[field] ?? [])),
            headerComponent: ColumnHeader,
            headerComponentParams: {
              selectedColumn,
              onSelect: selectColumn,
            },
          };
        }),
      ],
    [categoryOptionsByColumn, columnRules, regexRuleLibrary, selectedColumn, showRowNumbers, visibleColumns],
  );

  function loadData(nextRows, nextFileName) {
    const normalizedRows = nextRows.map((row) => normalizeRow(row));
    const nextColumns = collectColumns(normalizedRows);
    const inferredRules = Object.fromEntries(
      nextColumns.map((column) => [column, createColumnRule("Text")]),
    );
    const scopedRows = normalizedRows.map((row) => pickColumns(row, nextColumns));
    const nextIssues = validateRows(scopedRows, inferredRules);

    setRows(normalizedRows);
    setColumns(nextColumns);
    setVisibleColumns(nextColumns);
    setColumnRules(inferredRules);
    setSelectedColumn(nextColumns[0] ?? "");
    setFileName(nextFileName);
    setValidationIssues(nextIssues);
    setLastScannedAt(new Date());
    setHasUnscannedChanges(false);
    setIsValidationPanelOpen(false);
    setCurrentIssueIndex(-1);
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setHistory({ past: [], future: [] });
  }

  async function loadSample() {
    const response = await fetch("./sample_sales.csv");
    const text = await response.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    loadData(parsed.data, "sample_sales.csv");
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      window.alert("CleanSheet currently supports CSV files only.");
      return;
    }

    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    loadData(parsed.data, file.name);
  }

  function handleCellValueChanged(event) {
    const updatedRows = [...rows];
    const rowIndex = event.node.rowIndex;
    const sourceIndex = rows.findIndex((row) => row.__rowId === event.data.__rowId);
    const targetIndex = sourceIndex >= 0 ? sourceIndex : rowIndex;
    updatedRows[targetIndex] = { ...updatedRows[targetIndex], [event.colDef.field]: event.newValue };
    const before = rows[targetIndex]?.[event.colDef.field] ?? "";
    if (String(before) === String(event.newValue ?? "")) return;
    setRows(updatedRows);
    pushHistory({ label: "Edit cell", kind: "cells", changes: [{ rowId: event.data.__rowId, column: event.colDef.field, before, after: event.newValue }] });
    setHasUnscannedChanges(true);
  }

  function pushHistory(action) {
    setHistory((current) => ({ past: [...current.past, action].slice(-HISTORY_LIMIT), future: [] }));
  }

  function applyCellChanges(currentRows, changes, direction) {
    const changesByRow = new Map();
    for (const change of changes) {
      const rowChanges = changesByRow.get(change.rowId) ?? [];
      rowChanges.push(change);
      changesByRow.set(change.rowId, rowChanges);
    }
    return currentRows.map((row) => {
      const matching = changesByRow.get(row.__rowId);
      if (!matching?.length) return row;
      const nextRow = { ...row };
      for (const change of matching) nextRow[change.column] = direction === "undo" ? change.before : change.after;
      return nextRow;
    });
  }

  function undo() {
    const action = history.past.at(-1);
    if (!action) return;
    setRows((currentRows) => action.kind === "deleteRows"
      ? restoreDeletedRows(currentRows, action.rows)
      : applyCellChanges(currentRows, action.changes, "undo"));
    setHistory((current) => ({ past: current.past.slice(0, -1), future: [...current.future, action] }));
    clearDerivedResults();
  }

  function redo() {
    const action = history.future.at(-1);
    if (!action) return;
    setRows((currentRows) => action.kind === "deleteRows"
      ? currentRows.filter((row) => !action.rows.some((item) => item.row.__rowId === row.__rowId))
      : applyCellChanges(currentRows, action.changes, "redo"));
    setHistory((current) => ({ past: [...current.past, action].slice(-HISTORY_LIMIT), future: current.future.slice(0, -1) }));
    clearDerivedResults();
  }

  function clearDerivedResults() {
    setValidationIssues([]);
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setCurrentIssueIndex(-1);
    setHasUnscannedChanges(true);
  }

  function getFindReplacePreview() {
    const matcher = createFindMatcher(findReplaceDraft);
    if (!matcher.valid) return { valid: false, error: matcher.error, count: 0, examples: [] };
    const examples = [];
    let count = 0;
    for (const row of rows) {
      for (const column of visibleColumns) {
        const before = String(row[column] ?? "");
        const after = matcher.replace(before, findReplaceDraft.replace);
        if (after === before) continue;
        count += 1;
        if (examples.length < 5) examples.push({ column, before, after });
      }
    }
    return { valid: true, count, examples };
  }

  function applyFindReplace() {
    const preview = getFindReplacePreview();
    if (!preview.valid || !preview.count) return;
    requestConfirmation({
      title: "Apply Find & Replace?",
      message: `Replace ${preview.count.toLocaleString()} value${preview.count === 1 ? "" : "s"} across ${visibleColumns.length.toLocaleString()} visible columns?`,
      confirmLabel: "Apply replacements",
      tone: "default",
      onConfirm: () => {
        const matcher = createFindMatcher(findReplaceDraft);
        const changes = [];
        const nextRows = rows.map((row) => {
          const nextRow = { ...row };
          for (const column of visibleColumns) {
            const before = String(row[column] ?? "");
            const after = matcher.replace(before, findReplaceDraft.replace);
            if (after === before) continue;
            nextRow[column] = after;
            changes.push({ rowId: row.__rowId, column, before: row[column], after });
          }
          return nextRow;
        });
        setRows(nextRows);
        pushHistory({ label: "Find & Replace", kind: "cells", changes });
        clearDerivedResults();
        setIsFindReplaceOpen(false);
      },
    });
  }

  function handleVisibleColumnToggle(column) {
    const nextVisibleColumns = visibleColumns.includes(column)
      ? visibleColumns.filter((item) => item !== column)
      : columns.filter((item) => visibleColumns.includes(item) || item === column);
    setVisibleColumns(nextVisibleColumns);
    if (!nextVisibleColumns.includes(selectedColumn)) {
      selectColumn(nextVisibleColumns[0] ?? "");
    }
    setHasUnscannedChanges(true);
  }

  function handleVisibleColumnsChange(nextColumns) {
    setVisibleColumns(nextColumns);
    if (!nextColumns.includes(selectedColumn)) {
      selectColumn(nextColumns[0] ?? "");
    }
    setHasUnscannedChanges(true);
  }

  function selectColumn(nextColumn) {
    if (nextColumn === selectedColumn) return;

    if (selectedColumn) {
      const currentRule = columnRules[selectedColumn] ?? createColumnRule("Text");
      if (isCustomRegexMode(currentRule) && !getCustomRegexState(currentRule).valid) {
        setColumnRules((currentRules) => ({
          ...currentRules,
          [selectedColumn]: {
            ...currentRule,
            mode: "preset",
            customPattern: "",
            customPatternLabel: "",
            savedRegexId: "",
          },
        }));
      }
    }

    setSelectedColumn(nextColumn);
    setEditingSavedRegexId("");
    setRegexTestValue("");
    setColumnRegexSummary(null);
    setNumericConversionNotice("");
    const nextRule = resolveColumnRule(columnRules[nextColumn] ?? createColumnRule("Text"), regexRuleLibrary);
    setRegexBuilder(nextRule.builder ?? DEFAULT_REGEX_BUILDER);
  }

  function handleExpectedTypeChange(column, nextType) {
    setColumnRules({ ...columnRules, [column]: createColumnRule(nextType) });
    setEditingSavedRegexId("");
    setNumericConversionNotice("");
    setHasUnscannedChanges(true);
  }

  function openRuleBuilder() {
    if (!selectedColumn) return;
    const currentRule = resolveColumnRule(columnRules[selectedColumn] ?? createColumnRule("Text"), regexRuleLibrary);
    setRuleDraft({
      ...currentRule,
      mode: currentRule.mode ?? "preset",
      friendlyKind: currentRule.friendlyKind ?? (currentRule.type === "Category" ? "allowedValues" : "textMatch"),
      allowedValues: currentRule.allowedValues ?? [],
      textMatchMode: currentRule.textMatchMode ?? "exact",
      textValue: currentRule.textValue ?? "",
      minValue: currentRule.minValue ?? "",
      maxValue: currentRule.maxValue ?? "",
      builder: currentRule.builder ?? DEFAULT_REGEX_BUILDER,
    });
    setAllowedValueInput("");
    setExistingCategoryValue("");
    setExistingCategoryFilter("");
    setIsExistingCategoryListOpen(false);
    setRuleBuilderTestValue("");
    setIsRuleBuilderOpen(true);
  }

  function updateRuleDraft(field, value) {
    setRuleDraft((currentRule) => ({ ...currentRule, [field]: value }));
  }

  function selectRuleMode(mode) {
    setRuleDraft((currentRule) => ({
      ...currentRule,
      mode,
      friendlyKind: mode === "friendly" ? getDefaultFriendlyKind(currentRule.type) : currentRule.friendlyKind,
    }));
  }

  function addAllowedValues(input = allowedValueInput) {
    const values = String(input)
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!values.length) return;
    setRuleDraft((currentRule) => ({
      ...currentRule,
      allowedValues: [...new Set([...(currentRule.allowedValues ?? []), ...values])],
    }));
    setAllowedValueInput("");
  }

  function removeAllowedValue(value) {
    setRuleDraft((currentRule) => ({
      ...currentRule,
      allowedValues: (currentRule.allowedValues ?? []).filter((item) => item !== value),
    }));
  }

  function applyDraftRegexBuilder() {
    setRuleDraft((currentRule) => ({
      ...currentRule,
      mode: "customRegex",
      customPattern: buildRegexFromBuilder(currentRule.builder ?? DEFAULT_REGEX_BUILDER),
    }));
  }

  function applySavedRegexToDraft(savedRegexId) {
    const savedRule = regexRuleLibrary.find((item) => item.id === savedRegexId);
    if (!savedRule) return;
    setRuleDraft((currentRule) => ({
      ...currentRule,
      mode: "customRegex",
      customPattern: savedRule.pattern,
      customPatternLabel: savedRule.label,
      savedRegexId: savedRule.id,
      matchMode: savedRule.matchMode ?? "full",
      builder: savedRule.builder ?? DEFAULT_REGEX_BUILDER,
    }));
  }

  function saveRuleDraft() {
    if (!selectedColumn || !ruleDraft) return;
    if (isCustomRegexMode(ruleDraft) && !getCustomRegexState(ruleDraft).valid) return;
    setColumnRules((currentRules) => ({ ...currentRules, [selectedColumn]: ruleDraft }));
    setColumnRegexSummary(null);
    setHasUnscannedChanges(true);
    setIsRuleBuilderOpen(false);
  }

  function saveDraftRegexForReuse() {
    if (!ruleDraft || !isCustomRegexMode(ruleDraft)) return;
    const regexState = getCustomRegexState(ruleDraft);
    const label = ruleDraft.customPatternLabel?.trim();
    if (!regexState.valid || !label) return;
    const savedRegexId = savedRegexRules.some((savedRule) => savedRule.id === ruleDraft.savedRegexId)
      ? ruleDraft.savedRegexId
      : `regex-${Date.now()}`;
    const nextSavedRule = {
      id: savedRegexId,
      label,
      pattern: ruleDraft.customPattern.trim(),
      matchMode: ruleDraft.matchMode ?? "full",
      builder: ruleDraft.builder ?? DEFAULT_REGEX_BUILDER,
      description: "Custom validation rule.",
      examples: [],
      source: "user",
    };
    setSavedRegexRules((currentRules) => (
      currentRules.some((savedRule) => savedRule.id === savedRegexId)
        ? currentRules.map((savedRule) => (savedRule.id === savedRegexId ? nextSavedRule : savedRule))
        : [...currentRules, nextSavedRule]
    ));
    setRuleDraft((currentRule) => ({ ...currentRule, savedRegexId }));
  }

  function handlePresetChange(column, presetId) {
    const currentRule = columnRules[column] ?? createColumnRule("Text");
    if (presetId === CUSTOM_REGEX_PRESET_ID) {
      setColumnRules({
        ...columnRules,
        [column]: {
          ...currentRule,
          mode: "customRegex",
        },
      });
    } else {
      setColumnRules({
        ...columnRules,
        [column]: {
          ...currentRule,
          presetId,
          mode: "preset",
        },
      });
    }
    if (presetId !== CUSTOM_REGEX_PRESET_ID) setEditingSavedRegexId("");
    setHasUnscannedChanges(true);
  }

  function handleCustomPatternChange(column, customPattern) {
    const currentRule = columnRules[column] ?? createColumnRule("Text");
    setColumnRules({
      ...columnRules,
      [column]: {
        ...currentRule,
        mode: "customRegex",
        customPattern,
        savedRegexId: editingSavedRegexId || "",
      },
    });
    setColumnRegexSummary(null);
    setHasUnscannedChanges(true);
  }

  function handleCustomPatternLabelChange(column, customPatternLabel) {
    const currentRule = columnRules[column] ?? createColumnRule("Text");
    setColumnRules({
      ...columnRules,
      [column]: {
        ...currentRule,
        mode: "customRegex",
        customPatternLabel,
        savedRegexId: editingSavedRegexId || "",
      },
    });
    setColumnRegexSummary(null);
    setHasUnscannedChanges(true);
  }

  function handleRegexMatchModeChange(matchMode) {
    const currentRule = columnRules[selectedColumn] ?? createColumnRule("Text");
    setColumnRules({
      ...columnRules,
      [selectedColumn]: {
        ...currentRule,
        mode: "customRegex",
        matchMode,
        savedRegexId: editingSavedRegexId || "",
      },
    });
    setColumnRegexSummary(null);
    setHasUnscannedChanges(true);
  }

  function updateRegexBuilder(field, value) {
    setRegexBuilder((currentBuilder) => ({ ...currentBuilder, [field]: value }));
  }

  function applyRegexBuilder() {
    const customPattern = buildRegexFromBuilder(regexBuilder);
    handleCustomPatternChange(selectedColumn, customPattern);
    setColumnRules((currentRules) => ({
      ...currentRules,
      [selectedColumn]: {
        ...(currentRules[selectedColumn] ?? createColumnRule("Text")),
        mode: "customRegex",
        customPattern,
        builder: regexBuilder,
        savedRegexId: editingSavedRegexId || "",
      },
    }));
  }

  function saveCurrentRegex() {
    const rule = columnRules[selectedColumn] ?? createColumnRule("Text");
    const regexState = getCustomRegexState(rule);
    const label = rule.customPatternLabel.trim();
    if (!regexState.valid || !label) return;

    const savedRegexId = savedRegexRules.some((savedRule) => savedRule.id === rule.savedRegexId)
      ? rule.savedRegexId
      : `regex-${Date.now()}`;
    const nextSavedRule = {
      id: savedRegexId,
      label,
      pattern: rule.customPattern.trim(),
      matchMode: rule.matchMode ?? "full",
      builder: regexBuilder,
      description: "Custom validation rule.",
      examples: [],
      source: "user",
    };

    setSavedRegexRules((currentRules) => {
      const exists = currentRules.some((savedRule) => savedRule.id === savedRegexId);
      return exists
        ? currentRules.map((savedRule) => (savedRule.id === savedRegexId ? nextSavedRule : savedRule))
        : [...currentRules, nextSavedRule];
    });
    setColumnRules({
      ...columnRules,
      [selectedColumn]: {
        ...rule,
        mode: "customRegex",
        savedRegexId,
      },
    });
    setEditingSavedRegexId(savedRegexId);
    setColumnRegexSummary(null);
    setHasUnscannedChanges(true);
  }

  function applySavedRegexToColumn(column, savedRegexId, forEditing = false) {
    const savedRule = regexRuleLibrary.find((item) => item.id === savedRegexId);
    if (!savedRule) return;

    const currentRule = columnRules[column] ?? createColumnRule("Text");
    setColumnRules((currentRules) => ({
      ...currentRules,
      [column]: {
        ...currentRule,
        mode: "customRegex",
        customPattern: savedRule.pattern,
        customPatternLabel: savedRule.label,
        savedRegexId: savedRule.id,
        matchMode: savedRule.matchMode ?? "full",
        builder: savedRule.builder ?? DEFAULT_REGEX_BUILDER,
      },
    }));
    setRegexBuilder(savedRule.builder ?? DEFAULT_REGEX_BUILDER);
    setEditingSavedRegexId(forEditing && savedRule.source !== "template" ? savedRule.id : "");
    setColumnRegexSummary(null);
    setHasUnscannedChanges(true);
  }

  function duplicateSavedRegex(savedRegexId) {
    const savedRule = savedRegexRules.find((item) => item.id === savedRegexId);
    if (!savedRule) return;
    const duplicate = { ...savedRule, id: `regex-${Date.now()}`, label: `${savedRule.label} copy` };
    setSavedRegexRules((currentRules) => [...currentRules, duplicate]);
  }

  function deleteSavedRegex(savedRegexId) {
    setSavedRegexRules((currentRules) => currentRules.filter((item) => item.id !== savedRegexId));
    setColumnRules((currentRules) => Object.fromEntries(Object.entries(currentRules).map(([column, rule]) => (
      rule.savedRegexId === savedRegexId ? [column, { ...rule, savedRegexId: "" }] : [column, rule]
    ))));
    setColumnRegexSummary(null);
  }

  function testSelectedColumnRegex() {
    if (!selectedColumn || !selectedRule || !isCustomRegexMode(selectedRule)) return;
    setColumnRegexSummary(getRegexColumnSummary(rows, selectedColumn, selectedRule));
  }

  function updateRelationshipDraft(field, value) {
    setRelationshipDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function insertRelationshipColumn(column) {
    setRelationshipDraft((currentDraft) => ({
      ...currentDraft,
      formula: `${currentDraft.formula}${currentDraft.formula ? " " : ""}[${column}]`,
    }));
  }

  function insertRelationshipToken(token) {
    setRelationshipDraft((currentDraft) => ({
      ...currentDraft,
      formula: `${currentDraft.formula}${currentDraft.formula ? " " : ""}${token}`,
    }));
  }

  function saveRelationshipRule() {
    if (!relationshipDraftValidation.valid) return;
    const nextRule = {
      ...relationshipDraft,
      id: relationshipDraft.id || `relationship-${Date.now()}`,
      name: relationshipDraft.name.trim() || `${relationshipDraft.targetColumn} calculation`,
      formula: relationshipDraft.formula.trim(),
      enabled: relationshipDraft.enabled !== false,
    };
    setRelationshipRules((currentRules) => (
      currentRules.some((rule) => rule.id === nextRule.id)
        ? currentRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
        : [...currentRules, nextRule]
    ));
    setRelationshipDraft(EMPTY_RELATIONSHIP_DRAFT);
  }

  function editRelationshipRule(rule) {
    setRelationshipDraft({ ...rule });
    setIsRelationshipPanelOpen(true);
  }

  function duplicateRelationshipRule(rule) {
    setRelationshipDraft({ ...rule, id: "", name: `${rule.name} copy` });
    setIsRelationshipPanelOpen(true);
  }

  function toggleRelationshipRule(ruleId) {
    setRelationshipRules((currentRules) => currentRules.map((rule) => (
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    )));
  }

  function deleteRelationshipRule(ruleId) {
    setRelationshipRules((currentRules) => currentRules.filter((rule) => rule.id !== ruleId));
    setRelationshipIssues((currentIssues) => currentIssues.filter((issue) => issue.ruleId !== ruleId));
    setSelectedRelationshipFixes([]);
  }

  function checkRelationshipRules(ruleId = null) {
    const rulesToCheck = relationshipRuleStates.filter((rule) => rule.enabled && rule.validation.valid && (!ruleId || rule.id === ruleId));
    const nextIssues = rulesToCheck.flatMap((rule) => checkRelationshipRows(rows, rule, rule.validation.ast, relationshipColumnRules));
    setRelationshipIssues((currentIssues) => {
      const retainedIssues = ruleId
        ? currentIssues.filter((issue) => issue.ruleId !== ruleId)
        : currentIssues.filter((issue) => !rulesToCheck.some((rule) => rule.id === issue.ruleId));
      return [...retainedIssues, ...nextIssues];
    });
    setSelectedRelationshipFixes([]);
  }

  function toggleRelationshipFix(issueId) {
    setSelectedRelationshipFixes((currentIds) => (
      currentIds.includes(issueId) ? currentIds.filter((id) => id !== issueId) : [...currentIds, issueId]
    ));
  }

  function toggleAllRelationshipFixes() {
    const fixableIds = fixableRelationshipIssues.map((issue) => issue.id);
    const areAllSelected = fixableIds.length > 0 && fixableIds.every((id) => selectedRelationshipFixes.includes(id));
    setSelectedRelationshipFixes(areAllSelected ? [] : fixableIds);
  }

  function applySelectedRelationshipFixes() {
    const fixesByRowId = new Map(
      relationshipIssues
        .filter((issue) => issue.fixable && selectedRelationshipFixes.includes(issue.id))
        .map((issue) => [`${issue.rowId}:${issue.targetColumn}`, issue]),
    );
    if (!fixesByRowId.size) return;

    const changes = [];
    const nextRows = rows.map((row) => {
      const nextRow = { ...row };
      for (const issue of fixesByRowId.values()) {
        if (issue.rowId === row.__rowId) {
          changes.push({ rowId: row.__rowId, column: issue.targetColumn, before: row[issue.targetColumn], after: issue.suggestedValue });
          nextRow[issue.targetColumn] = issue.suggestedValue;
        }
      }
      return nextRow;
    });
    setRows(nextRows);
    if (changes.length) pushHistory({ label: "Apply relationship fixes", kind: "cells", changes });
    setRelationshipIssues((currentIssues) => currentIssues.filter((issue) => !selectedRelationshipFixes.includes(issue.id)));
    setSelectedRelationshipFixes([]);
    setHasUnscannedChanges(true);
  }

  function scanForIssues() {
    const nextIssues = validateRows(visibleRows, visibleColumnRules);
    setValidationIssues(nextIssues);
    setLastScannedAt(new Date());
    setHasUnscannedChanges(false);
    setIsValidationPanelOpen(false);
    setCurrentIssueIndex(-1);
  }

  function deleteRowsWithValidationIssues() {
    if (!validationIssueRowCount) return;
    requestConfirmation({
      title: "Delete rows with issues?",
      message: `Delete ${validationIssueRowCount.toLocaleString()} row${validationIssueRowCount === 1 ? "" : "s"} with validation issues? This cannot be undone in CleanSheet.`,
      confirmLabel: "Delete rows",
      tone: "danger",
      onConfirm: performDeleteRowsWithValidationIssues,
    });
  }

  function performDeleteRowsWithValidationIssues() {
    const issueRowIds = new Set(validationIssues.map((issue) => issue.rowId).filter(Boolean));
    const deletedRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => issueRowIds.size ? issueRowIds.has(row.__rowId) : validationIssues.some((issue) => issue.row - 1 === index));
    setRows(rows.filter((row) => !deletedRows.some((item) => item.row.__rowId === row.__rowId)));
    if (deletedRows.length) pushHistory({ label: "Delete rows with issues", kind: "deleteRows", rows: deletedRows });
    setValidationIssues([]);
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setCurrentIssueIndex(-1);
    setIsValidationPanelOpen(false);
    setHasUnscannedChanges(true);
  }

  function openFillDialog(preferredColumn = "") {
    if (!fillIssueColumns.length) return;
    const nextColumn = fillIssueColumns.includes(preferredColumn)
      ? preferredColumn
      : fillIssueColumns.includes(activeIssue?.column)
        ? activeIssue.column
        : fillIssueColumns[0];
    setFillDraft({ ...EMPTY_FILL_DRAFT, column: nextColumn });
    setIsFillDialogOpen(true);
  }

  function changeFillColumn(column) {
    setFillDraft((currentDraft) => ({ ...currentDraft, column, method: "custom" }));
  }

  function buildCurrentFillPlan(collectChanges = false) {
    if (fillDraft.column === ALL_ISSUE_COLUMNS) {
      const columnOptions = fillIssueColumns.map((column) => {
        const rule = resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
        return { column, isValid: (value) => validateValue(value, rule).valid };
      });
      return calculateMultiColumnCustomFill(rows, columnOptions, fillDraft, collectChanges);
    }
    const rule = resolveColumnRule(columnRules[fillDraft.column] ?? createColumnRule("Text"), regexRuleLibrary);
    return calculateColumnFill(rows, {
      ...fillDraft,
      type: rule.type,
      isValid: (value) => validateValue(value, rule).valid,
    }, collectChanges);
  }

  function applyFillPlan() {
    const plan = buildCurrentFillPlan(true);
    if (!plan.valid || !plan.changes?.length) return;
    const methodLabel = fillMethods.find((method) => method.id === fillDraft.method)?.label ?? "Fill values";
    setRows((currentRows) => applyCellChanges(currentRows, plan.changes, "redo"));
    pushHistory({ label: `${methodLabel}: ${fillDraft.column === ALL_ISSUE_COLUMNS ? "all issue columns" : fillDraft.column}`, kind: "cells", changes: plan.changes });
    setIsFillDialogOpen(false);
    setIsValidationPanelOpen(false);
    clearDerivedResults();
  }

  function convertSelectedNumericColumn(targetType) {
    if (!selectedColumn) return;
    requestConfirmation({
      title: `Convert ${selectedColumn}?`,
      message: `Convert numeric values in "${selectedColumn}" to ${targetType === "Integer" ? "integers by removing decimal parts" : "normalized decimal numbers"}? Invalid and empty cells will be skipped.`,
      confirmLabel: targetType === "Integer" ? "Convert to Integer" : "Convert to Float",
      tone: "default",
      onConfirm: () => performNumericColumnConversion(targetType),
    });
  }

  function performNumericColumnConversion(targetType) {
    let convertedCount = 0;
    let skippedCount = 0;
    const nextRows = rows.map((row) => {
      const numericValue = parseNumericValueForConversion(row[selectedColumn]);
      if (numericValue === null) {
        if (!isEmptyValue(row[selectedColumn])) skippedCount += 1;
        return row;
      }
      convertedCount += 1;
      const normalizedValue = targetType === "Integer"
        ? String(Math.trunc(numericValue))
        : Number.isInteger(numericValue) ? `${numericValue}.0` : String(numericValue);
      return { ...row, [selectedColumn]: normalizedValue };
    });
    const conversionChanges = nextRows
      .filter((row, index) => String(row[selectedColumn]) !== String(rows[index][selectedColumn]))
      .map((row, index) => ({ rowId: row.__rowId, column: selectedColumn, before: rows[index][selectedColumn], after: row[selectedColumn] }));
    const currentRule = columnRules[selectedColumn] ?? createColumnRule("Text");
    const nextColumnRules = {
      ...columnRules,
      [selectedColumn]: isCustomRegexMode(currentRule)
        ? { ...currentRule, type: targetType }
        : createColumnRule(targetType),
    };
    const nextVisibleRows = nextRows.map((row) => pickColumns(row, visibleColumns));
    const nextVisibleColumnRules = Object.fromEntries(
      visibleColumns.map((column) => [
        column,
        resolveColumnRule(nextColumnRules[column] ?? createColumnRule("Text"), regexRuleLibrary),
      ]),
    );
    setRows(nextRows);
    if (conversionChanges.length) pushHistory({ label: `Convert ${selectedColumn}`, kind: "cells", changes: conversionChanges });
    setColumnRules(nextColumnRules);
    setValidationIssues(validateRows(nextVisibleRows, nextVisibleColumnRules));
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setCurrentIssueIndex(-1);
    setLastScannedAt(new Date());
    setNumericConversionNotice(`${convertedCount.toLocaleString()} values converted${skippedCount ? `; ${skippedCount.toLocaleString()} invalid values skipped` : ""}.`);
    setColumnRegexSummary(null);
    setHasUnscannedChanges(false);
  }

  function requestConfirmation(confirmation) {
    setPendingConfirmation(confirmation);
  }

  function cancelConfirmation() {
    setPendingConfirmation(null);
  }

  function confirmPendingAction() {
    const confirmation = pendingConfirmation;
    setPendingConfirmation(null);
    confirmation?.onConfirm();
  }

  function jumpToNextIssue() {
    if (!validationIssues.length) return;

    const nextIndex = (currentIssueIndex + 1 + validationIssues.length) % validationIssues.length;
    const issue = validationIssues[nextIndex];
    const rowIndex = Math.max(0, issue.row - 1);
    const api = gridRef.current?.api;

    setCurrentIssueIndex(nextIndex);
    selectColumn(issue.column);

    if (!api) return;

    api.paginationGoToPage(Math.floor(rowIndex / 100));
    api.ensureColumnVisible(issue.column);
    api.ensureIndexVisible(rowIndex, "middle");
    api.setFocusedCell(rowIndex, issue.column);

    const rowNode = api.getDisplayedRowAtIndex(rowIndex);
    if (rowNode) {
      api.flashCells({ rowNodes: [rowNode], columns: [issue.column] });
    }
  }

  function exportCsv() {
    const exportRows = visibleRows.map(({ __rowId, ...row }) => row);
    const csv = Papa.unparse(exportRows);
    downloadCsv(csv, "cleansheet_export.csv");
  }

  function exportIssuesCsv() {
    const csv = Papa.unparse(validationIssues.map(({ rowId, ...issue }) => issue));
    downloadCsv(csv, "cleansheet_validation_issues.csv");
  }

  function downloadCsv(csv, outputFileName) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = outputFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand">CleanSheet</div>
        </div>

        <section className="control-section">
          <h2>Load data</h2>
          <button type="button" onClick={loadSample}>Load Sample Dataset</button>
          <label className="file-picker">
            Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} />
          </label>
          <span className="file-name">{fileName}</span>
        </section>

        <section className="control-section">
          <h2>Visible columns</h2>
          <div className="view-summary">
            <span>{visibleColumns.length}/{columns.length} shown</span>
          </div>
          <div className="column-controls">
            <label className="check-row row-number-toggle">
              <input
                type="checkbox"
                checked={showRowNumbers}
                onChange={() => setShowRowNumbers(!showRowNumbers)}
              />
              <span className="fake-checkbox" aria-hidden="true" />
              <span className="column-name">Show row numbers</span>
            </label>
            <div className="column-actions">
              <button type="button" onClick={() => handleVisibleColumnsChange(columns)} disabled={!columns.length}>
                Show All
              </button>
              <button type="button" onClick={() => handleVisibleColumnsChange([])} disabled={!columns.length}>
                Hide All
              </button>
            </div>
          </div>
          <div className="column-list-heading">
            <span>Dataset columns</span>
          </div>
          <div className="column-list">
            {columns.map((column) => (
              <div
                key={column}
                className={`column-item ${selectedColumn === column ? "selected" : ""}`}
              >
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column)}
                    onChange={() => handleVisibleColumnToggle(column)}
                  />
                  <span className="fake-checkbox" aria-hidden="true" />
                  <button
                    type="button"
                    className="column-select"
                    onClick={() => selectColumn(column)}
                  >
                    <span className="column-name">{column}</span>
                    <span className="column-meta">{columnRules[column]?.type ?? "Text"}</span>
                  </button>
                </label>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <section className="panel">
          <div className="workspace-header">
            <div>
              <h1>{fileName}</h1>
              <p>Double click cells to edit. Select a column to change its type and format.</p>
              <p className="unsaved-changes-warning">The app doesn't save changes. Refreshing the page will discard all changes (Use Export) (:</p>
            </div>
            <div className="workspace-actions">
              <button type="button" onClick={scanForIssues} disabled={!canScan}>
                Scan Again
              </button>
              <button type="button" className="export-button" onClick={exportCsv} disabled={!visibleRows.length}>
                Export CSV
              </button>
            </div>
          </div>

          <div className="workspace-toolbar">
            <div className="toolbar-chip-group">
              <ToolbarChip label="Rows" value={visibleRows.length.toLocaleString()} />
              <ToolbarChip label="Columns" value={visibleColumns.length.toLocaleString()} />
              <ToolbarChip label="Issues" value={validationIssues.length.toLocaleString()} tone="danger" />
            </div>
            <div className={`status-chip ${hasUnscannedChanges ? "warning" : "ok"}`}>
              {hasUnscannedChanges ? "Needs scan" : "Last change"}
              {lastScannedAt ? ` • ${lastScannedAt.toLocaleTimeString()}` : ""}
            </div>
          </div>

          <section className="information-panel">
            <button
              type="button"
              className="information-toggle"
              onClick={() => setIsInformationOpen(!isInformationOpen)}
            >
              <span>Information (Tutorial)</span>
              <span>{isInformationOpen ? "Hide walkthrough" : "Sample walkthrough"}</span>
            </button>
            {isInformationOpen && (
              <div className="information-content">
                <div className="information-intro">
                  <strong>Try it with the sample dataset</strong>
                  <p>Load the sample, then follow the steps below to get familiar with the project</p>
                </div>
                <ol className="walkthrough-list">
                  <li>
                    <span>1</span>
                    <div><strong>Load the sample</strong><p>Use <HintCode hint="Loads the built-in practice CSV without uploading a file.">Load Sample Dataset</HintCode> in the sidebar. It contains a dirty dataset I 'borrowed' from Kaggle</p></div>
                  </li>
                  <li>
                    <span>2</span>
                    <div><strong>Choose what to scan</strong><p>Only visible columns are included when you <HintCode hint="Checks every visible cell against the type and format selected for its column. Changing a column type changes what the next scan considers valid.">Scan</HintCode>. For now, <HintCode hint="Removes a column from the table and excludes it from scanning.">Hide</HintCode> everything except <span className="column-reference">Quantity</span>, <span className="column-reference">Price Per Unit</span>, and <span className="column-reference">Total Spent</span></p></div>
                  </li>
                  <li>
                    <span>3</span>
                    <div><strong>Set column types</strong><p>Choose <code>Number</code> for <span className="column-reference">Quantity</span>, <span className="column-reference">Price Per Unit</span>, and <span className="column-reference">Total Spent</span> by clicking each column name in the table below and changing the option that appears on the right, then click <HintCode hint="Checks every visible cell against the type and format selected for its column">Scan Again</HintCode>. Column types do not change your data; they tell the scanner what each cell should look like, and every visible cell is checked against its column's selected type during a scan</p></div>
                  </li>
                  <li>
                    <span>4</span>
                    <div>
                      <strong>Link the three number columns</strong>
                      <p>In <HintCode hint="Creates formulas between columns to find and fill missing calculated values.">Column Relationships</HintCode>, add these three rules:</p>
                      <div className="formula-reference-list">
                        <span className="formula-reference">Total Spent = [Quantity] * [Price Per Unit]</span>
                        <span className="formula-reference">Quantity = [Total Spent] / [Price Per Unit]</span>
                        <span className="formula-reference">Price Per Unit = [Total Spent] / [Quantity]</span>
                      </div>
                      <p>Click <HintCode hint="Runs every enabled relationship formula against the dataset.">Check all relationships</HintCode>, select the fixable rows, then apply the selected fixes to fill missing values</p>
                    </div>
                  </li>
                  <li>
                    <span>5</span>
                    <div><strong>Scan and fix</strong><p>Click <HintCode hint="Checks every visible cell against its column type again after your edits.">Scan Again</HintCode> to catch values such as ERROR or unknown in <span className="column-reference">Total Spent</span>, open <HintCode hint="Shows every empty or invalid cell found during the latest scan">Validation Issues</HintCode> to review them, then choose <HintCode hint="Opens automatic filling methods for the detected empty or invalid cells">Fill invalid values</HintCode> and use whichever filling method fits your data</p></div>
                  </li>
                  <li>
                    <span>6</span>
                    <div><strong>Manual fix</strong><p>If automatic filling cannot handle an issue, use <HintCode hint="Jumps the table to the next detected problem.">Next Row</HintCode> to find it, then click the cell and edit it. Category cells offer existing values as choices</p></div>
                  </li>
                  <li>
                    <span>7</span>
                    <div><strong>Remove rows the formulas cannot fix</strong><p>Some rows are missing values in two or more related columns, so the formulas do not have enough information to calculate them. After fixing the other problems and scanning again, open <HintCode hint="Shows every empty or invalid cell found during the latest scan">Validation Issues</HintCode> and choose <HintCode hint="Removes every row containing at least one issue from the latest scan">Delete rows with issues</HintCode> to remove the remaining incomplete rows (use this option only when no valid fix can be applied)</p></div>
                  </li>
                  <li>
                    <span>8</span>
                    <div><strong>Try the rest of the table</strong><p>Now show the remaining columns and try cleaning the rest on your own. There are category and date issues, set their types and formats, scan again, and fix what you find</p></div>
                  </li>
                  <li>
                    <span>9</span>
                    <div><strong>Export when finished</strong><p><HintCode hint="Downloads the currently visible columns as a new CSV file.">Export CSV</HintCode> When you are done, all changes will be applied</p></div>
                  </li>
                </ol>
              </div>
            )}
          </section>

          <section className="relationship-panel">
            <button
              type="button"
              className="relationship-toggle"
              onClick={() => setIsRelationshipPanelOpen(!isRelationshipPanelOpen)}
            >
              <span>Column Relationships</span>
              <span>{relationshipRules.length} rule{relationshipRules.length === 1 ? "" : "s"}</span>
            </button>
            {isRelationshipPanelOpen && (
              <div className="relationship-content">
                <div className="relationship-editor">
                  <div>
                    <span className="field-label">{relationshipDraft.id ? "Edit relationship" : "New relationship"}</span>
                    <p>Build a formula using your columns Example: [Target Column] = [Unit amount] * [Unit price]<br />
                      You don't have to add equal sign '=' the assigned [Target Column] is what's on the left side of the equation</p>
                  </div>
                  <label>
                    <span>Rule name (optional)</span>
                    <input value={relationshipDraft.name} onChange={(event) => updateRelationshipDraft("name", event.target.value)} placeholder="Order total" />
                  </label>
                  <label>
                    <span>Target column</span>
                    <select value={relationshipDraft.targetColumn} onChange={(event) => updateRelationshipDraft("targetColumn", event.target.value)}>
                      <option value="">Choose target column</option>
                      {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Formula</span>
                    <input value={relationshipDraft.formula} onChange={(event) => updateRelationshipDraft("formula", event.target.value)} placeholder="[Unit amount] * [Unit price]" />
                  </label>
                  <div className="formula-tools">
                    <span className="field-label">Math symbols </span>
                    <div className="formula-token-picker" aria-label="Insert math symbols">
                      <button type="button" onClick={() => insertRelationshipToken("+")} title="Add">+ Add</button>
                      <button type="button" onClick={() => insertRelationshipToken("-")} title="Subtract or make the next value negative">- Subtract</button>
                      <button type="button" onClick={() => insertRelationshipToken("*")} title="Multiply">* Multiply</button>
                      <button type="button" onClick={() => insertRelationshipToken("/")} title="Divide">/ Divide</button>
                      <button type="button" onClick={() => insertRelationshipToken("%")} title="Remainder after division">% Remainder</button>
                      <button type="button" onClick={() => insertRelationshipToken("(")} title="Open a grouped calculation">( Open</button>
                      <button type="button" onClick={() => insertRelationshipToken(")")} title="Close a grouped calculation">) Close</button>
                    </div>
                    <p>All the symbols follows the order of operations also you can use the keyboard (you don't have to use the buttons), add a number directly in the formula when needed.</p>
                  </div>
                  <div className="formula-column-picker">
                    {columns.map((column) => (
                      <button type="button" key={column} onClick={() => insertRelationshipColumn(column)}>{column}</button>
                    ))}
                  </div>
                  {!relationshipDraftValidation.valid && relationshipDraft.formula && (
                    <div className="relationship-error">{relationshipDraftValidation.error}</div>
                  )}
                  <div className="relationship-editor-actions">
                    <button type="button" onClick={saveRelationshipRule} disabled={!relationshipDraftValidation.valid}>
                      {relationshipDraft.id ? "Save relationship" : "Add relationship"}
                    </button>
                    {relationshipDraft.id && (
                      <button type="button" className="secondary-button" onClick={() => setRelationshipDraft(EMPTY_RELATIONSHIP_DRAFT)}>Cancel edit</button>
                    )}
                  </div>
                </div>

                <div className="relationship-rule-list">
                  <div className="relationship-list-heading">
                    <span className="field-label">Saved rules</span>
                    <button type="button" className="secondary-button" onClick={() => checkRelationshipRules()} disabled={!relationshipRuleStates.some((rule) => rule.enabled && rule.validation.valid) || !rows.length}>Check all relationships</button>
                  </div>
                  {relationshipRuleStates.length === 0 ? (
                    <p className="relationship-empty">No relationships yet. Add a formula to calculate a target column from other columns.</p>
                  ) : relationshipRuleStates.map((rule) => (
                    <article className="relationship-rule" key={rule.id}>
                      <div>
                        <strong>{rule.name}</strong>
                        <code>{rule.targetColumn} = {rule.formula}</code>
                        {!rule.validation.valid && <span className="relationship-unbound">Unavailable: {rule.validation.error}</span>}
                      </div>
                      <div className="relationship-rule-actions">
                        <button type="button" onClick={() => checkRelationshipRules(rule.id)} disabled={!rule.enabled || !rule.validation.valid || !rows.length}>Check</button>
                        <button type="button" onClick={() => editRelationshipRule(rule)}>Edit</button>
                        <button type="button" onClick={() => duplicateRelationshipRule(rule)}>Duplicate</button>
                        <button type="button" onClick={() => toggleRelationshipRule(rule.id)}>{rule.enabled ? "Disable" : "Enable"}</button>
                        <button type="button" onClick={() => deleteRelationshipRule(rule.id)}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>

                {relationshipIssues.length > 0 && (
                  <div className="relationship-results">
                    <div className="relationship-list-heading">
                      <div>
                        <span className="field-label">Suggested fixes and checks</span>
                        <p>{relationshipIssues.length.toLocaleString()} relationship issue{relationshipIssues.length === 1 ? "" : "s"} found.</p>
                      </div>
                      <div className="relationship-result-actions">
                        <label className="select-all-fixes">
                          <input
                            type="checkbox"
                            checked={fixableRelationshipIssues.length > 0 && fixableRelationshipIssues.every((issue) => selectedRelationshipFixes.includes(issue.id))}
                            onChange={toggleAllRelationshipFixes}
                            disabled={!fixableRelationshipIssues.length}
                          />
                          Select all fixable ({fixableRelationshipIssues.length.toLocaleString()})
                        </label>
                        <button type="button" onClick={applySelectedRelationshipFixes} disabled={!selectedRelationshipFixes.length}>Apply selected fixes ({selectedRelationshipFixes.length})</button>
                      </div>
                    </div>
                    <div className="relationship-results-list">
                      {relationshipIssues.slice(0, 500).map((issue) => (
                        <label className={`relationship-issue ${issue.fixable ? "fixable" : ""}`} key={issue.id}>
                          {issue.fixable ? (
                            <input type="checkbox" checked={selectedRelationshipFixes.includes(issue.id)} onChange={() => toggleRelationshipFix(issue.id)} />
                          ) : <span className="relationship-issue-marker">!</span>}
                          <span><strong>Row {issue.row}: {issue.targetColumn}</strong>{issue.reason}</span>
                          {issue.fixable && <code>{issue.suggestedValue}</code>}
                        </label>
                      ))}
                    </div>
                    {relationshipIssues.length > 500 && <p className="relationship-limit">Showing the first 500 issues. Apply fixes in batches, then check again.</p>}
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="validation-panel">
            <button
              type="button"
              className="validation-toggle"
              onClick={() => setIsValidationPanelOpen(!isValidationPanelOpen)}
            >
              <span>Validation issues</span>
              <span>{validationIssues.length.toLocaleString()}</span>
            </button>

            {isValidationPanelOpen && (
              <div className="validation-content">
                {validationIssues.length === 0 ? (
                  <div className="success-box">No type mismatches found.</div>
                ) : (
                  <>
                  <div className="issue-actions">
                    <span>
                      Showing all {validationIssues.length.toLocaleString()} validation issues across {visibleColumns.length.toLocaleString()} visible columns.
                    </span>
                    <div className="issue-buttons">
                      <button type="button" onClick={() => openFillDialog(selectedColumn)}>
                        Fill invalid values
                      </button>
                      <button type="button" className="secondary-button" onClick={exportIssuesCsv}>
                        Export Issues CSV
                      </button>
                      <button type="button" className="delete-issue-rows-button" onClick={deleteRowsWithValidationIssues}>
                        Delete rows with issues ({validationIssueRowCount.toLocaleString()})
                      </button>
                    </div>
                  </div>
                  <div className="issue-table-wrap">
                    <table className="issue-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Column</th>
                          <th>Expected</th>
                          <th>Value</th>
                          <th>Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationIssues.map((issue) => (
                          <tr key={`${issue.row}-${issue.column}-${issue.value}-${issue.reason}`}>
                            <td>{issue.row}</td>
                            <td>{issue.column}</td>
                            <td>{issue.expected}</td>
                            <td>{issue.value}</td>
                            <td>{issue.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="issue-jump-bar">
              <div className="issue-jump-meta">
                <strong>
                  {validationIssues.length ? `Issue ${Math.max(currentIssueIndex + 1, 1)} / ${validationIssues.length.toLocaleString()}` : "Cleaning tools"}
                </strong>
                <span>
                  {activeIssue
                    ? `Row ${activeIssue.row} • ${activeIssue.column} • ${activeIssue.reason}`
                    : validationIssues.length ? "Jump through validation issues from here." : "Find, replace, and reverse data changes from here."}
                </span>
              </div>
              <div className="issue-jump-actions">
                <button type="button" className="secondary-button" onClick={() => setIsFindReplaceOpen(true)} disabled={!visibleColumns.length}>Find & Replace</button>
                <button type="button" className="secondary-button" onClick={undo} disabled={!history.past.length}>Undo</button>
                <button type="button" className="secondary-button" onClick={redo} disabled={!history.future.length}>Redo</button>
                <button type="button" onClick={jumpToNextIssue} disabled={!validationIssues.length}>Next Row</button>
              </div>
            </div>

          <div className="ag-theme-quartz table-grid">
            <AgGridReact
              ref={gridRef}
              rowData={visibleRows}
              columnDefs={gridColumns}
              defaultColDef={{ editable: true, filter: true, sortable: true, resizable: true, cellDataType: false }}
              getRowId={(params) => params.data.__rowId}
              pagination
              paginationPageSize={100}
              rowSelection="multiple"
              onCellValueChanged={handleCellValueChanged}
              onCellClicked={(event) => {
                if (event.colDef.field && event.colDef.field !== "__rowId") {
                  selectColumn(event.colDef.field);
                }
              }}
              suppressFieldDotNotation
            />
          </div>
        </section>
      </section>

      <aside className="inspector">
        <div className="section-label">Column Inspector</div>
        {selectedColumn ? (
          <>
            <div className="inspector-header">
              <h2>{selectedColumn}</h2>
              <p>
                Detected as <strong>{inferColumnType(rows, selectedColumn)}</strong>
              </p>
            </div>

            <div className="inspector-stats">
              <InspectorStat label="Visible" value={visibleColumns.includes(selectedColumn) ? "Yes" : "No"} />
              <InspectorStat
                label="Issues"
                value={selectedColumnIssueCount.toLocaleString()}
                tone={selectedColumnIssueCount ? "danger" : "default"}
              />
            </div>

            <div className="type-card">
              <label>
                <span>Type</span>
                <select
                  value={selectedRule?.type ?? "Text"}
                  onChange={(event) => handleExpectedTypeChange(selectedColumn, event.target.value)}
                >
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <div className="rule-summary">
                <span>Validation rule</span>
                <strong>{getRuleDisplayName(selectedRule ?? createColumnRule("Text"))}</strong>
              </div>
              <button type="button" className="secondary-button" onClick={openRuleBuilder}>
                Configure rule
              </button>
            </div>
            <div className="inspector-fill-card">
              <div>
                <span className="field-label">Fill detected values</span>
                <p>{selectedColumnIssueCount ? `${selectedColumnIssueCount.toLocaleString()} empty or invalid cell${selectedColumnIssueCount === 1 ? "" : "s"} found in this column.` : "Run a scan to find values that can be filled."}</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => openFillDialog(selectedColumn)} disabled={!selectedColumnIssueCount}>
                Choose filling method
              </button>
            </div>
            {["Number", "Integer"].includes(selectedRule?.type) && (
              <div className="numeric-conversion-card">
                <div>
                  <span className="field-label">Normalize numeric values</span>
                  <p>Convert every valid number in this column. Invalid and empty cells are left unchanged.</p>
                </div>
                <div className="numeric-conversion-actions">
                  <button type="button" className="secondary-button" onClick={() => convertSelectedNumericColumn("Integer")}>
                    Convert column to Integer
                  </button>
                  {selectedRule?.type === "Number" && (
                    <button type="button" className="secondary-button" onClick={() => convertSelectedNumericColumn("Number")}>
                      Convert column to Float
                    </button>
                  )}
                </div>
                {numericConversionNotice && <div className="numeric-conversion-notice">{numericConversionNotice}</div>}
              </div>
            )}
            {!!invalidVisibleRegexColumns.length && (
              <div className="regex-blocker">
                Fix invalid custom regex rules before scanning visible columns.
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h2>No column selected</h2>
            <p>Select a column from the table or sidebar to edit its type and format.</p>
          </div>
        )}
      </aside>
      {isFindReplaceOpen && (
        <div className="rule-builder-backdrop" onMouseDown={() => setIsFindReplaceOpen(false)}>
          <section className="find-replace-dialog" role="dialog" aria-modal="true" aria-labelledby="find-replace-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="rule-builder-heading"><div><span className="section-label">Bulk cleaning</span><h2 id="find-replace-title">Find & Replace</h2><p>Applies across {visibleColumns.length.toLocaleString()} visible columns. Hidden columns are unchanged.</p></div><button type="button" className="dialog-close" onClick={() => setIsFindReplaceOpen(false)}>Close</button></div>
            <div className="rule-builder-body">
              <label><span>Mode</span><select value={findReplaceDraft.mode} onChange={(event) => setFindReplaceDraft((draft) => ({ ...draft, mode: event.target.value }))}><option value="exact">Exact match</option><option value="contains">Contains text</option><option value="regex">Regex</option></select></label>
              <label><span>Find</span><input value={findReplaceDraft.find} onChange={(event) => setFindReplaceDraft((draft) => ({ ...draft, find: event.target.value }))} placeholder={findReplaceDraft.mode === "regex" ? "\\bN/?A\\b" : "N/A"} /></label>
              <label><span>Replace with</span><input value={findReplaceDraft.replace} onChange={(event) => setFindReplaceDraft((draft) => ({ ...draft, replace: event.target.value }))} placeholder="Leave empty to clear" /></label>
              {findReplaceDraft.mode !== "regex" && <label className="check-row find-case-toggle"><input type="checkbox" checked={findReplaceDraft.caseSensitive} onChange={() => setFindReplaceDraft((draft) => ({ ...draft, caseSensitive: !draft.caseSensitive }))} /><span className="fake-checkbox" aria-hidden="true" /><span className="column-name">Case sensitive</span></label>}
              <div className="find-preview"><span className="field-label">Preview</span>{!findReplacePreview.valid ? <strong className="error-text">{findReplacePreview.error}</strong> : <><strong>{findReplacePreview.count.toLocaleString()} values will change</strong>{findReplacePreview.examples.map((item, index) => <div key={`${item.column}-${index}`}><code>{item.column}</code> {item.before} → {item.after || "(empty)"}</div>)}</>}</div>
            </div>
            <div className="rule-builder-actions"><button type="button" className="secondary-button" onClick={() => setIsFindReplaceOpen(false)}>Cancel</button><button type="button" onClick={applyFindReplace} disabled={!findReplacePreview.valid || !findReplacePreview.count}>Apply replacements</button></div>
          </section>
        </div>
      )}
      {isFillDialogOpen && (
        <div className="rule-builder-backdrop" onMouseDown={() => setIsFillDialogOpen(false)}>
          <section className="fill-dialog" role="dialog" aria-modal="true" aria-labelledby="fill-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="rule-builder-heading">
              <div>
                <span className="section-label">Bulk cleaning</span>
                <h2 id="fill-dialog-title">Fill invalid values</h2>
                <p>Choose what to fill, review the preview, then apply it as one undoable change.</p>
              </div>
              <button type="button" className="dialog-close" onClick={() => setIsFillDialogOpen(false)}>Close</button>
            </div>

            <div className="fill-dialog-body">
              <label className="fill-field">
                <span>Column</span>
                <select value={fillDraft.column} onChange={(event) => changeFillColumn(event.target.value)}>
                  {fillIssueColumns.length > 1 && <option value={ALL_ISSUE_COLUMNS}>All columns with issues</option>}
                  {fillIssueColumns.map((column) => (
                    <option key={column} value={column}>{column} ({issueCountByColumn[column].toLocaleString()})</option>
                  ))}
                </select>
              </label>

              <fieldset className="fill-choice-group">
                <legend>Fill</legend>
                <div className="fill-scope-options">
                  {[
                    ["both", "Empty and invalid"],
                    ["empty", "Empty only"],
                    ["invalid", "Invalid only"],
                  ].map(([value, label]) => (
                    <label key={value} className={fillDraft.scope === value ? "selected" : ""}>
                      <input type="radio" name="fill-scope" value={value} checked={fillDraft.scope === value} onChange={() => setFillDraft((draft) => ({ ...draft, scope: value }))} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="fill-choice-group">
                <legend>Method{fillColumnRule ? ` for ${fillColumnRule.type}` : ""}</legend>
                <div className="fill-method-options">
                  {fillMethods.map((method) => (
                    <label key={method.id} className={fillDraft.method === method.id ? "selected" : ""}>
                      <input type="radio" name="fill-method" value={method.id} checked={fillDraft.method === method.id} onChange={() => setFillDraft((draft) => ({ ...draft, method: method.id }))} />
                      <span><strong>{method.label}</strong><small>{method.description}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {fillDraft.method === "custom" && (
                <label className="fill-field">
                  <span>Replacement value</span>
                  <input value={fillDraft.customValue} onChange={(event) => setFillDraft((draft) => ({ ...draft, customValue: event.target.value }))} placeholder="NaN or leave empty" />
                </label>
              )}
              {customFillWarning && <div className="fill-warning">{customFillWarning}</div>}

              <div className="fill-preview">
                <span className="field-label">Preview</span>
                {isFillPreviewPending ? (
                  <strong>Updating preview...</strong>
                ) : !fillPreview.valid ? (
                  <strong className="error-text">{fillPreview.error}</strong>
                ) : (
                  <>
                    <strong>{fillPreview.changeCount.toLocaleString()} cell{fillPreview.changeCount === 1 ? "" : "s"} will change</strong>
                    {fillPreview.skippedCount > 0 && <span>{fillPreview.skippedCount.toLocaleString()} target cell{fillPreview.skippedCount === 1 ? "" : "s"} cannot be filled with this method.</span>}
                    {fillPreview.allocations.map((item) => (
                      <div key={String(item.value)}><code>{String(item.value)}</code> {item.count.toLocaleString()} fill{item.count === 1 ? "" : "s"} ({item.percent.toFixed(1)}%)</div>
                    ))}
                    {fillPreview.examples.map((item) => (
                      <div key={`${item.row}-${item.column}`}><code>Row {item.row}: {item.column}</code> {isEmptyValue(item.before) ? "(empty)" : String(item.before)} -&gt; {isEmptyValue(item.after) ? "(empty)" : String(item.after)}</div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="rule-builder-actions">
              <button type="button" className="secondary-button" onClick={() => setIsFillDialogOpen(false)}>Cancel</button>
              <button type="button" onClick={applyFillPlan} disabled={isFillPreviewPending || !fillPreview.valid || !fillPreview.changeCount}>Apply fill</button>
            </div>
          </section>
        </div>
      )}
      {isRuleBuilderOpen && ruleDraft && (
        <div className="rule-builder-backdrop" onMouseDown={() => setIsRuleBuilderOpen(false)}>
          <section
            className="rule-builder-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rule-builder-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="rule-builder-heading">
              <div>
                <span className="section-label">Validation rule</span>
                <h2 id="rule-builder-title">Configure {selectedColumn}</h2>
                <p>Choose a simple rule first. Advanced regex is available when needed.</p>
              </div>
              <button type="button" className="dialog-close" onClick={() => setIsRuleBuilderOpen(false)} aria-label="Close rule builder">Close</button>
            </div>

            <div className="rule-builder-body">
              <label>
                <span>Rule type</span>
                <select value={ruleDraft.mode} onChange={(event) => selectRuleMode(event.target.value)}>
                  <option value="preset">Built-in format</option>
                  {ruleDraft.type === "Category" && <option value="friendly">Allowed values</option>}
                  {ruleDraft.type === "Text" && <option value="friendly">Text match</option>}
                  {["Number", "Integer"].includes(ruleDraft.type) && <option value="friendly">Number range</option>}
                  <option value="customRegex">Advanced regex</option>
                </select>
              </label>

              {ruleDraft.mode === "preset" && (
                <label>
                  <span>Format</span>
                  <select value={ruleDraft.presetId} onChange={(event) => updateRuleDraft("presetId", event.target.value)}>
                    {getPresetsForType(ruleDraft.type).map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                  </select>
                </label>
              )}

              {ruleDraft.mode === "friendly" && ruleDraft.type === "Category" && (
                <div className="friendly-rule-card">
                  <div>
                    <span className="field-label">Allowed values</span>
                    <p>Add values by typing or pasting them, by choosing existing values from this column, or by using both. Only added values will pass scanning and appear in the cell dropdown.</p>
                  </div>
                  <div className="allowed-value-entry">
                    <input
                      value={allowedValueInput}
                      onChange={(event) => setAllowedValueInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addAllowedValues();
                        }
                      }}
                      placeholder="Gold, Silver, Bronze"
                    />
                    <button type="button" className="secondary-button" onClick={() => addAllowedValues()}>Add</button>
                  </div>
                  <p className="rule-helper">Paste values separated by commas or new lines.</p>
                  <div className="existing-value-entry">
                    <select value={existingCategoryValue} onChange={(event) => setExistingCategoryValue(event.target.value)}>
                      <option value="">Add a value already in this column</option>
                      {(categoryOptionsByColumn[selectedColumn] ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!existingCategoryValue}
                      onClick={() => {
                        addAllowedValues(existingCategoryValue);
                        setExistingCategoryValue("");
                      }}
                    >
                      Add existing
                    </button>
                  </div>
                  <button type="button" className="existing-values-toggle" onClick={() => setIsExistingCategoryListOpen((isOpen) => !isOpen)}>
                    {isExistingCategoryListOpen ? "Hide existing values" : `Show all existing values (${(categoryOptionsByColumn[selectedColumn] ?? []).length.toLocaleString()})`}
                  </button>
                  {isExistingCategoryListOpen && (
                    <div className="existing-values-list">
                      <input value={existingCategoryFilter} onChange={(event) => setExistingCategoryFilter(event.target.value)} placeholder="Filter existing values" />
                      <span className="existing-values-heading">Available values</span>
                      <div className="existing-values-options">
                        {(categoryOptionsByColumn[selectedColumn] ?? [])
                          .filter((value) => !ruleDraft.allowedValues.includes(value))
                          .filter((value) => value.toLowerCase().includes(existingCategoryFilter.trim().toLowerCase()))
                          .map((value) => (
                            <button type="button" key={value} className="existing-value-option" onClick={() => addAllowedValues(value)}>
                              <span>{value}</span><span>Add</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="value-chip-list">
                    {(ruleDraft.allowedValues ?? []).map((value) => (
                      <button type="button" className="value-chip" key={value} onClick={() => removeAllowedValue(value)}>
                        {value} <span aria-hidden="true">x</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ruleDraft.mode === "friendly" && ruleDraft.type === "Text" && (
                <div className="friendly-rule-card">
                  <label>
                    <span>Match</span>
                    <select value={ruleDraft.textMatchMode} onChange={(event) => updateRuleDraft("textMatchMode", event.target.value)}>
                      <option value="exact">Exactly equals</option>
                      <option value="contains">Contains</option>
                      <option value="startsWith">Starts with</option>
                      <option value="endsWith">Ends with</option>
                    </select>
                  </label>
                  <label>
                    <span>Text</span>
                    <input value={ruleDraft.textValue} onChange={(event) => updateRuleDraft("textValue", event.target.value)} placeholder="urgent" />
                  </label>
                </div>
              )}

              {ruleDraft.mode === "friendly" && ["Number", "Integer"].includes(ruleDraft.type) && (
                <div className="friendly-rule-card builder-pair">
                  <label><span>Minimum (optional)</span><input type="number" value={ruleDraft.minValue} onChange={(event) => updateRuleDraft("minValue", event.target.value)} /></label>
                  <label><span>Maximum (optional)</span><input type="number" value={ruleDraft.maxValue} onChange={(event) => updateRuleDraft("maxValue", event.target.value)} /></label>
                </div>
              )}

              {isCustomRegexMode(ruleDraft) && (
                <details className="advanced-rule-card" open>
                  <summary>Advanced regex</summary>
                  <label>
                    <span>Saved rule or template</span>
                    <select value={ruleDraft.savedRegexId ?? ""} onChange={(event) => applySavedRegexToDraft(event.target.value)}>
                      <option value="">Choose a template or saved rule</option>
                      <optgroup label="Cheat sheet templates">
                        {REGEX_CHEAT_SHEET.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
                      </optgroup>
                      {savedRegexRules.length > 0 && (
                        <optgroup label="My saved rules">
                          {savedRegexRules.map((savedRule) => <option key={savedRule.id} value={savedRule.id}>{savedRule.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <details className="regex-help">
                    <summary>Need regex help?</summary>
                    <p>Pick a template above to fill the pattern, or use these examples as a starting point.</p>
                    <div className="regex-template-grid">
                      {REGEX_CHEAT_SHEET.map((template) => (
                        <article className="regex-template" key={template.id}>
                          <div>
                            <strong>{template.label}</strong>
                            <p>{template.description}</p>
                          </div>
                          <code>{template.pattern}</code>
                          <div className="template-examples">
                            <span>Pass: {template.examples[0]?.valid}</span>
                            <span>Fail: {template.examples[0]?.invalid}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                  <label><span>Regex pattern</span><input value={ruleDraft.customPattern ?? ""} onChange={(event) => updateRuleDraft("customPattern", event.target.value)} placeholder="[A-Za-z0-9]+" /></label>
                  <label><span>Rule label</span><input value={ruleDraft.customPatternLabel ?? ""} onChange={(event) => updateRuleDraft("customPatternLabel", event.target.value)} placeholder="Work email" /></label>
                  <label>
                    <span>Matching</span>
                    <select value={ruleDraft.matchMode ?? "full"} onChange={(event) => updateRuleDraft("matchMode", event.target.value)}>
                      <option value="full">Entire cell must match</option>
                      <option value="contains">Cell contains a match</option>
                    </select>
                  </label>
                  <details className="regex-builder-mini">
                    <summary>Build regex visually</summary>
                    <label><span>Allowed characters</span><select value={ruleDraft.builder?.allowed ?? "alphanumeric"} onChange={(event) => updateRuleDraft("builder", { ...(ruleDraft.builder ?? DEFAULT_REGEX_BUILDER), allowed: event.target.value })}><option value="letters">Letters</option><option value="digits">Digits</option><option value="alphanumeric">Letters and digits</option><option value="custom">Custom character set</option></select></label>
                    <div className="builder-pair"><label><span>Prefix</span><input value={ruleDraft.builder?.prefix ?? ""} onChange={(event) => updateRuleDraft("builder", { ...(ruleDraft.builder ?? DEFAULT_REGEX_BUILDER), prefix: event.target.value })} /></label><label><span>Suffix</span><input value={ruleDraft.builder?.suffix ?? ""} onChange={(event) => updateRuleDraft("builder", { ...(ruleDraft.builder ?? DEFAULT_REGEX_BUILDER), suffix: event.target.value })} /></label></div>
                    <button type="button" className="secondary-button" onClick={applyDraftRegexBuilder}>Use generated pattern</button>
                  </details>
                  <div className={`regex-state ${ruleBuilderRegexState.valid ? "ok" : "error"}`}>{ruleBuilderRegexState.valid ? "Regex is valid." : ruleBuilderRegexState.error}</div>
                  <button type="button" className="secondary-button" onClick={saveDraftRegexForReuse} disabled={!ruleBuilderRegexState.valid || !ruleDraft.customPatternLabel?.trim()}>
                    {ruleDraft.savedRegexId ? "Save rule changes for reuse" : "Save rule for reuse"}
                  </button>
                </details>
              )}

              {ruleDraft.type !== "Category" && (
                <div className="rule-live-test">
                  <span className="field-label">Live test</span>
                  <input value={ruleBuilderTestValue} onChange={(event) => setRuleBuilderTestValue(event.target.value)} placeholder="Paste a value to test" />
                  {ruleBuilderTestResult && <strong className={ruleBuilderTestResult.valid ? "pass-text" : "error-text"}>{ruleBuilderTestResult.valid ? "Passes this rule" : ruleBuilderTestResult.reason}</strong>}
                </div>
              )}
            </div>

            <div className="rule-builder-actions">
              <button type="button" className="secondary-button" onClick={() => setIsRuleBuilderOpen(false)}>Cancel</button>
              <button type="button" onClick={saveRuleDraft} disabled={!ruleBuilderRegexState.valid}>Save rule</button>
            </div>
          </section>
        </div>
      )}
      {pendingConfirmation && (
        <div className="confirmation-backdrop" onMouseDown={cancelConfirmation}>
          <section
            className="confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="section-label">Confirm change</span>
            <h2 id="confirmation-title">{pendingConfirmation.title}</h2>
            <p>{pendingConfirmation.message}</p>
            <div className="confirmation-actions">
              <button type="button" className="secondary-button" onClick={cancelConfirmation}>Cancel</button>
              <button
                type="button"
                className={pendingConfirmation.tone === "danger" ? "delete-issue-rows-button" : "confirm-action-button"}
                onClick={confirmPendingAction}
              >
                {pendingConfirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ToolbarChip({ label, value, tone = "default" }) {
  return (
    <div className={`toolbar-chip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HintCode({ children, hint }) {
  return (
    <span className="hint-code" tabIndex="0">
      <code>{children}</code>
      <span className="hint-tooltip" role="tooltip">{hint}</span>
    </span>
  );
}

function InspectorStat({ label, value, tone = "default" }) {
  return (
    <div className={`inspector-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ColumnHeader(props) {
  const field = props.column?.getColDef()?.field;
  const isSelected = props.selectedColumn === field;

  return (
    <button
      type="button"
      className={`grid-header-button ${isSelected ? "selected" : ""}`}
      onClick={() => props.onSelect(field)}
    >
      {props.displayName}
    </button>
  );
}

function getCellEditorForType(type, value, options) {
  if (type === "Date") {
    return { component: DateCellEditor };
  }
  if (type === "Category") {
    return {
      component: "agSelectCellEditor",
      params: {
        values: buildCategoryEditorOptions(value, options),
      },
    };
  }
  return { component: "agTextCellEditor" };
}

const DateCellEditor = forwardRef(function DateCellEditor(props, ref) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.showPicker?.();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      return inputRef.current?.value ?? "";
    },
  }));

  return (
    <input
      ref={inputRef}
      type="date"
      defaultValue={normalizeDateEditorValue(props.value)}
      className="date-cell-editor"
    />
  );
});

function normalizeRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[String(key).trim()] = value ?? "";
  }
  normalized.__rowId = crypto.randomUUID();
  return normalized;
}

function collectColumns(rows) {
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key !== "__rowId") seen.add(key);
    }
  }
  return [...seen];
}

function pickColumns(row, selectedColumns) {
  const picked = { __rowId: row.__rowId };
  for (const column of selectedColumns) picked[column] = row[column] ?? "";
  return picked;
}

function restoreDeletedRows(rows, deletedRows) {
  const nextRows = [...rows];
  for (const item of [...deletedRows].sort((a, b) => a.index - b.index)) nextRows.splice(item.index, 0, item.row);
  return nextRows;
}

function createFindMatcher(draft) {
  const find = String(draft.find ?? "");
  if (!find) return { valid: false, error: "Enter text or a regex pattern." };
  if (draft.mode === "regex") {
    const regexState = safeCreateRegex(find);
    if (!regexState.valid) return { valid: false, error: regexState.error };
    return { valid: true, replace: (value, replacement) => value.replace(new RegExp(regexState.regex.source, "g"), replacement) };
  }
  const escaped = escapeRegexLiteral(find);
  const flags = draft.caseSensitive ? "g" : "gi";
  const pattern = draft.mode === "contains" ? escaped : `^${escaped}$`;
  return { valid: true, replace: (value, replacement) => value.replace(new RegExp(pattern, flags), replacement) };
}

function normalizeDateEditorValue(value) {
  const text = String(value ?? "").trim();
  if (isDate(text, "date-iso-dash")) return text;
  if (isDate(text, "date-iso-slash")) return text.replaceAll("/", "-");
  return "";
}

function isEmptyValue(value) {
  return String(value ?? "").trim() === "";
}

function buildCategoryEditorOptions(value, options) {
  const normalizedValue = String(value ?? "");
  const normalizedOptions = options.map((option) => String(option));
  if (normalizedValue && !normalizedOptions.includes(normalizedValue)) {
    return [normalizedValue, ...normalizedOptions];
  }
  return normalizedOptions;
}

function getCategoryOptionsForRule(rule, fallbackOptions) {
  if (rule?.type === "Category" && rule.mode === "friendly" && rule.friendlyKind === "allowedValues") {
    return rule.allowedValues ?? [];
  }
  return fallbackOptions;
}

function isCustomRegexMode(rule) {
  return rule?.mode === "customRegex";
}

function isFriendlyRule(rule) {
  return rule?.mode === "friendly";
}

function getDefaultFriendlyKind(type) {
  if (type === "Category") return "allowedValues";
  if (type === "Number" || type === "Integer") return "numericRange";
  return "textMatch";
}

function createTemplateRule(id, label, pattern, description, valid, invalid) {
  return {
    id,
    label,
    pattern,
    description,
    examples: [{ valid, invalid }],
    matchMode: "full",
    source: "template",
    builder: null,
  };
}

function readSavedRegexRules() {
  try {
    const savedRules = JSON.parse(window.localStorage.getItem(REGEX_STORAGE_KEY) ?? "[]");
    return Array.isArray(savedRules) ? savedRules.filter((rule) => rule?.id && rule?.label && rule?.pattern) : [];
  } catch {
    return [];
  }
}

function readSavedRelationships() {
  try {
    const savedRules = JSON.parse(window.localStorage.getItem(RELATIONSHIP_STORAGE_KEY) ?? "[]");
    return Array.isArray(savedRules)
      ? savedRules.filter((rule) => rule?.id && rule?.targetColumn && rule?.formula)
      : [];
  } catch {
    return [];
  }
}

function validateRelationshipRule(rule, columns) {
  if (!rule.targetColumn) return { valid: false, error: "Choose a target column." };
  if (!columns.includes(rule.targetColumn)) return { valid: false, error: `Target column “${rule.targetColumn}” is not in this file.` };
  if (!String(rule.formula ?? "").trim()) return { valid: false, error: "Enter a formula." };
  try {
    const parsed = parseRelationshipFormula(rule.formula);
    const unknownColumn = parsed.references.find((column) => !columns.includes(column));
    if (unknownColumn) return { valid: false, error: `Column “${unknownColumn}” is not in this file.` };
    if (parsed.references.includes(rule.targetColumn)) return { valid: false, error: "The target column cannot also be a formula input." };
    if (!parsed.references.length) return { valid: false, error: "Add at least one column reference." };
    return { valid: true, ast: parsed.ast, references: parsed.references };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Invalid formula." };
  }
}

function parseRelationshipFormula(formula) {
  const tokens = tokenizeRelationshipFormula(String(formula ?? ""));
  let index = 0;
  const references = [];

  function peek() {
    return tokens[index];
  }

  function consume(type) {
    const token = peek();
    if (!token || (type && token.type !== type)) throw new Error("Formula syntax is invalid.");
    index += 1;
    return token;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error("Formula is incomplete.");
    if (token.type === "number") {
      consume("number");
      return { type: "number", value: Number(token.value) };
    }
    if (token.type === "reference") {
      consume("reference");
      references.push(token.value);
      return { type: "reference", value: token.value };
    }
    if (token.type === "(") {
      consume("(");
      const expression = parseAdditive();
      consume(")");
      return expression;
    }
    if (token.type === "-") {
      consume("-");
      return { type: "unary", operator: "-", value: parsePrimary() };
    }
    throw new Error("Expected a number, column reference, or opening parenthesis.");
  }

  function parseMultiplicative() {
    let left = parsePrimary();
    while (["*", "/", "%"].includes(peek()?.type)) {
      const operator = consume().type;
      left = { type: "binary", operator, left, right: parsePrimary() };
    }
    return left;
  }

  function parseAdditive() {
    let left = parseMultiplicative();
    while (["+", "-"].includes(peek()?.type)) {
      const operator = consume().type;
      left = { type: "binary", operator, left, right: parseMultiplicative() };
    }
    return left;
  }

  const ast = parseAdditive();
  if (index !== tokens.length) throw new Error("Formula has an unexpected token.");
  return { ast, references: [...new Set(references)] };
}

function tokenizeRelationshipFormula(formula) {
  const tokens = [];
  let index = 0;
  while (index < formula.length) {
    const character = formula[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if ("+-*/%()".includes(character)) {
      tokens.push({ type: character });
      index += 1;
      continue;
    }
    if (character === "[") {
      const closingIndex = formula.indexOf("]", index + 1);
      if (closingIndex < 0) throw new Error("Column references need a closing ].");
      const column = formula.slice(index + 1, closingIndex).trim();
      if (!column) throw new Error("Column references cannot be empty.");
      tokens.push({ type: "reference", value: column });
      index = closingIndex + 1;
      continue;
    }
    const numberMatch = formula.slice(index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
    if (numberMatch) {
      tokens.push({ type: "number", value: numberMatch[0] });
      index += numberMatch[0].length;
      continue;
    }
    throw new Error(`Unsupported character “${character}”. Use column references like [Amount].`);
  }
  if (!tokens.length) throw new Error("Enter a formula.");
  return tokens;
}

function evaluateRelationshipFormula(ast, row) {
  if (ast.type === "number") return ast.value;
  if (ast.type === "reference") {
    const value = parseRelationshipNumber(row[ast.value]);
    if (value === null) throw new Error(`Input “${ast.value}” is empty or not numeric.`);
    return value;
  }
  if (ast.type === "unary") return -evaluateRelationshipFormula(ast.value, row);
  const left = evaluateRelationshipFormula(ast.left, row);
  const right = evaluateRelationshipFormula(ast.right, row);
  if ((ast.operator === "/" || ast.operator === "%") && right === 0) throw new Error("Cannot divide by zero.");
  if (ast.operator === "+") return left + right;
  if (ast.operator === "-") return left - right;
  if (ast.operator === "*") return left * right;
  if (ast.operator === "/") return left / right;
  return left % right;
}

function parseRelationshipNumber(value) {
  if (isEmptyValue(value)) return null;
  const normalized = String(value).trim().replaceAll(",", "");
  if (!/^-?(?:\d+|\d*\.\d+)$/.test(normalized)) return null;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseNumericValueForConversion(value) {
  if (isEmptyValue(value)) return null;
  const normalized = String(value).trim().replaceAll(",", "");
  if (!normalized) return null;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatRelationshipNumber(value) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

function checkRelationshipRows(rows, rule, ast, columnRules) {
  const issues = [];
  rows.forEach((row, rowIndex) => {
    let calculatedValue;
    try {
      calculatedValue = evaluateRelationshipFormula(ast, row);
    } catch (error) {
      issues.push({
        id: `${rule.id}:${row.__rowId}:input`,
        ruleId: rule.id,
        rowId: row.__rowId,
        row: rowIndex + 1,
        targetColumn: rule.targetColumn,
        fixable: false,
        reason: error instanceof Error ? error.message : "Formula could not be calculated.",
      });
      return;
    }
    const targetValue = row[rule.targetColumn];
    const suggestedValue = formatRelationshipNumber(calculatedValue);
    if (isEmptyValue(targetValue)) {
      issues.push({
        id: `${rule.id}:${row.__rowId}:fill`, ruleId: rule.id, rowId: row.__rowId, row: rowIndex + 1,
        targetColumn: rule.targetColumn, suggestedValue, fixable: true, reason: "Target is empty. Calculated value:",
      });
      return;
    }
    const targetRule = columnRules[rule.targetColumn];
    if (targetRule && !validateValue(targetValue, targetRule).valid) {
      issues.push({
        id: `${rule.id}:${row.__rowId}:validation`, ruleId: rule.id, rowId: row.__rowId, row: rowIndex + 1,
        targetColumn: rule.targetColumn, suggestedValue, fixable: true,
        reason: `Target fails ${targetRule.type}: ${getRuleDisplayName(targetRule)}. Calculated value:`,
      });
      return;
    }
    const numericTarget = parseRelationshipNumber(targetValue);
    if (numericTarget === null) {
      issues.push({
        id: `${rule.id}:${row.__rowId}:target`, ruleId: rule.id, rowId: row.__rowId, row: rowIndex + 1,
        targetColumn: rule.targetColumn, suggestedValue, fixable: true, reason: "Target value is not numeric. Calculated value:",
      });
      return;
    }
    if (Math.abs(numericTarget - calculatedValue) > RELATIONSHIP_TOLERANCE) {
      issues.push({
        id: `${rule.id}:${row.__rowId}:mismatch`, ruleId: rule.id, rowId: row.__rowId, row: rowIndex + 1,
        targetColumn: rule.targetColumn, suggestedValue, fixable: true, reason: `Current value ${targetValue}; calculated value:`,
      });
    }
  });
  return issues;
}

function resolveColumnRule(rule, regexRules) {
  if (!isCustomRegexMode(rule) || !rule.savedRegexId) return rule;
  const savedRule = regexRules.find((item) => item.id === rule.savedRegexId);
  if (!savedRule) return rule;
  return {
    ...rule,
    customPattern: savedRule.pattern,
    customPatternLabel: savedRule.label,
    matchMode: savedRule.matchMode ?? "full",
    builder: savedRule.builder ?? null,
  };
}

function escapeRegexLiteral(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegexFromBuilder(builder) {
  const characterSets = {
    letters: "A-Za-z",
    digits: "0-9",
    alphanumeric: "A-Za-z0-9",
    custom: builder.customCharacters || "A-Za-z0-9",
  };
  const minLength = Math.max(0, Number(builder.minLength || 1));
  const maxLength = builder.maxLength === "" ? null : Math.max(minLength, Number(builder.maxLength));
  const quantifier = maxLength === null
    ? (minLength <= 1 ? "+" : `{${minLength},}`)
    : `{${minLength},${maxLength}}`;
  return `${escapeRegexLiteral(builder.prefix)}[${characterSets[builder.allowed] ?? characterSets.alphanumeric}]${quantifier}${escapeRegexLiteral(builder.suffix)}`;
}

function getFormatSelectValue(rule) {
  return isCustomRegexMode(rule) ? CUSTOM_REGEX_PRESET_ID : rule.presetId;
}

function safeCreateRegex(pattern) {
  const normalizedPattern = String(pattern ?? "").trim();
  if (!normalizedPattern) {
    return { valid: false, error: "Regex pattern is required." };
  }
  try {
    return { valid: true, regex: new RegExp(normalizedPattern) };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Invalid regex." };
  }
}

function getCustomRegexState(rule) {
  return safeCreateRegex(rule?.customPattern ?? "");
}

function getRuleDisplayName(rule) {
  if (isCustomRegexMode(rule)) {
    return rule.customPatternLabel?.trim() || "Custom Regex";
  }
  if (isFriendlyRule(rule)) {
    if (rule.friendlyKind === "allowedValues") {
      const values = rule.allowedValues ?? [];
      return values.length ? `Allowed: ${values.slice(0, 3).join(", ")}${values.length > 3 ? ` +${values.length - 3}` : ""}` : "Allowed values";
    }
    if (rule.friendlyKind === "textMatch") return `${getTextMatchLabel(rule.textMatchMode)}: ${rule.textValue || "text"}`;
    if (rule.friendlyKind === "numericRange") return `Range: ${rule.minValue || "any"} to ${rule.maxValue || "any"}`;
  }
  return getPreset(rule.presetId).name;
}

function getTextMatchLabel(matchMode) {
  if (matchMode === "contains") return "Contains";
  if (matchMode === "startsWith") return "Starts with";
  if (matchMode === "endsWith") return "Ends with";
  return "Equals";
}

function validateWithCustomRegex(value, pattern, matchMode = "full") {
  const regexState = safeCreateRegex(pattern);
  if (!regexState.valid) {
    return { valid: false, reason: regexState.error };
  }
  const text = String(value);
  const valid = matchMode === "contains"
    ? regexState.regex.test(text)
    : new RegExp(`^(?:${String(pattern).trim()})$`).test(text);
  return {
    valid,
    reason: "Expected custom regex",
  };
}

function inferColumnType(rows, column) {
  const values = rows.map((row) => row[column]).filter((value) => String(value ?? "").trim() !== "");
  if (!values.length) return "Text";
  const rate = (validator) => values.filter(validator).length / values.length;
  if (rate(isEmail) >= 0.8) return "Email";
  if (rate(isPhone) >= 0.8) return "Phone";
  if (rate(isBoolean) >= 0.8) return "Boolean";
  if (rate(isInteger) >= 0.8) return "Integer";
  if (rate(isNumber) >= 0.8) return "Number";
  if (rate(isDate) >= 0.8) return "Date";
  return "Text";
}

function createColumnRule(type) {
  return {
    type,
    presetId: DEFAULT_PRESET_BY_TYPE[type] ?? DEFAULT_PRESET_BY_TYPE.Text,
    mode: "preset",
    customPattern: "",
    customPatternLabel: "",
    savedRegexId: "",
  };
}

function getPresetsForType(type) {
  return VALIDATION_PRESETS.filter((preset) => preset.type === type);
}

function getPreset(presetId) {
  return VALIDATION_PRESETS.find((preset) => preset.id === presetId) ?? VALIDATION_PRESETS[0];
}

function validateRows(rows, columnRules) {
  const issues = [];
  rows.forEach((row, rowIndex) => {
    for (const [column, rule] of Object.entries(columnRules)) {
      if (column === "__rowId") continue;
      const value = row[column];
      if (isEmptyValue(value)) {
        issues.push({
          row: rowIndex + 1,
          rowId: row.__rowId,
          column,
          expected: `${rule.type}: ${getRuleDisplayName(rule)}`,
          value: "",
          reason: "Value is empty",
        });
        continue;
      }
      const result = validateValue(value, rule);
      if (!result.valid) {
        issues.push({
          row: rowIndex + 1,
          rowId: row.__rowId,
          column,
          expected: `${rule.type}: ${getRuleDisplayName(rule)}`,
          value: String(value),
          reason: result.reason,
        });
      }
    }
  });
  return issues;
}

function validateValue(value, rule) {
  if (isCustomRegexMode(rule)) {
    const result = validateWithCustomRegex(value, rule.customPattern, rule.matchMode);
    return {
      valid: result.valid,
      reason: result.valid ? `Expected ${getRuleDisplayName(rule)}` : `Expected ${getRuleDisplayName(rule)}`,
    };
  }
  if (isFriendlyRule(rule)) return validateFriendlyRule(value, rule);
  const preset = getPreset(rule.presetId);
  if (rule.type === "Text") return { valid: isText(value, preset.id), reason: `Expected ${preset.name}` };
  if (rule.type === "Number") return { valid: isNumber(value, preset.id), reason: `Expected ${preset.name}` };
  if (rule.type === "Integer") return { valid: isInteger(value, preset.id), reason: `Expected ${preset.name}` };
  if (rule.type === "Date") return { valid: isDate(value, preset.id), reason: `Expected ${preset.name}` };
  if (rule.type === "Email") return { valid: isEmail(value), reason: "Expected standard email" };
  if (rule.type === "Phone") return { valid: isPhone(value, preset.id), reason: `Expected ${preset.name}` };
  if (rule.type === "Boolean") return { valid: isBoolean(value, preset.id), reason: `Expected ${preset.name}` };
  if (rule.type === "Category") return { valid: isCategory(value, rule, preset.id), reason: `Expected ${preset.name}` };
  return { valid: true };
}

function validateFriendlyRule(value, rule) {
  const text = String(value ?? "").trim();
  if (rule.friendlyKind === "allowedValues") {
    const allowedValues = rule.allowedValues ?? [];
    return { valid: allowedValues.includes(text), reason: `Expected ${getRuleDisplayName(rule)}` };
  }
  if (rule.friendlyKind === "textMatch") {
    const expected = String(rule.textValue ?? "");
    const valid = rule.textMatchMode === "contains"
      ? text.includes(expected)
      : rule.textMatchMode === "startsWith"
        ? text.startsWith(expected)
        : rule.textMatchMode === "endsWith"
          ? text.endsWith(expected)
          : text === expected;
    return { valid, reason: `Expected ${getRuleDisplayName(rule)}` };
  }
  if (rule.friendlyKind === "numericRange") {
    const numericValue = parseNumericValueForConversion(value);
    const minimum = rule.minValue === "" ? null : Number(rule.minValue);
    const maximum = rule.maxValue === "" ? null : Number(rule.maxValue);
    const valid = numericValue !== null
      && (minimum === null || numericValue >= minimum)
      && (maximum === null || numericValue <= maximum)
      && (rule.type !== "Integer" || Number.isInteger(numericValue));
    return { valid, reason: `Expected ${getRuleDisplayName(rule)}` };
  }
  return { valid: true };
}

function getRegexColumnSummary(rows, column, rule) {
  let passCount = 0;
  let failCount = 0;
  const examples = [];
  for (const row of rows) {
    const value = row[column];
    if (isEmptyValue(value)) {
      failCount += 1;
      if (examples.length < 5) examples.push("(empty)");
      continue;
    }
    if (validateValue(value, rule).valid) {
      passCount += 1;
    } else {
      failCount += 1;
      if (examples.length < 5) examples.push(String(value));
    }
  }
  return { passCount, failCount, examples };
}

function isText(value, presetId = "text-any") {
  const text = String(value).trim();
  if (presetId === "text-letters") return /^[A-Za-z\s]+$/.test(text);
  if (presetId === "text-alphanumeric") return /^[A-Za-z0-9\s]+$/.test(text);
  return true;
}

function isNumber(value, presetId = "number-standard") {
  const text = String(value).trim();
  if (!NUMBER_PATTERN.test(text)) return false;
  if (presetId === "number-positive") return Number(text.replaceAll(",", "")) >= 0;
  return true;
}

function isInteger(value, presetId = "integer-standard") {
  const text = String(value).trim();
  if (!INTEGER_PATTERN.test(text)) return false;
  if (presetId === "integer-positive") return Number(text.replaceAll(",", "")) >= 0;
  return true;
}

function isDate(value, presetId = "date-iso-dash") {
  const text = String(value).trim();
  if (presetId === "date-iso-dash") return validateDateParts(text, /^(\d{4})-(\d{1,2})-(\d{1,2})$/, [1, 2, 3]);
  if (presetId === "date-iso-slash") return validateDateParts(text, /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, [1, 2, 3]);
  if (presetId === "date-us") return validateDateParts(text, /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, [3, 1, 2]);
  if (presetId === "date-eu") return validateDateParts(text, /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, [3, 2, 1]);
  return false;
}

function validateDateParts(text, pattern, indexes) {
  const match = text.match(pattern);
  if (!match) return false;
  return isRealDate(Number(match[indexes[0]]), Number(match[indexes[1]]), Number(match[indexes[2]]));
}

function isRealDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isEmail(value) {
  return EMAIL_PATTERN.test(String(value).trim());
}

function isPhone(value, presetId = "phone-common") {
  const text = String(value).trim();
  if (presetId === "phone-digits") return /^\d{7,15}$/.test(text);
  return PHONE_PATTERN.test(text);
}

function isBoolean(value, presetId = "boolean-common") {
  const text = String(value).trim().toLowerCase();
  if (presetId === "boolean-true-false") return ["true", "false"].includes(text);
  if (presetId === "boolean-yes-no") return ["yes", "no", "y", "n"].includes(text);
  return ["true", "false", "yes", "no", "y", "n"].includes(text);
}

function isCategory(value) {
  return String(value ?? "").trim() !== "";
}

createRoot(document.getElementById("root")).render(<App />);
