import { forwardRef, useDeferredValue, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import Papa from "papaparse";
import { ALL_ISSUE_COLUMNS, calculateColumnFill, calculateMultiColumnCustomFill, getFillMethodsForType } from "./fillMethods.js";
import {
  DEFAULT_MISSING_CONDITION,
  getMissingIssue,
  isMissingRuleValid,
  isMissingValue,
  normalizeMissingRule,
  parseMissingTokens,
} from "./missingValues.js";
import {
  applySchemaTransformToRows,
  buildDuplicatePlan,
  buildTextCleanupPlan,
  getCombinePreview,
  getSchemaOperationColumns,
  getSplitPreview,
  mergeVisibleColumnOrder,
  validateSchemaOperation,
} from "./cleaningOperations.js";
import { DATE_PRESET_IDS, buildDateConversionChanges, isDate, isRealDate } from "./dateConversion.js";
import {
  createBinEntries,
  createDataBinExportRows,
  getArchivedColumns,
  moveEntriesToBin,
  normalizeDataBin,
  restoreEntriesFromBin,
} from "./dataBin.js";
import {
  checkLookupRows,
  checkLookupRowsInChunks,
  getLookupStrengthLevel,
  rankLookupCandidates,
  recommendLookupDirection,
  sampleLookupRows,
  validateLookupRule,
} from "./lookupEngine.js";
import { LookupValuePreview } from "./LookupValuePreview.jsx";
import { evaluateFormula, formatFormulaNumber, parseFormula, parseFormulaNumber } from "./formulaEngine.js";
import { CHALLENGES, getChallenge, hasCurrentChallengeRevision } from "./challengeData.js";
import { evaluateChallengeInChunks } from "./challengeEngine.js";
import { deleteWorkspace, loadWorkspace, saveWorkspace } from "./workspaceStorage.js";
import { formatIssueRows, groupValidationIssues } from "./validationIssueGroups.js";
import { findNewAchievements } from "./game/achievements.js";
import { playGameSound, readAudioSettings, unlockAudio, writeAudioSettings } from "./game/audio.js";
import { CampaignMap } from "./game/CampaignMap.jsx";
import { CorruptedText } from "./game/CorruptedText.jsx";
import { Clipbit } from "./game/Clipbit.jsx";
import { CleaningFeedbackLayer, EffectsControl } from "./game/CleaningFeedback.jsx";
import { DataHealthMap } from "./game/DataHealthMap.jsx";
import {
  INITIAL_FEEDBACK_STATE,
  createActionFeedback,
  createScanFeedback,
  feedbackReducer,
  readEffectsMode,
  shouldReduceEffects,
  writeEffectsMode,
} from "./game/feedback.js";
import { AchievementToast, AchievementsDialog, ScanOverlay, SoundControls } from "./game/GameOverlays.jsx";
import { OfficeChat } from "./game/OfficeChat.jsx";
import { getOfficeMessage } from "./game/officeMessages.js";
import { PixelSelectOverlay } from "./game/PixelSelectOverlay.jsx";
import { GAME_PROGRESS_KEY, isBootComplete, readGameProgress, recordChallengeResult, writeGameProgress } from "./game/progress.js";
import { useMovablePanel } from "./game/useMovablePanel.js";
import { processRowsInChunks } from "./workspace/chunkedRows.js";
import { appendHistoryAction, canStoreHistoryAction, normalizeHistorySnapshot } from "./workspace/history.js";
import { useWorkspaceController } from "./workspace/useWorkspaceController.js";
import { CLEANING_TOOLS, getCleaningTool } from "./workspace/cleaningTools.js";
import { parseCsvInChunks } from "./workspace/csvImport.js";
import { getCleaningToolAccess, isCleaningToolUnlocked } from "./workspace/toolAccess.js";
import {
  ColumnHeader,
  ColumnPicker,
  HintCode,
  ToolActions,
  ToolCard,
  ToolCheck,
  ToolPreview,
  ToolbarChip,
} from "./workspace/WorkspacePrimitives.jsx";
import {
  calculateChallengeScore,
  createRunStats,
  getActionChangeSize,
  getBinnedRowCount,
  isScoreableAction,
  normalizeRunStats,
} from "./game/scoring.js";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "./styles.css";
const UNIDENTIFIED_TYPE = "Unidentified";
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
const DATE_VALIDATION_PRESETS = VALIDATION_PRESETS.filter((preset) => preset.type === "Date");
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
const REGEX_STORAGE_KEY = "cleansheet.saved-regex-rules";
const RELATIONSHIP_STORAGE_KEY = "cleansheet.column-relationships";
const RELATIONSHIP_TOLERANCE = 0.01;
const CHALLENGE_CONFETTI_COLORS = ["#ef7b2d", "#49c5b6", "#f6be8e", "#3f7f91", "#f7f2e8"];
const CLIPBIT_TIP_INTERVAL = 6500;
const CLIPBIT_FILE_RAGE_COUNT = 4;
const CLIPBIT_FILE_RAGE_WINDOW = 15000;
const VIEWPORT_FEEDBACK_KINDS = new Set(["scan-clean", "scan-error", "objective", "combo", "victory"]);
const CLIPBIT_CAMPAIGN_TIPS = [
  "TIP // Finish all five Boot Sequence stages to power the challenge rack",
  "TIP // Free Clean gives you access to all the data cleaning tools on your 'own' CSV files",
];
const CLIPBIT_CAMPAIGN_NONSENSE = [
  "Did you know that clippy is copy righted? I'm not",
  "The recycle bin accepts files and poor decisions",
  "A file named final final usually means it's good",
  "Clipbit has no medical insurance and is up for adoption",
  "The desktop is held together by pixels and your own powerline",
];
const CLIPBIT_HELL_TIPS = [
  "TIP // Every Hell file is a different kind of awful and none of them are ranked",
  "TIP // If a column looks clean here it is probably lying through a relationship",
  "TIP // Work through chained formulas one rule at a time because later answers need earlier repairs",
  "TIP // Hell objectives can care about filling methods column order and values that still pass a normal scan",
  "TIP // Eight thousand rows is not the scary part and the scary part is knowing which rows deserve to survive",
  "TIP // The table stays readable because corrupted data is already enough visual damage",
];
const CLIPBIT_HELL_NONSENSE = [
  "The disk is warm and I would prefer if we stopped asking why",
  "One of the columns moved while nobody was touching it",
  "The recycle bin has started rejecting eye contact",
  "I heard a formula whisper my name and I do not have ears",
  "The data is not breathing because data cannot breathe so please ignore the breathing",
];
const CLIPBIT_WORKSPACE_TIPS = [
  "TIP // Scan checks every visible cell so hide columns you are not working on",
  "TIP // Click a column name to change its type and validation rules",
  "TIP // Category columns turn cell editing into a dropdown with allowed choices",
  "TIP // Fill Issues can use averages medians modes distributions and more",
  "TIP // Formula rules follow normal math order and parentheses go first",
  "TIP // Saved Regex rules can be reused on any matching column",
  "TIP // Cleaning Tools can split|combine create delete and rearrange columns",
  "TIP // Duplicate checks can compare one column or several columns together",
  "TIP // Undo works after bulk cleaning so experimenting is allowed",
  "TIP // Scan again after a cleanup to refresh objectives and the corruption meter",
  "TIP // Hints cost a few score points but they never block challenge completion",
  "TIP // If everything suddenly fails check the column type before blaming the dataset",
  "TIP // Empty can be valid when the column Missing Policy is set to Allowed",
  "TIP // Division by zero is blocked because infinity does not fit inside a CSV cell",
  "TIP // Changing a column type changes the scanner and not the values themselves",
  "TIP // A Category dropdown uses the allowed values you configured for that column"
];
const CLIPBIT_WORKSPACE_NONSENSE = [
  "Ninety percent of data cleaning is deciding whether NULL means nothing or something terrible",
  "Deleting a row is technically cleaning if nobody asks where it went",
  "CSV stands for Commas Somehow Survived",
  "The scanner cannot judge you but Clipbit absolutely can",
  "If the corruption meter goes up pretend it was a stress test",
  "Clean data is just dirty data with a convincing story",
  "The spreadsheet is not haunted but the duplicate rows are moving again",
  "Every empty cell is innocent until the scanner says otherwise",
];
const CLIPBIT_PESTER_REACTIONS = [
  { message: "Please stop clicking me because I am trying to look employed", mood: "alarmed" },
  { message: "That was my face and I would like to file a very small complaint", mood: "worried" },
  { message: "The dataset does not get cleaner when you click me but your commitment is impressive", mood: "smug" },
  { message: "I have counted every click and the number is becoming personal", mood: "worried" },
  { message: "One more click and I am adding you to the invalid values list", mood: "alarmed" },
  { message: "My warranty does not cover this amount of attention", mood: "smug" },
  { message: "I am a paperclip assistant not a stress button", mood: "worried" },
  { message: "The spreadsheet is over there and yet here you are again", mood: "smug" },
  { message: "This is how corrupted assistants are made", mood: "alarmed" },
  { message: "I felt that one in my source code", mood: "worried" },
  { message: "Clipbit.exe is considering an unexpected vacation", mood: "alarmed" },
  { message: "Fine you win and this button works extremely well", mood: "happy" },
];
const CLIPBIT_FILE_HIT_REACTIONS = [
  "You just threw a CSV at my face and somehow I am the broken one",
  "Please aim at the recycle bin and not the unpaid assistant",
  "Direct hit and exactly zero data was cleaned",
  "That file was not included in my job description",
  "I am reporting this to absolutely nobody because I have no manager",
  "The file bounced back but the emotional damage stayed",
];
const GRID_ROW_SELECTION = {
  mode: "multiRow",
  checkboxes: false,
  headerCheckbox: false,
  enableClickSelection: true,
};
const EMPTY_RELATIONSHIP_DRAFT = { id: "", kind: "formula", name: "", sourceColumn: "", targetColumn: "", formula: "", lookupDirection: "none", bidirectional: false, enabled: true };
const EMPTY_FILL_DRAFT = {
  column: "",
  scope: "both",
  method: "custom",
  customValue: "",
  customDate: "",
  groupBy: "",
  orderBy: "",
  orderDirection: "asc",
};
const EMPTY_MISSING_RULE_DRAFT = {
  column: "",
  missingPolicy: "required",
  missingTokens: [],
  missingTokensInput: "",
  missingTokenCaseSensitive: false,
  missingCondition: DEFAULT_MISSING_CONDITION,
};
const EMPTY_DUPLICATE_DRAFT = { columns: [], keep: "first", trimValues: false, ignoreCase: false };
const EMPTY_TEXT_CLEANUP_DRAFT = { columns: [], trimEdges: true, collapseWhitespace: true, caseMode: "keep" };
const EMPTY_CREATE_COLUMN_DRAFT = { type: "createColumn", column: "", dataType: "Text", initialMode: "empty", initialValue: "" };
const EMPTY_DELETE_COLUMNS_DRAFT = { type: "deleteColumns", columns: [] };
const EMPTY_SPLIT_DRAFT = { type: "splitColumn", sourceColumn: "", outputColumns: ["Part 1", "Part 2"], separatorMode: "whitespace", customSeparator: "", removeSources: false };
const EMPTY_COMBINE_DRAFT = { type: "combineColumns", sourceColumns: [], outputColumn: "Combined", separatorMode: "space", customSeparator: "", skipEmpty: true, removeSources: false };
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

export function App() {
  const gridRef = useRef(null);
  const rowsRef = useRef([]);
  const scanAbortRef = useRef(null);
  const challengeResultTimeoutRef = useRef(null);
  const audioReadyRef = useRef(false);
  const clipbitPesterCountRef = useRef(0);
  const clipbitTipIndexRef = useRef(0);
  const clipbitTipTurnRef = useRef(0);
  const clipbitNonsenseIndexRef = useRef(0);
  const clipbitFileHitReactionRef = useRef(0);
  const clipbitFileHitTimesRef = useRef([]);
  const officeMessageSequenceRef = useRef(0);
  const officeMessageTurnsRef = useRef({});
  const lookupAnalysisAbortRef = useRef(null);
  const {
    state: {
      rows,
      columns,
      visibleColumns,
      columnRules,
      fileName,
      validationIssues,
      lastScannedAt,
      hasUnscannedChanges,
      showRowNumbers,
      selectedColumn,
      relationshipRules,
      relationshipIssues,
      selectedRelationshipFixes,
      dataBin,
      history,
      challengeEvaluation,
      runStats,
    },
    actions: {
      setRows,
      setColumns,
      setVisibleColumns,
      setColumnRules,
      setFileName,
      setValidationIssues,
      setLastScannedAt,
      setHasUnscannedChanges,
      setShowRowNumbers,
      setSelectedColumn,
      setRelationshipRules,
      setRelationshipIssues,
      setSelectedRelationshipFixes,
      setDataBin,
      setHistory,
      setChallengeEvaluation,
      setRunStats,
    },
  } = useWorkspaceController({
    readInitialRelationships: readSavedRelationships,
    createInitialRunStats: createRunStats,
  });
  const [isValidationPanelOpen, setIsValidationPanelOpen] = useState(false);
  const [columnConversionNotice, setColumnConversionNotice] = useState("");
  const [dateConversionSourcePresetId, setDateConversionSourcePresetId] = useState("date-eu");
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState(null);
  const [allowedValueInput, setAllowedValueInput] = useState("");
  const [existingCategoryFilter, setExistingCategoryFilter] = useState("");
  const [ruleBuilderTestValue, setRuleBuilderTestValue] = useState("");
  const [savedRegexRules, setSavedRegexRules] = useState(readSavedRegexRules);
  const [isInformationOpen, setIsInformationOpen] = useState(false);
  const [isInformationPortable, setIsInformationPortable] = useState(false);
  const [relationshipDraft, setRelationshipDraft] = useState(EMPTY_RELATIONSHIP_DRAFT);
  const [lookupPreview, setLookupPreview] = useState(null);
  const [lookupFinder, setLookupFinder] = useState(null);
  const [lookupAnalysisProgress, setLookupAnalysisProgress] = useState(null);
  const [isRelationshipPanelOpen, setIsRelationshipPanelOpen] = useState(false);
  const [findReplaceDraft, setFindReplaceDraft] = useState({ find: "", replace: "", mode: "exact", caseSensitive: true });
  const [fillDraft, setFillDraft] = useState(EMPTY_FILL_DRAFT);
  const [isCleaningToolsOpen, setIsCleaningToolsOpen] = useState(false);
  const [activeCleaningTool, setActiveCleaningTool] = useState("home");
  const [toolLockNotice, setToolLockNotice] = useState("");
  const [missingRuleDraft, setMissingRuleDraft] = useState(EMPTY_MISSING_RULE_DRAFT);
  const [missingRuleNotice, setMissingRuleNotice] = useState("");
  const [duplicateDraft, setDuplicateDraft] = useState(EMPTY_DUPLICATE_DRAFT);
  const [textCleanupDraft, setTextCleanupDraft] = useState(EMPTY_TEXT_CLEANUP_DRAFT);
  const [createColumnDraft, setCreateColumnDraft] = useState(EMPTY_CREATE_COLUMN_DRAFT);
  const [deleteColumnsDraft, setDeleteColumnsDraft] = useState(EMPTY_DELETE_COLUMNS_DRAFT);
  const [splitDraft, setSplitDraft] = useState(EMPTY_SPLIT_DRAFT);
  const [combineDraft, setCombineDraft] = useState(EMPTY_COMBINE_DRAFT);
  const [columnOperationMode, setColumnOperationMode] = useState("create");
  const [showIssueRowsOnly, setShowIssueRowsOnly] = useState(false);
  const [selectedGridRowIds, setSelectedGridRowIds] = useState([]);
  const [selectedBinEntryIds, setSelectedBinEntryIds] = useState([]);
  const [viewMode, setViewMode] = useState("campaign");
  const [activeChallengeId, setActiveChallengeId] = useState("");
  const [isObjectivesOpen, setIsObjectivesOpen] = useState(true);
  const [isObjectivesPortable, setIsObjectivesPortable] = useState(false);
  const [isChallengeResultOpen, setIsChallengeResultOpen] = useState(false);
  const [isChallengeCelebrating, setIsChallengeCelebrating] = useState(false);
  const [gameProgress, setGameProgress] = useState(readGameProgress);
  const [savedWorkspaceIds, setSavedWorkspaceIds] = useState([]);
  const [campaignPowerSequenceSignal, setCampaignPowerSequenceSignal] = useState(0);
  const [campaignPack, setCampaignPack] = useState("core");
  const [hellContainmentSignal, setHellContainmentSignal] = useState(0);
  const [pendingChallengeLaunch, setPendingChallengeLaunch] = useState(null);
  const [challengeStoryPage, setChallengeStoryPage] = useState(0);
  const [challengeStoryCharacterCount, setChallengeStoryCharacterCount] = useState(0);
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const [challengeLoadingTitle, setChallengeLoadingTitle] = useState("");
  const [loadingKind, setLoadingKind] = useState("challenge");
  const [loadingProgress, setLoadingProgress] = useState({ rowCount: 0, progress: null });
  const [challengeLoadError, setChallengeLoadError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [audioSettings, setAudioSettings] = useState(readAudioSettings);
  const [effectsMode, setEffectsMode] = useState(readEffectsMode);
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [feedbackState, dispatchFeedback] = useReducer(feedbackReducer, INITIAL_FEEDBACK_STATE);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [activeAchievement, setActiveAchievement] = useState(null);
  const [clipbitReaction, setClipbitReaction] = useState({
    message: "Boot Sequence is waiting and somehow the tutorial file is already broken",
    mood: "smug",
  });
  const [isClipbitMinimized, setIsClipbitMinimized] = useState(true);
  const [clipbitBreakSignal, setClipbitBreakSignal] = useState(0);
  const [isRowWipeoutSceneOpen, setIsRowWipeoutSceneOpen] = useState(false);
  const [rowWipeoutChallengeId, setRowWipeoutChallengeId] = useState("");
  const [officeMessages, setOfficeMessages] = useState([]);
  const [isOfficeChatOpen, setIsOfficeChatOpen] = useState(false);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("Loading saved work...");
  const deferredFillDraft = useDeferredValue(fillDraft);
  const deferredDuplicateDraft = useDeferredValue(duplicateDraft);
  const deferredTextCleanupDraft = useDeferredValue(textCleanupDraft);
  const deferredSplitDraft = useDeferredValue(splitDraft);
  const deferredCombineDraft = useDeferredValue(combineDraft);
  const activeChallenge = getChallenge(activeChallengeId);
  const isHellContext = (
    (viewMode === "campaign" && campaignPack === "hell")
    || activeChallenge?.pack === "hell"
  );
  const cleaningToolAccess = useMemo(
    () => getCleaningToolAccess({
      activeChallenge,
      challenges: CHALLENGES,
      progress: gameProgress,
      freeClean: viewMode === "workspace" && !activeChallenge,
    }),
    [activeChallenge, gameProgress, viewMode],
  );
  const storyChallenge = getChallenge(pendingChallengeLaunch?.challengeId);
  const challengeStoryText = storyChallenge?.story?.[challengeStoryPage] ?? "";
  const isChallengeStoryPageComplete = challengeStoryCharacterCount >= challengeStoryText.length;
  const challengeScore = useMemo(
    () => calculateChallengeScore(activeChallenge, challengeEvaluation, runStats),
    [activeChallenge, challengeEvaluation, runStats],
  );
  const activeFeedback = feedbackState.active;
  const isViewportFeedback = VIEWPORT_FEEDBACK_KINDS.has(activeFeedback?.kind);
  const tableFeedback = isViewportFeedback ? null : activeFeedback;
  const isEffectsReduced = shouldReduceEffects(effectsMode, { matches: systemReducedMotion });
  const informationPanelMovement = useMovablePanel({
    active: isInformationPortable,
    storageKey: "cleansheet.walkthrough-note-position",
    defaultTop: 88,
    defaultRight: 18,
    defaultWidth: 360,
  });
  const objectivesPanelMovement = useMovablePanel({
    active: isObjectivesPortable,
    storageKey: "cleansheet.objectives-note-position",
    defaultTop: 88,
    defaultRight: 394,
    defaultWidth: 360,
  });

  useEffect(() => {
    window.localStorage.setItem(REGEX_STORAGE_KEY, JSON.stringify(savedRegexRules));
  }, [savedRegexRules]);

  useEffect(() => {
    window.localStorage.setItem(RELATIONSHIP_STORAGE_KEY, JSON.stringify(relationshipRules));
  }, [relationshipRules]);

  useEffect(() => {
    writeGameProgress(gameProgress);
  }, [gameProgress]);

  useEffect(() => {
    writeAudioSettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    writeEffectsMode(effectsMode);
  }, [effectsMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setSystemReducedMotion(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    if (!activeFeedback) return undefined;
    if (activeFeedback.sound) playGameSound(activeFeedback.sound, audioSettings);
    const frameId = window.requestAnimationFrame(() => flashFeedbackTargets(activeFeedback));
    const timeoutId = window.setTimeout(
      () => dispatchFeedback({ type: "dismiss" }),
      activeFeedback.duration,
    );
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [activeFeedback?.id]);

  useEffect(() => {
    dispatchFeedback({ type: "clear" });
  }, [viewMode, activeChallengeId]);

  useEffect(() => {
    if (!selectedGridRowIds.length) return undefined;
    function clearSelectionOutsideTable(event) {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".ag-cell, .ag-header-cell, .ag-paging-panel, .ag-popup, .move-selected-rows-button, .confirmation-backdrop")) return;
      gridRef.current?.api?.deselectAll();
      gridRef.current?.api?.clearFocusedCell();
      setSelectedGridRowIds([]);
    }
    document.addEventListener("pointerdown", clearSelectionOutsideTable, true);
    return () => document.removeEventListener("pointerdown", clearSelectionOutsideTable, true);
  }, [selectedGridRowIds.length, setSelectedGridRowIds]);

  useEffect(() => {
    if (activeAchievement || !achievementQueue.length) return undefined;
    const [nextAchievement, ...remaining] = achievementQueue;
    setActiveAchievement(nextAchievement);
    setAchievementQueue(remaining);
    return undefined;
  }, [achievementQueue, activeAchievement]);

  useEffect(() => {
    if (!activeAchievement) return undefined;
    playSound("achievement");
    const timeoutId = window.setTimeout(() => setActiveAchievement(null), 3400);
    return () => window.clearTimeout(timeoutId);
  }, [activeAchievement]);

  useEffect(() => {
    if (!activeChallenge) return;
    const result = findNewAchievements(gameProgress, {
      challenge: activeChallenge,
      evaluation: challengeEvaluation,
      runStats,
      score: challengeScore,
    });
    if (!result.earned.length) return;
    setGameProgress(result.progress);
    setAchievementQueue((current) => [...current, ...result.earned]);
  }, [runStats.undoCount, runStats.largestChange, runStats.clipbitClicks]);

  useEffect(() => {
    if (viewMode !== "campaign" && !activeChallenge) return undefined;
    if (isScanning || isChallengeCelebrating || isChallengeResultOpen || isRowWipeoutSceneOpen) return undefined;
    const timeoutId = window.setTimeout(() => {
      const tips = isHellContext
        ? CLIPBIT_HELL_TIPS
        : viewMode === "campaign"
          ? CLIPBIT_CAMPAIGN_TIPS
          : CLIPBIT_WORKSPACE_TIPS;
      const nonsense = isHellContext
        ? CLIPBIT_HELL_NONSENSE
        : viewMode === "campaign"
          ? CLIPBIT_CAMPAIGN_NONSENSE
          : CLIPBIT_WORKSPACE_NONSENSE;
      const showNonsense = (clipbitTipTurnRef.current + 1) % 4 === 0;
      const message = showNonsense
        ? nonsense[clipbitNonsenseIndexRef.current % nonsense.length]
        : tips[clipbitTipIndexRef.current % tips.length];
      if (showNonsense) clipbitNonsenseIndexRef.current += 1;
      else clipbitTipIndexRef.current += 1;
      clipbitTipTurnRef.current += 1;
      setClipbitReaction({ message, mood: showNonsense ? "smug" : "idle" });
    }, CLIPBIT_TIP_INTERVAL);
    return () => window.clearTimeout(timeoutId);
  }, [
    activeChallenge,
    clipbitReaction.message,
    isChallengeCelebrating,
    isChallengeResultOpen,
    isHellContext,
    isRowWipeoutSceneOpen,
    isScanning,
    viewMode,
  ]);

  useEffect(() => () => {
    if (challengeResultTimeoutRef.current) window.clearTimeout(challengeResultTimeoutRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWorkspace("normal")
      .then((snapshot) => {
        if (cancelled) return;
        if (snapshot) restoreWorkspaceSnapshot(snapshot, "");
        setAutosaveReady(true);
        setAutosaveStatus(snapshot ? "Restored from this browser" : "Autosave ready");
      })
      .catch(() => {
        if (cancelled) return;
        setAutosaveReady(true);
        setAutosaveStatus("Autosave unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!autosaveReady || (!rows.length && !dataBin.length)) return undefined;
    setAutosaveStatus("Saving...");
    const timeoutId = window.setTimeout(() => {
      const workspaceId = activeChallengeId ? `challenge:${activeChallengeId}` : "normal";
      saveWorkspace(workspaceId, createCurrentWorkspaceSnapshot())
        .then(() => setAutosaveStatus("Saved in this browser"))
        .catch(() => setAutosaveStatus("Autosave unavailable"));
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [activeChallengeId, autosaveReady, columnRules, columns, dataBin, fileName, history, relationshipRules, rows, runStats, showRowNumbers, visibleColumns]);

  useEffect(() => {
    if (viewMode !== "campaign") return;
    let cancelled = false;
    Promise.all(CHALLENGES.map(async (challenge) => {
      const workspaceId = `challenge:${challenge.id}`;
      const snapshot = await loadWorkspace(workspaceId).catch(() => null);
      if (!snapshot) return null;
      if (hasCurrentChallengeRevision(challenge, snapshot.challengeRevision)) return workspaceId;
      await deleteWorkspace(workspaceId).catch(() => {});
      return null;
    }))
      .then((workspaceIds) => {
        if (cancelled) return;
        setSavedWorkspaceIds(workspaceIds.filter(Boolean));
        setGameProgress((current) => ({
          ...current,
          records: Object.fromEntries(Object.entries(current.records).filter(([challengeId, record]) => (
            hasCurrentChallengeRevision(getChallenge(challengeId), record?.revision)
          ))),
        }));
      })
      .catch(() => {
        if (!cancelled) setSavedWorkspaceIds([]);
      });
    return () => { cancelled = true; };
  }, [viewMode]);

  useEffect(() => {
    if (!pendingChallengeLaunch || !challengeStoryText) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setChallengeStoryCharacterCount(challengeStoryText.length);
      return undefined;
    }
    setChallengeStoryCharacterCount(0);
    const intervalId = window.setInterval(() => {
      setChallengeStoryCharacterCount((currentCount) => {
        if (currentCount >= challengeStoryText.length) {
          window.clearInterval(intervalId);
          return currentCount;
        }
        return currentCount + 1;
      });
    }, 28);
    return () => window.clearInterval(intervalId);
  }, [challengeStoryPage, challengeStoryText, pendingChallengeLaunch]);

  useEffect(() => {
    if (!pendingConfirmation && !isRuleBuilderOpen && !isCleaningToolsOpen && !isAchievementsOpen && !isChallengeResultOpen && !pendingChallengeLaunch) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && pendingChallengeLaunch) {
        closeChallengeStory();
        return;
      }
      if (event.code === "Space" && pendingChallengeLaunch && !isChallengeStoryPageComplete) {
        event.preventDefault();
        revealChallengeStoryPage();
        return;
      }
      if (event.key === "Escape") {
        setPendingConfirmation(null);
        setIsRuleBuilderOpen(false);
        setIsCleaningToolsOpen(false);
        setIsAchievementsOpen(false);
        setIsChallengeResultOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAchievementsOpen, isChallengeResultOpen, isChallengeStoryPageComplete, isCleaningToolsOpen, isRuleBuilderOpen, pendingChallengeLaunch, pendingConfirmation]);

  useEffect(() => {
    if (!isRuleBuilderOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [isRuleBuilderOpen]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!audioReadyRef.current) return;
      const button = event.target.closest("button, .file-picker");
      if (!button || button.disabled) return;
      if (button.dataset.gameSound === "custom") return;
      playSound("click");
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [audioSettings]);

  useEffect(() => {
    const closeConversionMenus = (exceptMenu = null) => {
      document.querySelectorAll(".column-convert-menu[open]").forEach((menu) => {
        if (menu !== exceptMenu) menu.removeAttribute("open");
      });
    };
    const handlePointerDown = (event) => {
      if (event.target.closest(".pixel-select-menu")) return;
      closeConversionMenus(event.target.closest(".column-convert-menu"));
    };
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || document.querySelector(".pixel-select-menu")) return;
      const openMenu = document.querySelector(".column-convert-menu[open]");
      if (!openMenu) return;
      openMenu.removeAttribute("open");
      openMenu.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history]);

  useEffect(() => () => lookupAnalysisAbortRef.current?.abort(), [columnRules, rows, visibleColumns]);

  const relationshipRuleStates = useMemo(
    () => relationshipRules.map((rule) => ({ ...rule, validation: validateRelationshipRule(rule, columns) })),
    [columns, relationshipRules],
  );
  const relationshipDraftValidation = useMemo(
    () => validateRelationshipRule(relationshipDraft, columns),
    [columns, relationshipDraft],
  );
  const isLookupPreviewCurrent = relationshipDraft.kind === "lookup"
    && lookupPreview?.rows === rows
    && lookupPreview?.columnRules === columnRules
    && lookupPreview?.sourceColumn === relationshipDraft.sourceColumn
    && lookupPreview?.targetColumn === relationshipDraft.targetColumn;
  const activeLookupPreview = isLookupPreviewCurrent ? lookupPreview : null;
  const isLookupFinderCurrent = relationshipDraft.kind === "lookup"
    && lookupFinder?.rows === rows
    && lookupFinder?.columnRules === columnRules
    && lookupFinder?.visibleColumns === visibleColumns
    && lookupFinder?.anchorColumn === relationshipDraft.sourceColumn;
  const activeLookupFinder = isLookupFinderCurrent ? lookupFinder : null;
  const canSaveRelationship = relationshipDraftValidation.valid
    && (
      relationshipDraft.kind !== "lookup"
      || (isLookupPreviewCurrent && relationshipDraft.lookupDirection !== "none")
    );

  const regexRuleLibrary = useMemo(
    () => [...REGEX_CHEAT_SHEET, ...savedRegexRules],
    [savedRegexRules],
  );

  rowsRef.current = rows;
  const rowIndexById = useMemo(
    () => new Map(rows.map((row, index) => [row.__rowId, index])),
    [rows],
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

  const selectedRule = selectedColumn ? resolveColumnRule(columnRules[selectedColumn] ?? createColumnRule("Text"), regexRuleLibrary) : null;
  const selectedDateTargetPreset = selectedRule?.type === "Date"
    && selectedRule.mode === "preset"
    && DATE_PRESET_IDS.includes(selectedRule.presetId)
    ? getPreset(selectedRule.presetId)
    : null;
  const selectedDetectedType = useMemo(
    () => selectedColumn ? inferColumnType(rows, selectedColumn) : "",
    [rows, selectedColumn],
  );
  const selectedColumnIssueCount = selectedColumn ? issueCountByColumn[selectedColumn] ?? 0 : 0;
  const existingCategoryOptions = useMemo(
    () => getUniqueColumnValues(rows, selectedColumn),
    [rows, selectedColumn],
  );
  const filteredExistingCategoryOptions = existingCategoryOptions.filter((value) => (
    value.toLowerCase().includes(existingCategoryFilter.trim().toLowerCase())
  ));
  const selectedExistingCategoryCount = existingCategoryOptions.filter((value) => (
    ruleDraft?.allowedValues?.includes(value)
  )).length;
  const ruleBuilderRegexState = ruleDraft && isCustomRegexMode(ruleDraft) ? getCustomRegexState(ruleDraft) : { valid: true, error: "" };
  const isMissingToolValid = Boolean(
    missingRuleDraft.column
    && isMissingRuleValid(missingRuleDraft, columns, missingRuleDraft.column),
  );
  const missingToolState = {
    valid: isMissingToolValid,
    error: isMissingToolValid ? "" : "Choose another existing column for this condition.",
  };
  const ruleBuilderTestResult = ruleDraft && ruleBuilderTestValue
    ? validateValue(ruleBuilderTestValue, ruleDraft)
    : null;
  const findReplacePreview = useMemo(
    () => isCleaningToolsOpen && activeCleaningTool === "findReplace" ? getFindReplacePreview() : { valid: true, count: 0, examples: [] },
    [activeCleaningTool, findReplaceDraft, isCleaningToolsOpen, rows, visibleColumns],
  );
  const duplicatePreview = useMemo(
    () => isCleaningToolsOpen && activeCleaningTool === "duplicates"
      ? buildDuplicatePlan(rows, deferredDuplicateDraft, false)
      : { valid: true, groupCount: 0, duplicateRowCount: 0, deleteCount: 0, examples: [] },
    [activeCleaningTool, deferredDuplicateDraft, isCleaningToolsOpen, rows],
  );
  const textCleanupPreview = useMemo(
    () => isCleaningToolsOpen && activeCleaningTool === "textCleanup"
      ? buildTextCleanupPlan(rows, deferredTextCleanupDraft, false)
      : { valid: true, changeCount: 0, examples: [] },
    [activeCleaningTool, deferredTextCleanupDraft, isCleaningToolsOpen, rows],
  );
  const splitPreview = useMemo(
    () => isCleaningToolsOpen && activeCleaningTool === "manageColumns"
      ? getSplitPreview(rows, deferredSplitDraft)
      : { valid: true, changedRowCount: 0, examples: [] },
    [activeCleaningTool, deferredSplitDraft, isCleaningToolsOpen, rows],
  );
  const combinePreview = useMemo(
    () => isCleaningToolsOpen && activeCleaningTool === "manageColumns"
      ? getCombinePreview(rows, deferredCombineDraft)
      : { valid: true, changedRowCount: 0, examples: [] },
    [activeCleaningTool, deferredCombineDraft, isCleaningToolsOpen, rows],
  );
  const fillColumnRule = fillDraft.column && fillDraft.column !== ALL_ISSUE_COLUMNS
    ? resolveColumnRule(columnRules[fillDraft.column] ?? createColumnRule("Text"), regexRuleLibrary)
    : null;
  const campaignFillMethods = new Set(["custom", "customDate"]);
  for (const objective of activeChallenge?.objectives ?? []) {
    if (objective.kind === "groupMedianFill") campaignFillMethods.add("median");
    if (objective.kind === "fillContract") campaignFillMethods.add(objective.method);
    if (objective.kind === "groupConsistencyRecovery") campaignFillMethods.add("mode");
    if (objective.kind === "method") campaignFillMethods.add(objective.method);
  }
  const availableFillMethods = fillDraft.column === ALL_ISSUE_COLUMNS
    ? getFillMethodsForType("").filter((method) => method.id === "custom")
    : getFillMethodsForType(fillColumnRule?.type ?? "Text");
  const fillMethods = activeChallenge
    ? availableFillMethods.filter((method) => campaignFillMethods.has(method.id))
    : availableFillMethods;
  const selectedFillMethod = fillMethods.find((method) => method.id === fillDraft.method) ?? null;
  const effectiveFillCustomValue = getFillReplacementValue(fillDraft, fillColumnRule);
  const fillPreview = useMemo(() => {
    if (!isCleaningToolsOpen || activeCleaningTool !== "fillIssues" || !deferredFillDraft.column) return { valid: false, error: "Choose a column.", targetCount: 0, changeCount: 0, skippedCount: 0, examples: [], allocations: [] };
    if (deferredFillDraft.column === ALL_ISSUE_COLUMNS) {
      const columnOptions = fillIssueColumns.map((column) => {
        const rule = resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
        return {
          column,
          isValid: (value) => validateValue(value, rule).valid,
          isMissing: (value) => isMissingValue(value, rule),
          isIgnoredMissing: (value, row) => isMissingValue(value, rule) && !getMissingIssue(row, column, rule),
        };
      });
      return calculateMultiColumnCustomFill(rows, columnOptions, deferredFillDraft);
    }
    const rule = resolveColumnRule(columnRules[deferredFillDraft.column] ?? createColumnRule("Text"), regexRuleLibrary);
    return calculateColumnFill(rows, {
      ...deferredFillDraft,
      customValue: getFillReplacementValue(deferredFillDraft, rule),
      type: rule.type,
      isValid: (value) => validateValue(value, rule).valid,
      isMissing: (value) => isMissingValue(value, rule),
      isIgnoredMissing: (value, row) => isMissingValue(value, rule) && !getMissingIssue(row, deferredFillDraft.column, rule),
    });
  }, [activeCleaningTool, columnRules, deferredFillDraft, fillIssueColumns, isCleaningToolsOpen, regexRuleLibrary, rows]);
  const estimatedFillWarning = selectedFillMethod && !["custom", "customDate"].includes(selectedFillMethod.id)
    ? `This method estimates ${fillPreview.targetCount.toLocaleString()} values from other rows and does not recover row level truth`
    : "";
  const isFillPreviewPending = deferredFillDraft !== fillDraft;
  const customFillWarning = useMemo(() => {
    if (!isCleaningToolsOpen || activeCleaningTool !== "fillIssues" || !["custom", "customDate"].includes(fillDraft.method)) return "";
    if (fillDraft.method === "customDate" && !fillDraft.customDate) return "";
    const columnsToCheck = fillDraft.column === ALL_ISSUE_COLUMNS ? fillIssueColumns : [fillDraft.column];
    const missingColumns = columnsToCheck.filter((column) => {
      const rule = resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
      return isMissingValue(getFillReplacementValue(fillDraft, rule), rule);
    });
    if (missingColumns.length) return "This replacement is treated as missing by the current column rule.";
    const failingColumns = columnsToCheck.filter((column) => {
      const rule = resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
      return !validateValue(getFillReplacementValue(fillDraft, rule), rule).valid;
    });
    if (!failingColumns.length) return "";
    return fillDraft.column === ALL_ISSUE_COLUMNS
      ? `This value will still be invalid in ${failingColumns.length.toLocaleString()} column${failingColumns.length === 1 ? "" : "s"}. You can apply it anyway.`
      : "This value does not pass the current column rule. You can apply it anyway.";
  }, [activeCleaningTool, columnRules, fillDraft, fillIssueColumns, isCleaningToolsOpen, regexRuleLibrary]);
  const invalidVisibleRegexColumns = useMemo(
    () => visibleColumns.filter((column) => {
      const rule = visibleColumnRules[column];
      return isCustomRegexMode(rule) && !getCustomRegexState(rule).valid;
    }),
    [visibleColumnRules, visibleColumns],
  );
  const invalidVisibleMissingColumns = useMemo(
    () => visibleColumns.filter((column) => !isMissingRuleValid(visibleColumnRules[column], columns, column)),
    [columns, visibleColumnRules, visibleColumns],
  );
  const unidentifiedVisibleColumns = useMemo(
    () => visibleColumns.filter((column) => visibleColumnRules[column]?.type === UNIDENTIFIED_TYPE),
    [visibleColumnRules, visibleColumns],
  );
  const canScan = rows.length > 0
    && unidentifiedVisibleColumns.length < visibleColumns.length
    && invalidVisibleRegexColumns.length === 0
    && invalidVisibleMissingColumns.length === 0;
  const scanBlockerMessage = invalidVisibleRegexColumns.length && invalidVisibleMissingColumns.length
    ? "Fix the invalid Regex and missing value rules before scanning"
    : invalidVisibleRegexColumns.length
      ? "Fix invalid custom Regex rules before scanning"
      : invalidVisibleMissingColumns.length
        ? "Finish the conditional missing value rules before scanning"
        : visibleColumns.length > 0 && unidentifiedVisibleColumns.length === visibleColumns.length
          ? "Choose a type for at least one visible column before scanning"
          : "";
  const fixableRelationshipIssues = useMemo(
    () => relationshipIssues.filter((issue) => issue.fixable),
    [relationshipIssues],
  );
  const lookupIssueCounts = useMemo(() => relationshipIssues.reduce((counts, issue) => {
    if (!issue.status) return counts;
    counts[issue.status] = (counts[issue.status] ?? 0) + 1;
    return counts;
  }, {}), [relationshipIssues]);
  const validationIssueRowCount = useMemo(
    () => new Set(validationIssues.map((issue) => issue.row)).size,
    [validationIssues],
  );
  const uniqueValidationIssues = useMemo(
    () => groupValidationIssues(validationIssues),
    [validationIssues],
  );
  const validationIssueRowIds = useMemo(
    () => new Set(validationIssues.map((issue) => issue.rowId).filter(Boolean)),
    [validationIssues],
  );
  const gridRows = useMemo(
    () => showIssueRowsOnly
      ? rows.filter((row) => validationIssueRowIds.has(row.__rowId))
      : rows,
    [rows, showIssueRowsOnly, validationIssueRowIds],
  );
  const dataBinGridColumns = useMemo(() => {
    const archivedColumns = dataBin.flatMap((entry) => entry.originalColumns ?? []);
    const rowColumns = [...new Set([...columns, ...archivedColumns])].filter((column) => column !== "__rowId");
    return [
      { field: "reason", headerName: "Reason", minWidth: 220, pinned: "left" },
      { field: "sourceAction", headerName: "Source", minWidth: 170 },
      { field: "movedAt", headerName: "Moved At", minWidth: 190 },
      { field: "originalIndex", headerName: "Original Row", valueFormatter: (params) => Number(params.value) + 1, minWidth: 135 },
      ...rowColumns.map((column) => ({
        colId: `row:${column}`,
        headerName: column,
        valueGetter: (params) => params.data?.row?.[column] ?? "",
        minWidth: 150,
      })),
    ];
  }, [columns, dataBin]);

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
                lockPosition: "left",
                suppressMovable: true,
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
            cellEditorSelector: (params) => getCellEditorForType(
              rule.type,
              params.value,
              getCategoryOptionsForRule(rule, getUniqueColumnValues(rowsRef.current, field)),
            ),
            headerComponent: ColumnHeader,
            headerComponentParams: {
              selectedColumn,
              onSelect: selectColumn,
            },
          };
        }),
      ],
    [columnRules, regexRuleLibrary, selectedColumn, showRowNumbers, visibleColumns],
  );

  function createCurrentWorkspaceSnapshot() {
    return {
      version: 4,
      rows,
      dataBin,
      columns,
      visibleColumns,
      columnRules,
      fileName,
      showRowNumbers,
      relationshipRules,
      history,
      runStats,
      challengeRevision: activeChallenge?.revision ?? null,
    };
  }

  function restoreWorkspaceSnapshot(snapshot, challengeId = "") {
    setRows(snapshot.rows ?? []);
    setDataBin(normalizeDataBin(snapshot.dataBin));
    setColumns(snapshot.columns ?? []);
    setVisibleColumns(snapshot.visibleColumns ?? snapshot.columns ?? []);
    setColumnRules(snapshot.columnRules ?? {});
    setFileName(snapshot.fileName ?? "Restored workspace");
    setValidationIssues([]);
    setLastScannedAt(null);
    setHasUnscannedChanges(Boolean(snapshot.rows?.length));
    setShowRowNumbers(snapshot.showRowNumbers ?? true);
    setSelectedColumn(snapshot.columns?.[0] ?? "");
    setRelationshipRules((snapshot.relationshipRules ?? []).map((rule) => ({ kind: "formula", ...rule })));
    setHistory(normalizeHistorySnapshot(snapshot.history));
    setChallengeEvaluation(null);
    setRunStats(normalizeRunStats(snapshot.runStats));
    setActiveChallengeId(challengeId);
    setIsValidationPanelOpen(false);
    setIsRelationshipPanelOpen(false);
    setShowIssueRowsOnly(false);
    setSelectedGridRowIds([]);
    setSelectedBinEntryIds([]);
  }

  async function loadData(nextRows, nextFileName, options = {}) {
    cancelChallengeCelebration();
    const columnSet = new Set();
    const normalizedRows = await processRowsInChunks(
      nextRows,
      (row, _index, output) => {
        const normalized = normalizeRow(row);
        for (const column of Object.keys(normalized)) {
          if (column !== "__rowId") columnSet.add(column);
        }
        output.push(normalized);
      },
      {
        onProgress: (progress) => setLoadingProgress({
          rowCount: nextRows.length,
          progress: 0.8 + progress * 0.2,
        }),
      },
    );
    const nextColumns = [...columnSet];
    const initialRules = Object.fromEntries(
      nextColumns.map((column) => [column, createColumnRule(UNIDENTIFIED_TYPE)]),
    );

    setRows(normalizedRows);
    setDataBin([]);
    setColumns(nextColumns);
    setVisibleColumns(nextColumns);
    setColumnRules(initialRules);
    setSelectedColumn(nextColumns[0] ?? "");
    setFileName(nextFileName);
    setValidationIssues([]);
    setLastScannedAt(null);
    setHasUnscannedChanges(true);
    setIsValidationPanelOpen(false);
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setHistory({ past: [], future: [] });
    setShowIssueRowsOnly(false);
    setSelectedGridRowIds([]);
    setSelectedBinEntryIds([]);
    setActiveChallengeId(options.challengeId ?? "");
    setChallengeEvaluation(null);
    setRunStats(createRunStats());
    setIsChallengeResultOpen(false);
    setIsObjectivesOpen(true);
    setIsObjectivesPortable(false);
    setIsInformationPortable(false);
    setPendingChallengeLaunch(null);
    setChallengeStoryPage(0);
    setChallengeStoryCharacterCount(0);
  }

  function playSound(name) {
    playGameSound(name, audioSettings);
  }

  async function enableGameAudio() {
    audioReadyRef.current = true;
    await unlockAudio();
  }

  function changeAudioSettings(nextSettings) {
    enableGameAudio();
    setAudioSettings((current) => ({ ...current, ...nextSettings }));
  }

  function changeEffectsMode(mode) {
    setEffectsMode(mode === "reduced" ? "reduced" : "full");
  }

  function flashFeedbackTargets(event) {
    if (!event?.targets?.length) return;
    const api = gridRef.current?.api;
    if (!api) return;
    const rowNodes = [];
    const columnsToFlash = new Set();
    const seenRows = new Set();
    for (const target of event.targets) {
      const rowNode = api.getRowNode(target.rowId);
      if (!rowNode || rowNode.rowIndex == null) continue;
      if (!seenRows.has(target.rowId)) {
        rowNodes.push(rowNode);
        seenRows.add(target.rowId);
      }
      if (visibleColumns.includes(target.column)) columnsToFlash.add(target.column);
    }
    if (!rowNodes.length || !columnsToFlash.size) return;
    api.flashCells({
      rowNodes,
      columns: [...columnsToFlash],
      flashDuration: isEffectsReduced ? 260 : 520,
      fadeDuration: isEffectsReduced ? 180 : 420,
    });
  }

  function focusHealthIssue(issue) {
    if (!issue?.rowId || !issue.column) return;
    setShowIssueRowsOnly(false);
    selectColumn(issue.column);
    document.querySelector(".table-grid")?.scrollIntoView({
      behavior: isEffectsReduced ? "auto" : "smooth",
      block: "center",
    });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const api = gridRef.current?.api;
      const rowNode = api?.getRowNode(issue.rowId);
      if (!api || !rowNode || rowNode.rowIndex == null) return;
      const pageSize = api.paginationGetPageSize?.() ?? 100;
      api.paginationGoToPage?.(Math.floor(rowNode.rowIndex / pageSize));
      api.ensureColumnVisible?.(issue.column);
      window.requestAnimationFrame(() => {
        api.ensureIndexVisible?.(rowNode.rowIndex, "middle");
        api.setFocusedCell?.(rowNode.rowIndex, issue.column);
        api.flashCells({
          rowNodes: [rowNode],
          columns: [issue.column],
          flashDuration: isEffectsReduced ? 260 : 620,
          fadeDuration: isEffectsReduced ? 180 : 480,
        });
      });
    }));
  }

  function postOfficeMessage(challenge, kind, context = {}, options = {}) {
    if (!challenge?.office) return;
    const turnKey = `${challenge.id}:${kind}`;
    const turn = officeMessageTurnsRef.current[turnKey] ?? 0;
    const content = getOfficeMessage(challenge.office, kind, turn, context);
    if (!content) return;
    officeMessageTurnsRef.current[turnKey] = turn + 1;
    officeMessageSequenceRef.current += 1;
    const message = {
      ...content,
      id: `office-${challenge.id}-${officeMessageSequenceRef.current}`,
    };
    setOfficeMessages((current) => [...current, message].slice(-12));
    if (options.open !== false) setIsOfficeChatOpen(true);
  }

  function startOfficeThread(challenge) {
    officeMessageTurnsRef.current = {};
    setOfficeMessages([]);
    setIsOfficeChatOpen(false);
    postOfficeMessage(challenge, "start");
  }

  async function openFreeClean() {
    const normalWorkspace = await loadWorkspace("normal").catch(() => null);
    if (normalWorkspace) restoreWorkspaceSnapshot(normalWorkspace, "");
    else resetLoadedFileState();
    setOfficeMessages([]);
    setIsOfficeChatOpen(false);
    setIsObjectivesPortable(false);
    setIsInformationPortable(false);
    setViewMode("workspace");
  }

  function showCampaign() {
    setViewMode("campaign");
    setIsAchievementsOpen(false);
    setIsOfficeChatOpen(false);
    setIsObjectivesPortable(false);
    setIsInformationPortable(false);
    setClipbitReaction({
      message: campaignPack === "hell"
        ? "We are back near the disk and I was having such a good time away from it"
        : isBootComplete(gameProgress)
        ? "Pick a file and I will supervise from a legally safe distance"
        : "Finish the five Boot Sequence stages because the desktop is currently held together by error messages",
      mood: campaignPack === "hell"
        ? "worried"
        : isBootComplete(gameProgress) ? "idle" : "smug",
    });
  }

  function handleHellTransition(phase) {
    if (phase === "start") {
      setIsClipbitMinimized(false);
      setClipbitReaction({
        message: "Wait that disk is not from this machine",
        mood: "terrified",
      });
      return;
    }
    if (phase === "breach") {
      playSound("hellBreach");
      setClipbitReaction({
        message: "WHY IS THE DATA BREATHING and why can I hear it",
        mood: "terrified",
      });
      return;
    }
    if (phase === "active") {
      setClipbitReaction({
        message: "You brought Dataset Hell into the office and I want that written in the incident report",
        mood: "terrified",
      });
      return;
    }
    if (phase === "ejecting") {
      setClipbitReaction({
        message: "Do not touch anything until the screaming stops",
        mood: "worried",
      });
      return;
    }
    if (phase === "ejected") {
      setClipbitReaction({
        message: "It stopped screaming and I am choosing not to investigate further",
        mood: "worried",
      });
      return;
    }
    if (phase === "contained") {
      setIsClipbitMinimized(false);
      setClipbitReaction({
        message: "You cleaned all six files and somehow YOU are now the scariest thing in this office",
        mood: "terrified",
      });
    }
  }

  async function loadSample() {
    setLoadingKind("file");
    setChallengeLoadingTitle("sample_sales.csv");
    setLoadingProgress({ rowCount: 0, progress: null });
    setIsChallengeLoading(true);
    try {
      const parsed = await parseCsvInChunks("./sample_sales.csv", {
        download: true,
        onProgress: (progress) => setLoadingProgress({
          ...progress,
          progress: progress.progress === null ? null : progress.progress * 0.8,
        }),
      });
      await loadData(parsed.data, "sample_sales.csv");
    } finally {
      setIsChallengeLoading(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      window.alert("CleanSheet currently supports CSV files only.");
      return;
    }

    setChallengeLoadingTitle(file.name);
    setLoadingKind("file");
    setLoadingProgress({ rowCount: 0, progress: 0 });
    setIsChallengeLoading(true);
    try {
      const parsed = await parseCsvInChunks(file, {
        onProgress: (progress) => setLoadingProgress({
          ...progress,
          progress: progress.progress === null ? null : progress.progress * 0.8,
        }),
      });
      await loadData(parsed.data, file.name);
    } finally {
      setIsChallengeLoading(false);
    }
  }

  async function requestChallengeStory(challengeId, restart = false) {
    const challenge = getChallenge(challengeId);
    await enableGameAudio();
    playSound("open");
    if (!challenge?.story?.length) {
      openChallenge(challengeId, restart);
      return;
    }
    setPendingChallengeLaunch({ challengeId, restart });
    setChallengeStoryPage(0);
    setChallengeStoryCharacterCount(0);
  }

  function closeChallengeStory() {
    setPendingChallengeLaunch(null);
    setChallengeStoryPage(0);
    setChallengeStoryCharacterCount(0);
  }

  function revealChallengeStoryPage() {
    setChallengeStoryCharacterCount(challengeStoryText.length);
  }

  function showNextChallengeStoryPage() {
    if (!storyChallenge || !isChallengeStoryPageComplete) return;
    if (challengeStoryPage >= storyChallenge.story.length - 1) return;
    setChallengeStoryCharacterCount(0);
    setChallengeStoryPage((currentPage) => currentPage + 1);
  }

  async function beginPendingChallenge() {
    const pendingLaunch = pendingChallengeLaunch;
    if (!pendingLaunch || !isChallengeStoryPageComplete) return;
    closeChallengeStory();
    await openChallenge(pendingLaunch.challengeId, pendingLaunch.restart);
  }

  async function openChallenge(challengeId, restart = false) {
    const challenge = getChallenge(challengeId);
    if (!challenge) return;
    await enableGameAudio();
    setChallengeLoadError("");
    setLoadingKind("challenge");
    setChallengeLoadingTitle(challenge.title);
    setLoadingProgress({ rowCount: 0, progress: null });
    setIsChallengeLoading(true);
    try {
      if (rows.length) {
        const currentWorkspaceId = activeChallengeId ? `challenge:${activeChallengeId}` : "normal";
        await saveWorkspace(currentWorkspaceId, createCurrentWorkspaceSnapshot()).catch(() => {});
      }
      const workspaceId = `challenge:${challengeId}`;
      if (restart) await deleteWorkspace(workspaceId).catch(() => {});
      let saved = restart ? null : await loadWorkspace(workspaceId).catch(() => null);
      if (saved && !hasCurrentChallengeRevision(challenge, saved.challengeRevision)) {
        await deleteWorkspace(workspaceId).catch(() => {});
        saved = null;
      }
      if (saved) {
        restoreWorkspaceSnapshot(saved, challengeId);
      } else {
        const challengeRows = await loadChallengeRows(challenge);
        await loadData(challengeRows, `Challenge ${challenge.number}: ${challenge.title}`, { challengeId });
      }
      setViewMode("workspace");
      setClipbitReaction({ message: challenge.assistant?.start ?? "I have inspected the file and it is definitely your problem now", mood: "smug" });
      startOfficeThread(challenge);
    } catch (error) {
      setChallengeLoadError(error instanceof Error ? error.message : "The challenge could not be loaded");
    } finally {
      setIsChallengeLoading(false);
    }
  }

  async function loadChallengeRows(challenge) {
    if (challenge.createRows) return challenge.createRows();
    if (!challenge.dataFile) throw new Error("This challenge has no dataset attached");
    const parsed = await parseCsvInChunks(challenge.dataFile, {
      download: true,
      onProgress: (progress) => setLoadingProgress({
        ...progress,
        progress: progress.progress === null ? null : progress.progress * 0.8,
      }),
    });
    if (parsed.errors.length) throw new Error(`The dataset could not be read: ${parsed.errors[0].message}`);
    if (parsed.data.length !== challenge.rowCount) {
      throw new Error(`Expected ${challenge.rowCount.toLocaleString()} rows but found ${parsed.data.length.toLocaleString()}`);
    }
    return parsed.data;
  }

  async function exitChallenge() {
    cancelChallengeCelebration();
    if (activeChallengeId && (rows.length || dataBin.length)) {
      await saveWorkspace(`challenge:${activeChallengeId}`, createCurrentWorkspaceSnapshot()).catch(() => {});
    }
    const normalWorkspace = await loadWorkspace("normal").catch(() => null);
    if (normalWorkspace) restoreWorkspaceSnapshot(normalWorkspace, "");
    else resetLoadedFileState();
    setIsChallengeResultOpen(false);
    setOfficeMessages([]);
    setIsOfficeChatOpen(false);
    showCampaign();
  }

  function clearLoadedFile() {
    if (!rows.length && !dataBin.length) return;
    requestConfirmation({
      title: "Clear loaded file?",
      message: `Remove "${fileName}" and its autosaved workspace from this browser? Export the CSV first if you want to keep your changes.`,
      confirmLabel: "Clear file",
      tone: "danger",
      onConfirm: performClearLoadedFile,
    });
  }

  async function performClearLoadedFile() {
    const workspaceId = activeChallengeId ? `challenge:${activeChallengeId}` : "normal";
    await deleteWorkspace(workspaceId).catch(() => {});
    resetLoadedFileState();
  }

  function resetLoadedFileState() {
    cancelChallengeCelebration();
    setRows([]);
    setColumns([]);
    setVisibleColumns([]);
    setColumnRules({});
    setFileName("No file loaded");
    setValidationIssues([]);
    setLastScannedAt(null);
    setHasUnscannedChanges(false);
    setSelectedColumn("");
    setIsValidationPanelOpen(false);
    setColumnConversionNotice("");
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setIsRelationshipPanelOpen(false);
    setHistory({ past: [], future: [] });
    setDataBin([]);
    setShowIssueRowsOnly(false);
    setSelectedGridRowIds([]);
    setSelectedBinEntryIds([]);
    setActiveChallengeId("");
    setChallengeEvaluation(null);
    setRunStats(createRunStats());
    setIsChallengeResultOpen(false);
    setIsScanning(false);
    setIsObjectivesOpen(true);
    setIsObjectivesPortable(false);
    setIsInformationPortable(false);
    setPendingChallengeLaunch(null);
    setChallengeStoryPage(0);
    setChallengeStoryCharacterCount(0);
    setOfficeMessages([]);
    setIsOfficeChatOpen(false);
    setAutosaveStatus("Autosave ready");
  }

  function handleCellValueChanged(event) {
    const updatedRows = [...rows];
    const sourceIndex = rowIndexById.get(event.data.__rowId);
    const targetIndex = sourceIndex ?? event.node.sourceRowIndex ?? event.node.rowIndex;
    updatedRows[targetIndex] = { ...updatedRows[targetIndex], [event.colDef.field]: event.newValue };
    const before = event.oldValue ?? "";
    if (String(before) === String(event.newValue ?? "")) return;
    setRows(updatedRows);
    pushHistory({ label: "Edit cell", kind: "cells", changes: [{ rowId: event.data.__rowId, column: event.colDef.field, before, after: event.newValue }] });
    event.api.flashCells({
      rowNodes: [event.node],
      columns: [event.column],
      flashDuration: isEffectsReduced ? 220 : 360,
      fadeDuration: isEffectsReduced ? 160 : 280,
    });
    setHasUnscannedChanges(true);
  }

  function handleColumnMoved(event) {
    if (!event.finished || event.source !== "uiColumnMoved") return;
    const nextVisibleColumns = event.api
      .getAllDisplayedColumns()
      .map((column) => column.getColDef().field)
      .filter((field) => visibleColumns.includes(field));
    if (
      nextVisibleColumns.length !== visibleColumns.length
      || nextVisibleColumns.every((column, index) => column === visibleColumns[index])
    ) return;
    const nextColumns = mergeVisibleColumnOrder(columns, nextVisibleColumns);
    pushHistory({
      label: "Move columns",
      kind: "columnOrder",
      before: { columns, visibleColumns },
      after: { columns: nextColumns, visibleColumns: nextVisibleColumns },
    });
    setColumns(nextColumns);
    setVisibleColumns(nextVisibleColumns);
  }

  function pushHistory(action) {
    const nextAction = {
      ...action,
      actionId: action.actionId ?? crypto.randomUUID(),
      occurredAt: action.occurredAt ?? new Date().toISOString(),
    };
    const canStore = canStoreHistoryAction(nextAction);
    setHistory((current) => ({
      past: canStore ? appendHistoryAction(current.past, nextAction).actions : [],
      future: [],
    }));
    if (!canStore) setAutosaveStatus("Saved, but this change is too large for Undo");
    if (activeChallenge && isScoreableAction(nextAction)) {
      const changeSize = getActionChangeSize(nextAction);
      setRunStats((current) => ({
        ...current,
        moves: current.moves + 1,
        binnedRows: current.binnedRows + getBinnedRowCount(nextAction),
        largestChange: Math.max(current.largestChange, changeSize),
      }));
    }
    if (activeChallenge) {
      if (nextAction.kind === "moveRowsToBin") postOfficeMessage(activeChallenge, "delete");
      else if (nextAction.kind === "schema") postOfficeMessage(activeChallenge, "schema");
      else if (nextAction.feedback?.kind === "formula" || nextAction.audit?.type === "relationshipFix" || nextAction.audit?.type === "lookupFix") {
        postOfficeMessage(activeChallenge, "formula");
      }
    }
    const feedback = createActionFeedback(nextAction);
    if (feedback) dispatchFeedback({ type: "enqueue", event: feedback });
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
    applyHistoryAction(action, "undo");
    setHistory((current) => ({ past: current.past.slice(0, -1), future: [...current.future, action] }));
    if (activeChallenge) {
      setRunStats((current) => ({
        ...current,
        moves: isScoreableAction(action) ? Math.max(0, current.moves - 1) : current.moves,
        undoCount: current.undoCount + 1,
        binnedRows: Math.max(0, current.binnedRows - getBinnedRowCount(action)),
      }));
      setClipbitReaction((current) => current.mood === "alarmed"
        ? current
        : { message: "Undo is free so experiment wildly and pretend it was all intentional", mood: "smug" });
    }
    const feedback = createActionFeedback(action, "undo");
    if (feedback) dispatchFeedback({ type: "enqueue", event: feedback });
    if (action.kind !== "columnOrder") clearDerivedResults();
  }

  function redo() {
    const action = history.future.at(-1);
    if (!action) return;
    applyHistoryAction(action, "redo");
    setHistory((current) => ({
      past: appendHistoryAction(current.past, action).actions,
      future: current.future.slice(0, -1),
    }));
    if (activeChallenge && isScoreableAction(action)) {
      setRunStats((current) => ({
        ...current,
        moves: current.moves + 1,
        binnedRows: current.binnedRows + getBinnedRowCount(action),
      }));
    }
    const feedback = createActionFeedback(action, "redo");
    if (feedback) dispatchFeedback({ type: "enqueue", event: feedback });
    if (action.kind !== "columnOrder") clearDerivedResults();
  }

  function applyHistoryAction(action, direction) {
    if (action.kind === "compound") {
      const children = direction === "undo" ? [...action.actions].reverse() : action.actions;
      for (const child of children) applyHistoryAction(child, direction);
      return;
    }
    if (action.kind === "cells") {
      setRows((currentRows) => applyCellChanges(currentRows, action.changes, direction));
      return;
    }
    if (action.kind === "deleteRows") {
      const deletedIds = new Set(action.rows.map((item) => item.row.__rowId));
      setRows((currentRows) => direction === "undo"
        ? restoreDeletedRows(currentRows, action.rows)
        : currentRows.filter((row) => !deletedIds.has(row.__rowId)));
      return;
    }
    if (["moveRowsToBin", "restoreRowsFromBin"].includes(action.kind)) {
      const shouldMove = action.kind === "moveRowsToBin" ? direction === "redo" : direction === "undo";
      const entryIds = new Set(action.entries.map((entry) => entry.id));
      const rowIds = new Set(action.entries.map((entry) => entry.row.__rowId));
      if (shouldMove) {
        setRows((currentRows) => currentRows.filter((row) => !rowIds.has(row.__rowId)));
        setDataBin((currentEntries) => {
          const existingIds = new Set(currentEntries.map((entry) => entry.id));
          return [...currentEntries, ...action.entries.filter((entry) => !existingIds.has(entry.id))];
        });
      } else {
        setRows((currentRows) => restoreEntriesFromBin(currentRows, [], action.entries, columns).rows);
        setDataBin((currentEntries) => currentEntries.filter((entry) => !entryIds.has(entry.id)));
      }
      return;
    }
    if (action.kind === "schema") {
      setRows((currentRows) => direction === "undo"
        ? undoSchemaTransformRows(currentRows, action)
        : applySchemaTransformToRows(currentRows, action.operation));
      const metadata = direction === "undo" ? action.before : action.after;
      setColumns(metadata.columns);
      setVisibleColumns(metadata.visibleColumns);
      setColumnRules(metadata.columnRules);
      if (metadata.relationshipRules) setRelationshipRules(metadata.relationshipRules);
      setSelectedColumn(metadata.selectedColumn);
      return;
    }
    if (action.kind === "columnOrder") {
      const metadata = direction === "undo" ? action.before : action.after;
      setColumns(metadata.columns);
      setVisibleColumns(metadata.visibleColumns);
      return;
    }
    if (action.kind === "config") {
      const config = direction === "undo" ? action.before : action.after;
      setColumnRules(config.columnRules);
      setRelationshipRules(config.relationshipRules);
    }
  }

  function clearDerivedResults() {
    setValidationIssues([]);
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setShowIssueRowsOnly(false);
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
        pushHistory({
          label: "Find & Replace",
          kind: "cells",
          changes,
          audit: { type: "findReplace", columns: [...visibleColumns], ...findReplaceDraft },
        });
        clearDerivedResults();
        setIsCleaningToolsOpen(false);
      },
    });
  }

  function openCleaningTools(tool = "home") {
    if (!isCleaningToolUnlocked(cleaningToolAccess, tool)) {
      const lockedTool = getCleaningTool(tool);
      setToolLockNotice(lockedTool.lockedDescription
        ? `${lockedTool.title} is offline here and ${lockedTool.lockedDescription.toLowerCase()}`
        : `${lockedTool.title} is offline for this level and a challenge that needs it will switch it on`);
      setActiveCleaningTool("home");
      setIsCleaningToolsOpen(true);
      return;
    }
    setToolLockNotice("");
    if (tool === "fillIssues") {
      if (!fillIssueColumns.length || hasUnscannedChanges) {
        setToolLockNotice(hasUnscannedChanges
          ? "Scan again before filling issues so the tool uses current results"
          : "Scan the visible columns and Fill Issues will switch on when problems are found");
        setActiveCleaningTool("home");
        setIsCleaningToolsOpen(true);
        return;
      }
      const nextColumn = fillIssueColumns.includes(selectedColumn)
        ? selectedColumn
        : fillIssueColumns[0];
      setFillDraft({ ...EMPTY_FILL_DRAFT, column: nextColumn });
    }
    if (tool === "missingValues") {
      const column = columns.includes(selectedColumn) ? selectedColumn : columns[0] ?? "";
      setMissingRuleDraft(createMissingRuleDraft(column));
      setMissingRuleNotice("");
    }
    if (tool === "duplicates") {
      setDuplicateDraft((draft) => ({ ...draft, columns: draft.columns.filter((column) => columns.includes(column)).length ? draft.columns.filter((column) => columns.includes(column)) : [...visibleColumns] }));
    }
    if (tool === "textCleanup") {
      setTextCleanupDraft((draft) => ({ ...draft, columns: draft.columns.filter((column) => columns.includes(column)).length ? draft.columns.filter((column) => columns.includes(column)) : selectedColumn ? [selectedColumn] : [...visibleColumns] }));
    }
    if (tool === "manageColumns") {
      const source = columns.includes(splitDraft.sourceColumn) ? splitDraft.sourceColumn : selectedColumn || columns[0] || "";
      setSplitDraft((draft) => ({
        ...draft,
        sourceColumn: source,
        outputColumns: draft.sourceColumn === source ? draft.outputColumns : [`${source || "Part"} 1`, `${source || "Part"} 2`],
      }));
      setCombineDraft((draft) => ({
        ...draft,
        sourceColumns: draft.sourceColumns.filter((column) => columns.includes(column)).length >= 2
          ? draft.sourceColumns.filter((column) => columns.includes(column))
          : visibleColumns.slice(0, 2),
      }));
      setDeleteColumnsDraft((draft) => ({
        ...draft,
        columns: draft.columns.filter((column) => columns.includes(column)),
      }));
    }
    setActiveCleaningTool(tool);
    setIsCleaningToolsOpen(true);
  }

  function createMissingRuleDraft(column, rules = columnRules) {
    if (!column) return EMPTY_MISSING_RULE_DRAFT;
    const rule = normalizeMissingRule(rules[column] ?? createColumnRule("Text"));
    return {
      column,
      missingPolicy: rule.missingPolicy,
      missingTokens: [...rule.missingTokens],
      missingTokensInput: rule.missingTokens.join(", "),
      missingTokenCaseSensitive: rule.missingTokenCaseSensitive,
      missingCondition: { ...rule.missingCondition },
    };
  }

  function changeMissingRuleColumn(column) {
    setMissingRuleDraft(createMissingRuleDraft(column));
    setMissingRuleNotice("");
  }

  function updateMissingRuleDraft(field, value) {
    setMissingRuleDraft((draft) => ({ ...draft, [field]: value }));
    setMissingRuleNotice("");
  }

  function saveMissingRuleDraft() {
    const column = missingRuleDraft.column;
    if (!column || !isMissingRuleValid(missingRuleDraft, columns, column)) return;
    const currentRule = columnRules[column] ?? createColumnRule("Text");
    const normalizedRule = normalizeMissingRule({
      ...currentRule,
      missingPolicy: missingRuleDraft.missingPolicy,
      missingTokens: missingRuleDraft.missingTokens,
      missingTokenCaseSensitive: missingRuleDraft.missingTokenCaseSensitive,
      missingCondition: missingRuleDraft.missingCondition,
    });
    const nextRules = { ...columnRules, [column]: normalizedRule };
    pushHistory({
      label: `Configure missing values for ${column}`,
      kind: "config",
      before: { columnRules, relationshipRules },
      after: { columnRules: nextRules, relationshipRules },
      audit: { type: "missingRule", column },
    });
    setColumnRules(nextRules);
    setMissingRuleDraft(createMissingRuleDraft(column, nextRules));
    setMissingRuleNotice("");
    clearDerivedResults();
    setActiveCleaningTool("home");
    setIsCleaningToolsOpen(false);
  }

  function toggleToolColumn(setter, key, column) {
    setter((draft) => {
      const current = draft[key] ?? [];
      return { ...draft, [key]: current.includes(column) ? current.filter((item) => item !== column) : [...current, column] };
    });
  }

  function commitRowsToDataBin(rowIds, { label, reason, sourceAction, audit }) {
    const uniqueRowIds = [...new Set(rowIds)].filter(Boolean);
    const entries = createBinEntries(rows, uniqueRowIds, { columns, reason, sourceAction });
    if (!entries.length) return 0;
    const next = moveEntriesToBin(rows, dataBin, entries);
    setRows(next.rows);
    setDataBin(next.dataBin);
    setSelectedGridRowIds([]);
    gridRef.current?.api?.deselectAll();
    pushHistory({ label, kind: "moveRowsToBin", entries, audit });
    clearDerivedResults();
    if (activeChallenge && next.rows.length === 0) triggerChallengeRowWipeout(activeChallenge.id);
    return entries.length;
  }

  function triggerChallengeRowWipeout(challengeId) {
    if (!challengeId || isRowWipeoutSceneOpen) return;
    playSound("error");
    setRowWipeoutChallengeId(challengeId);
    setIsClipbitMinimized(false);
    setClipbitReaction({
      message: "CONGRATS, you actually did it, you got rid of the problem at its roots and also got rid of the roots",
      mood: "smug",
    });
    setIsRowWipeoutSceneOpen(true);
  }

  async function restartAfterRowWipeout() {
    if (!rowWipeoutChallengeId) return;
    const challengeId = rowWipeoutChallengeId;
    setRowWipeoutChallengeId("");
    setIsRowWipeoutSceneOpen(false);
    await openChallenge(challengeId, true);
    setIsClipbitMinimized(false);
    setClipbitReaction({
      message: "That was not data cleaning, that was data disappearance, please do not do that again",
      mood: "angry",
    });
  }

  function moveSelectedRowsToDataBin() {
    if (!selectedGridRowIds.length) return;
    requestConfirmation({
      title: "Move selected rows to Data Bin?",
      message: `Move ${selectedGridRowIds.length.toLocaleString()} selected row${selectedGridRowIds.length === 1 ? "" : "s"} out of the active table? You can restore them from Cleaning Tools`,
      confirmLabel: "Move to Data Bin",
      tone: "danger",
      onConfirm: () => commitRowsToDataBin(selectedGridRowIds, {
        label: "Move selected rows to Data Bin",
        reason: "Moved manually",
        sourceAction: "manual selection",
        audit: { type: "moveRowsToBin", source: "manual" },
      }),
    });
  }

  function restoreDataBinEntries(entryIds) {
    const selectedIds = new Set(entryIds);
    const entries = dataBin.filter((entry) => selectedIds.has(entry.id));
    if (!entries.length) return;
    const archivedColumns = [...new Set(entries.flatMap((entry) => getArchivedColumns(entry, columns)))];
    requestConfirmation({
      title: "Restore rows from Data Bin?",
      message: `Restore ${entries.length.toLocaleString()} row${entries.length === 1 ? "" : "s"} near their original positions${archivedColumns.length ? `? Archived columns will stay in the Bin export: ${archivedColumns.join(", ")}` : "?"}`,
      confirmLabel: "Restore rows",
      tone: "default",
      onConfirm: () => {
        const next = restoreEntriesFromBin(rows, dataBin, entries, columns);
        setRows(next.rows);
        setDataBin(next.dataBin);
        setSelectedBinEntryIds([]);
        pushHistory({ label: "Restore rows from Data Bin", kind: "restoreRowsFromBin", entries, audit: { type: "restoreRowsFromBin" } });
        clearDerivedResults();
      },
    });
  }

  function applyDuplicateRemoval() {
    const plan = buildDuplicatePlan(rows, duplicateDraft, true);
    if (!plan.valid || !plan.deleteCount) return;
    requestConfirmation({
      title: "Move duplicate rows to Data Bin?",
      message: `Move ${plan.deleteCount.toLocaleString()} row${plan.deleteCount === 1 ? "" : "s"} from ${plan.groupCount.toLocaleString()} duplicate group${plan.groupCount === 1 ? "" : "s"}?`,
      confirmLabel: "Move duplicates",
      tone: "danger",
      onConfirm: () => {
        commitRowsToDataBin(plan.deletedRows.map((item) => item.row.__rowId), {
          label: "Move duplicates to Data Bin",
          reason: `Duplicate on ${duplicateDraft.columns.join(", ")} and kept ${duplicateDraft.keep}`,
          sourceAction: "duplicate cleanup",
          audit: { type: "deduplicate", ...duplicateDraft, columns: [...duplicateDraft.columns] },
        });
        setIsCleaningToolsOpen(false);
      },
    });
  }

  function applyTextCleanup() {
    const plan = buildTextCleanupPlan(rows, textCleanupDraft, true);
    if (!plan.valid || !plan.changeCount) return;
    requestConfirmation({
      title: "Clean selected text?",
      message: `Update ${plan.changeCount.toLocaleString()} cell${plan.changeCount === 1 ? "" : "s"} across ${textCleanupDraft.columns.length.toLocaleString()} column${textCleanupDraft.columns.length === 1 ? "" : "s"}?`,
      confirmLabel: "Apply cleanup",
      tone: "default",
      onConfirm: () => {
        setRows((currentRows) => applyCellChanges(currentRows, plan.changes, "redo"));
        pushHistory({
          label: "Clean text",
          kind: "cells",
          changes: plan.changes,
          audit: { type: "textCleanup", ...textCleanupDraft, columns: [...textCleanupDraft.columns] },
        });
        clearDerivedResults();
        setIsCleaningToolsOpen(false);
      },
    });
  }

  function applySplitColumns() {
    applySchemaOperation("Split column", {
      type: "splitColumn",
      ...splitDraft,
      outputColumns: splitDraft.outputColumns.map((column) => column.trim()),
    });
  }

  function applyCombinedColumns() {
    applySchemaOperation("Combine columns", {
      type: "combineColumns",
      ...combineDraft,
      outputColumn: combineDraft.outputColumn.trim(),
      sourceColumns: [...combineDraft.sourceColumns],
    });
  }

  async function resetPlayerProgress() {
    await Promise.all(CHALLENGES.map((challenge) => (
      deleteWorkspace(`challenge:${challenge.id}`).catch(() => {})
    )));
    window.localStorage.removeItem(GAME_PROGRESS_KEY);
    window.location.reload();
  }

  function unlockHellDiskForTesting() {
    const completedAt = new Date().toISOString();
    setGameProgress((current) => {
      const records = { ...current.records };
      for (const challenge of CHALLENGES.filter((item) => item.tutorial || item.pack === "core")) {
        const previous = records[challenge.id] ?? {};
        records[challenge.id] = {
          ...previous,
          revision: challenge.revision,
          complete: true,
          grade: previous.grade ?? "A",
          score: previous.score ?? 95,
          bestMoves: previous.bestMoves ?? 0,
          bestCombo: previous.bestCombo ?? 0,
          fewestHints: previous.fewestHints ?? 0,
          completions: Math.max(previous.completions ?? 0, 1),
          completedAt: previous.completedAt ?? completedAt,
        };
      }
      return { ...current, records };
    });
    setCampaignPack("core");
    setIsAchievementsOpen(false);
    setIsClipbitMinimized(false);
    setClipbitReaction({
      message: "Testing shortcut accepted and the second disk is now your problem",
      mood: "worried",
    });
  }

  function applyCreateColumn() {
    const operation = {
      ...createColumnDraft,
      column: createColumnDraft.column.trim(),
    };
    const valueValidation = validateCreateColumnValue(operation);
    if (!valueValidation.valid) return;
    applySchemaOperation("Create column", operation);
  }

  function applyDeleteColumns() {
    applySchemaOperation("Delete columns", {
      ...deleteColumnsDraft,
      columns: [...deleteColumnsDraft.columns],
    });
  }

  function applySchemaOperation(label, operation) {
    const validation = validateSchemaOperation(columns, operation);
    if (!validation.valid) return;
    const { nextColumns, nextVisibleColumns, addedColumns, removedColumns } = getSchemaOperationColumns(columns, visibleColumns, operation);
    const removedColumnSet = new Set(removedColumns);
    const removedRelationships = relationshipRules.filter((rule) => (
      getRelationshipRuleColumns(rule).some((column) => removedColumnSet.has(column))
    ));
    const nextRelationships = relationshipRules.filter((rule) => !removedRelationships.includes(rule));
    const nextSelectedColumn = addedColumns[0]
      ?? (nextColumns.includes(selectedColumn) ? selectedColumn : nextColumns[0] ?? "");
    const confirmationMessage = operation.type === "deleteColumns"
      ? `Delete ${removedColumns.length.toLocaleString()} column${removedColumns.length === 1 ? "" : "s"} across ${rows.length.toLocaleString()} rows${removedRelationships.length ? ` and remove ${removedRelationships.length.toLocaleString()} connected relation${removedRelationships.length === 1 ? "" : "s"}` : ""}?`
      : operation.type === "createColumn"
        ? `Create "${operation.column}" across ${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"}?`
        : `${label} across ${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"}${operation.removeSources ? " and remove the source columns" : ""}?`;
    requestConfirmation({
      title: `${label}?`,
      message: confirmationMessage,
      confirmLabel: label,
      tone: operation.type === "deleteColumns" ? "danger" : "default",
      onConfirm: () => {
        const nextRules = { ...columnRules };
        for (const column of removedColumns) delete nextRules[column];
        for (const column of addedColumns) {
          nextRules[column] = createColumnRule(
            operation.type === "createColumn" ? operation.dataType : "Text",
          );
        }
        const action = createSchemaHistoryAction({
          label,
          operation,
          rows,
          addedColumns,
          removedColumns,
          before: { columns, visibleColumns, columnRules, relationshipRules, selectedColumn },
          after: { columns: nextColumns, visibleColumns: nextVisibleColumns, columnRules: nextRules, relationshipRules: nextRelationships, selectedColumn: nextSelectedColumn },
          audit: operation,
        });
        setRows((currentRows) => applySchemaTransformToRows(currentRows, operation));
        setColumns(nextColumns);
        setVisibleColumns(nextVisibleColumns);
        setColumnRules(nextRules);
        setRelationshipRules(nextRelationships);
        setSelectedColumn(nextSelectedColumn);
        if (relationshipDraft.id && removedRelationships.some((rule) => rule.id === relationshipDraft.id)) {
          setRelationshipDraft(EMPTY_RELATIONSHIP_DRAFT);
        }
        pushHistory(action);
        clearDerivedResults();
        setIsCleaningToolsOpen(false);
      },
    });
  }

  function snapshotColumnRules(columnNames, sourceRules = columnRules) {
    return Object.fromEntries(columnNames.filter(Boolean).map((column) => {
      const rule = resolveColumnRule(sourceRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
      return [column, { ...rule, savedRegexId: "" }];
    }));
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
    setColumnConversionNotice("");
  }

  function handleExpectedTypeChange(column, nextType) {
    const nextRules = { ...columnRules, [column]: createColumnRule(nextType) };
    pushHistory({
      label: `Set ${column} to ${nextType}`,
      kind: "config",
      before: { columnRules, relationshipRules },
      after: { columnRules: nextRules, relationshipRules },
      audit: { type: "columnType", column, nextType },
    });
    setColumnRules(nextRules);
    setColumnConversionNotice("");
    setHasUnscannedChanges(true);
  }

  function openRuleBuilder() {
    if (!selectedColumn) return;
    const currentRule = resolveColumnRule(columnRules[selectedColumn] ?? createColumnRule("Text"), regexRuleLibrary);
    if (currentRule.type === UNIDENTIFIED_TYPE) return;
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
      missingCondition: currentRule.missingCondition ?? DEFAULT_MISSING_CONDITION,
      missingTokensInput: (currentRule.missingTokens ?? []).join(", "),
    });
    setAllowedValueInput("");
    setExistingCategoryFilter("");
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

  function toggleExistingCategoryValue(value) {
    setRuleDraft((currentRule) => {
      const currentValues = currentRule.allowedValues ?? [];
      const isSelected = currentValues.includes(value);
      return {
        ...currentRule,
        allowedValues: isSelected
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  }

  function addShownCategoryValues() {
    if (!filteredExistingCategoryOptions.length) return;
    setRuleDraft((currentRule) => {
      const currentValues = currentRule.allowedValues ?? [];
      return {
        ...currentRule,
        allowedValues: [...new Set([...currentValues, ...filteredExistingCategoryOptions])],
      };
    });
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
    const { missingTokensInput: _missingTokensInput, ...savedRule } = ruleDraft;
    const nextRules = { ...columnRules, [selectedColumn]: normalizeMissingRule(savedRule) };
    pushHistory({
      label: `Configure ${selectedColumn}`,
      kind: "config",
      before: { columnRules, relationshipRules },
      after: { columnRules: nextRules, relationshipRules },
      audit: { type: "columnRule", column: selectedColumn },
    });
    setColumnRules(nextRules);
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

  function updateRelationshipDraft(field, value) {
    if (["kind", "sourceColumn", "targetColumn"].includes(field)) {
      lookupAnalysisAbortRef.current?.abort();
      setLookupPreview(null);
      setLookupFinder(null);
      setLookupAnalysisProgress(null);
    }
    setRelationshipDraft((currentDraft) => {
      if (field === "kind") {
        return {
          ...currentDraft,
          kind: value,
          sourceColumn: "",
          targetColumn: "",
          formula: "",
          lookupDirection: "none",
        };
      }
      if (field === "sourceColumn" && currentDraft.kind === "lookup") {
        return { ...currentDraft, sourceColumn: value, targetColumn: "", lookupDirection: "none" };
      }
      return { ...currentDraft, [field]: value };
    });
  }

  function getLookupAnalysisOptions(
    sourceColumn,
    targetColumn,
    collectIssues = true,
    issueLimit = Number.POSITIVE_INFINITY,
    mappingLimit = collectIssues ? 25 : 0,
    repairLimit = collectIssues ? 25 : 0,
  ) {
    const sourceRule = { ...relationshipColumnRules[sourceColumn], column: sourceColumn };
    const targetRule = { ...relationshipColumnRules[targetColumn], column: targetColumn };
    return {
      sourceRule,
      targetRule,
      collectIssues,
      issueLimit,
      mappingLimit,
      repairLimit,
      isMissing: (value, columnRule, row) => Boolean(getMissingIssue(row, columnRule.column, columnRule)),
      isValid: (value, columnRule, row) => (
        isMissingValue(value, columnRule)
          ? !getMissingIssue(row, columnRule.column, columnRule)
          : validateValue(value, columnRule).valid
      ),
    };
  }

  function analyzeLookupDirection(rule, sourceColumn, targetColumn, collectIssues = true, dataRows = rows) {
    return checkLookupRows(
      dataRows,
      { ...rule, sourceColumn, targetColumn },
      getLookupAnalysisOptions(sourceColumn, targetColumn, collectIssues),
    );
  }

  function analyzeLookupDirectionInChunks(rule, sourceColumn, targetColumn, controller, onProgress) {
    return checkLookupRowsInChunks(
      rows,
      { ...rule, sourceColumn, targetColumn },
      getLookupAnalysisOptions(sourceColumn, targetColumn, false, 0, 30, 30),
      { signal: controller.signal, onProgress },
    );
  }

  async function findLogicalRelations() {
    const anchorColumn = relationshipDraft.sourceColumn;
    const candidateColumns = visibleColumns.filter((column) => column !== anchorColumn);
    if (relationshipDraft.kind !== "lookup" || !anchorColumn || !candidateColumns.length) return;

    lookupAnalysisAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAnalysisAbortRef.current = controller;
    const sampledRows = sampleLookupRows(rows);
    const foundCandidates = [];
    setRelationshipDraft((currentDraft) => ({ ...currentDraft, targetColumn: "", lookupDirection: "none" }));
    setLookupPreview(null);
    setLookupFinder({
      rows,
      columnRules,
      visibleColumns,
      anchorColumn,
      sampleSize: sampledRows.length,
      totalRows: rows.length,
      results: [],
      status: "finding",
    });
    setLookupAnalysisProgress({ mode: "finding", progress: 0, label: "Comparing visible columns" });

    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      for (let index = 0; index < candidateColumns.length; index += 1) {
        if (controller.signal.aborted) throw new DOMException("Operation cancelled", "AbortError");
        const candidateColumn = candidateColumns[index];
        const forward = analyzeLookupDirection(
          relationshipDraft,
          anchorColumn,
          candidateColumn,
          false,
          sampledRows,
        );
        const reverse = analyzeLookupDirection(
          relationshipDraft,
          candidateColumn,
          anchorColumn,
          false,
          sampledRows,
        );
        foundCandidates.push({
          column: candidateColumn,
          forward,
          reverse,
          recommendation: recommendLookupDirection(forward, reverse),
        });
        const progress = (index + 1) / candidateColumns.length;
        setLookupAnalysisProgress({ mode: "finding", progress, label: `Checked ${index + 1} of ${candidateColumns.length} columns` });
        if ((index + 1) % 2 === 0 || index === candidateColumns.length - 1) {
          setLookupFinder({
            rows,
            columnRules,
            visibleColumns,
            anchorColumn,
            sampleSize: sampledRows.length,
            totalRows: rows.length,
            results: rankLookupCandidates(foundCandidates),
            status: index === candidateColumns.length - 1 ? "ready" : "finding",
          });
        }
        if (index < candidateColumns.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setLookupFinder((currentFinder) => currentFinder && { ...currentFinder, status: "error", error: error.message });
      }
    } finally {
      if (lookupAnalysisAbortRef.current === controller) {
        lookupAnalysisAbortRef.current = null;
        setLookupAnalysisProgress(null);
      }
    }
  }

  async function verifyLogicalRelation(candidateColumn) {
    const anchorColumn = relationshipDraft.sourceColumn;
    if (relationshipDraft.kind !== "lookup" || !anchorColumn || !candidateColumn) return;
    lookupAnalysisAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAnalysisAbortRef.current = controller;
    const verificationRule = { ...relationshipDraft, sourceColumn: anchorColumn, targetColumn: candidateColumn };
    let lastProgress = -1;
    const reportProgress = (progress) => {
      const percent = Math.round(progress * 100);
      if (percent === lastProgress) return;
      lastProgress = percent;
      setLookupAnalysisProgress({
        mode: "verifying",
        progress,
        label: `Verifying ${anchorColumn} and ${candidateColumn} on the full file`,
      });
    };
    setRelationshipDraft((currentDraft) => ({
      ...currentDraft,
      targetColumn: candidateColumn,
      lookupDirection: "none",
    }));
    setLookupPreview(null);
    reportProgress(0);

    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const forward = await analyzeLookupDirectionInChunks(
        verificationRule,
        anchorColumn,
        candidateColumn,
        controller,
        (progress) => reportProgress(progress / 2),
      );
      const reverse = await analyzeLookupDirectionInChunks(
        verificationRule,
        candidateColumn,
        anchorColumn,
        controller,
        (progress) => reportProgress(0.5 + progress / 2),
      );
      const recommendation = recommendLookupDirection(forward, reverse);
      setRelationshipDraft((currentDraft) => (
        currentDraft.sourceColumn === anchorColumn
          ? { ...currentDraft, targetColumn: candidateColumn, lookupDirection: recommendation }
          : currentDraft
      ));
      setLookupPreview({
        rows,
        columnRules,
        sourceColumn: anchorColumn,
        targetColumn: candidateColumn,
        forward,
        reverse,
        recommendation,
      });
    } catch (error) {
      if (error.name !== "AbortError") {
        setLookupFinder((currentFinder) => currentFinder && { ...currentFinder, status: "error", error: error.message });
      }
    } finally {
      if (lookupAnalysisAbortRef.current === controller) {
        lookupAnalysisAbortRef.current = null;
        setLookupAnalysisProgress(null);
      }
    }
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
    if (!canSaveRelationship) return;
    const isLookup = relationshipDraft.kind === "lookup";
    const lookupDirection = relationshipDraft.lookupDirection
      ?? (relationshipDraft.bidirectional ? "both" : "forward");
    const isBidirectional = isLookup && lookupDirection === "both";
    const sourceColumn = isLookup && lookupDirection === "reverse"
      ? relationshipDraft.targetColumn
      : relationshipDraft.sourceColumn;
    const targetColumn = isLookup && lookupDirection === "reverse"
      ? relationshipDraft.sourceColumn
      : relationshipDraft.targetColumn;
    const nextRule = {
      ...relationshipDraft,
      id: relationshipDraft.id || `relationship-${Date.now()}`,
      kind: isLookup ? "lookup" : "formula",
      name: relationshipDraft.name.trim() || (isLookup
        ? isBidirectional
          ? `${sourceColumn} and ${targetColumn}`
          : `${targetColumn} from ${sourceColumn}`
        : `${relationshipDraft.targetColumn} calculation`),
      sourceColumn,
      targetColumn,
      formula: isLookup ? "" : relationshipDraft.formula.trim(),
      bidirectional: isBidirectional,
      enabled: relationshipDraft.enabled !== false,
    };
    delete nextRule.lookupDirection;
    setRelationshipRules((currentRules) => (
      currentRules.some((rule) => rule.id === nextRule.id)
        ? currentRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
        : [...currentRules, nextRule]
    ));
    setRelationshipDraft(EMPTY_RELATIONSHIP_DRAFT);
    setLookupPreview(null);
    setLookupFinder(null);
  }

  function editRelationshipRule(rule) {
    setRelationshipDraft({ ...rule, lookupDirection: rule.bidirectional ? "both" : "forward" });
    setLookupPreview(null);
    setLookupFinder(null);
    setIsRelationshipPanelOpen(true);
  }

  function duplicateRelationshipRule(rule) {
    setRelationshipDraft({ ...rule, id: "", name: `${rule.name} copy`, lookupDirection: rule.bidirectional ? "both" : "forward" });
    setLookupPreview(null);
    setLookupFinder(null);
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
    const nextIssues = rulesToCheck.flatMap((rule) => {
      if (rule.kind !== "lookup") return checkRelationshipRows(rows, rule, rule.validation.ast, relationshipColumnRules);
      const directions = [
        { sourceColumn: rule.sourceColumn, targetColumn: rule.targetColumn },
        ...(rule.bidirectional
          ? [{ sourceColumn: rule.targetColumn, targetColumn: rule.sourceColumn }]
          : []),
      ];
      return directions.flatMap((direction) => analyzeLookupDirection(
        rule,
        direction.sourceColumn,
        direction.targetColumn,
      ).issues);
    });
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
    const selectedIssues = relationshipIssues.filter((issue) => issue.fixable && selectedRelationshipFixes.includes(issue.id));
    const selectedRuleIds = [...new Set(selectedIssues.map((issue) => issue.ruleId))];
    const selectedRuleColumns = relationshipRuleStates
      .filter((rule) => selectedRuleIds.includes(rule.id))
      .flatMap((rule) => getRelationshipRuleColumns(rule));
    const selectedRules = relationshipRuleStates.filter((rule) => selectedRuleIds.includes(rule.id));
    const includesLookup = selectedRules.some((rule) => rule.kind === "lookup");
    const fixesByRowId = new Map();
    for (const issue of selectedIssues) {
      const rowFixes = fixesByRowId.get(issue.rowId) ?? [];
      rowFixes.push(issue);
      fixesByRowId.set(issue.rowId, rowFixes);
    }
    if (!fixesByRowId.size) return;

    const changes = [];
    const nextRows = rows.map((row) => {
      const nextRow = { ...row };
      for (const issue of fixesByRowId.get(row.__rowId) ?? []) {
        changes.push({ rowId: row.__rowId, column: issue.targetColumn, before: row[issue.targetColumn], after: issue.suggestedValue });
        nextRow[issue.targetColumn] = issue.suggestedValue;
      }
      return nextRow;
    });
    setRows(nextRows);
    if (changes.length) pushHistory({
      label: "Apply relationship fixes",
      kind: "cells",
      changes,
      feedback: {
        kind: includesLookup ? "lookup" : "formula",
        sourceColumns: [...new Set(
          selectedRules.flatMap((rule) => rule.kind === "lookup"
            ? rule.bidirectional ? [rule.sourceColumn, rule.targetColumn] : [rule.sourceColumn]
            : rule.validation.references ?? []),
        )],
        targetColumns: [...new Set(selectedIssues.map((issue) => issue.targetColumn))],
      },
      audit: { type: includesLookup ? "lookupFix" : "relationshipFix", relationshipIds: selectedRuleIds, rules: snapshotColumnRules([...new Set(selectedRuleColumns)]) },
    });
    setRelationshipIssues((currentIssues) => currentIssues.filter((issue) => !selectedRelationshipFixes.includes(issue.id)));
    setSelectedRelationshipFixes([]);
    setHasUnscannedChanges(true);
  }

  async function scanForIssues() {
    if (isScanning) return;
    const scanStartedAt = performance.now();
    const controller = new AbortController();
    scanAbortRef.current = controller;
    setIsScanning(true);
    setScanProgress(0);
    try {
    playSound("scan");
    await new Promise((resolve) => window.requestAnimationFrame(() => window.setTimeout(resolve, 30)));

    const visibleScanWeight = activeChallenge ? 0.45 : 1;
    const nextIssues = await validateRowsInChunks(rows, visibleColumnRules, {
      signal: controller.signal,
      onProgress: (progress) => setScanProgress(progress * visibleScanWeight),
    });
    const scannedAt = new Date();
    let nextEvaluation = null;
    let nextRunStats = runStats;
    let shouldCelebrate = false;
    let scanFeedback = null;
    if (activeChallenge) {
      const allRules = Object.fromEntries(columns.map((column) => [
        column,
        resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary),
      ]));
      const everyColumnVisible = columns.length === visibleColumns.length
        && columns.every((column) => visibleColumns.includes(column));
      const allIssues = everyColumnVisible
        ? nextIssues
        : await validateRowsInChunks(rows, allRules, {
            signal: controller.signal,
            onProgress: (progress) => setScanProgress(0.45 + progress * 0.3),
          });
      nextEvaluation = await evaluateChallengeInChunks(activeChallenge, {
        rows,
        columns,
        columnRules: allRules,
        scanIssues: allIssues,
        lastScannedAt: scannedAt,
        history: history.past,
        dataBin,
        relationshipRules,
      }, {
        signal: controller.signal,
        onProgress: (progress) => setScanProgress(0.75 + progress * 0.23),
      });
      const previousCompleted = new Set(runStats.completedObjectiveIds);
      const completedObjectiveIds = nextEvaluation.objectives.filter((objective) => objective.complete).map((objective) => objective.id);
      const newlyCompleted = completedObjectiveIds.filter((objectiveId) => !previousCompleted.has(objectiveId));
      nextRunStats = {
        ...runStats,
        scans: runStats.scans + 1,
        maxCombo: Math.max(runStats.maxCombo, newlyCompleted.length),
        completedObjectiveIds,
      };
      const nextScore = calculateChallengeScore(activeChallenge, nextEvaluation, nextRunStats);
      let nextProgress = gameProgress;
      shouldCelebrate = nextEvaluation.complete && !challengeEvaluation?.complete;
      scanFeedback = createScanFeedback({
        issueCount: nextIssues.length,
        objectiveIds: newlyCompleted,
        objectiveTitles: newlyCompleted.map((objectiveId) => (
          nextEvaluation.objectives.find((objective) => objective.id === objectiveId)?.title
        )).filter(Boolean),
        complete: shouldCelebrate,
        challenge: true,
      });
      if (shouldCelebrate) nextProgress = recordChallengeResult(nextProgress, activeChallenge, nextScore);
      if (shouldCelebrate && !isBootComplete(gameProgress) && isBootComplete(nextProgress)) {
        setCampaignPowerSequenceSignal((current) => current + 1);
      }
      const achievementResult = findNewAchievements(nextProgress, {
        challenge: activeChallenge,
        evaluation: nextEvaluation,
        runStats: nextRunStats,
        score: nextScore,
        columnRules: allRules,
      });
      nextProgress = achievementResult.progress;
      if (nextProgress !== gameProgress) setGameProgress(nextProgress);
      if (achievementResult.earned.length) {
        setAchievementQueue((current) => [...current, ...achievementResult.earned]);
        if (achievementResult.earned.some((achievement) => achievement.id === "hell-survivor")) {
          setHellContainmentSignal((current) => current + 1);
        }
      }
      if (shouldCelebrate) {
        playSound("victory");
        setClipbitReaction({ message: activeChallenge.assistant?.win ?? "The file is clean and I will be taking partial credit", mood: "happy" });
        postOfficeMessage(activeChallenge, "win", {}, { open: false });
      } else if (newlyCompleted.length >= 2) {
        playSound("combo");
        setClipbitReaction({ message: `CLEAN COMBO x${newlyCompleted.length} and the dataset appears visibly frightened`, mood: "happy" });
        postOfficeMessage(activeChallenge, "progress", {
          objective: `${newlyCompleted.length} objectives`,
          issues: nextIssues.length.toLocaleString(),
          issueLabel: formatIssueLabel(nextIssues.length),
        }, { open: false });
      } else if (newlyCompleted.length === 1) {
        playSound("objective");
        const objective = nextEvaluation.objectives.find((item) => item.id === newlyCompleted[0]);
        setClipbitReaction({ message: `${objective?.title ?? "Objective"} is done and I absolutely expected that`, mood: "smug" });
        postOfficeMessage(activeChallenge, "progress", {
          objective: objective?.title ?? "That objective",
          issues: nextIssues.length.toLocaleString(),
          issueLabel: formatIssueLabel(nextIssues.length),
        }, { open: false });
      } else {
        setClipbitReaction({
          message: activeChallenge.assistant?.noProgress ?? "The scan completed and the mess remains impressively committed",
          mood: nextIssues.length ? "worried" : "idle",
        });
        postOfficeMessage(activeChallenge, nextIssues.length ? "trouble" : "cleanScan", {
          issues: nextIssues.length.toLocaleString(),
          issueLabel: formatIssueLabel(nextIssues.length),
        }, { open: false });
      }
    } else {
      scanFeedback = createScanFeedback({ issueCount: nextIssues.length });
    }

    const remainingDelay = Math.max(0, 650 - (performance.now() - scanStartedAt));
    if (remainingDelay) await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
    setValidationIssues(nextIssues);
    setLastScannedAt(scannedAt);
    setHasUnscannedChanges(false);
    setIsValidationPanelOpen(false);
    if (activeChallenge) {
      setRunStats(nextRunStats);
      setChallengeEvaluation(nextEvaluation);
      if (shouldCelebrate) startChallengeCelebration();
      else cancelChallengeCelebration();
    }
    if (scanFeedback) dispatchFeedback({ type: "enqueue", event: scanFeedback });
    } catch (error) {
      if (error?.name !== "AbortError") throw error;
    } finally {
      scanAbortRef.current = null;
      setIsScanning(false);
      setScanProgress(0);
    }
  }

  function cancelScan() {
    scanAbortRef.current?.abort();
  }

  function startChallengeCelebration() {
    cancelChallengeCelebration();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsChallengeResultOpen(true);
      return;
    }
    setIsChallengeResultOpen(false);
    setIsChallengeCelebrating(true);
    challengeResultTimeoutRef.current = window.setTimeout(() => {
      challengeResultTimeoutRef.current = null;
      setIsChallengeCelebrating(false);
      setIsChallengeResultOpen(true);
    }, 1000);
  }

  function cancelChallengeCelebration() {
    if (challengeResultTimeoutRef.current) {
      window.clearTimeout(challengeResultTimeoutRef.current);
      challengeResultTimeoutRef.current = null;
    }
    setIsChallengeCelebrating(false);
  }

  function deleteRowsWithValidationIssues() {
    if (!validationIssueRowCount) return;
    requestConfirmation({
      title: "Move rows with issues to Data Bin?",
      message: `Move ${validationIssueRowCount.toLocaleString()} row${validationIssueRowCount === 1 ? "" : "s"} with validation issues out of the active table? You can restore them later`,
      confirmLabel: "Move to Data Bin",
      tone: "danger",
      onConfirm: performDeleteRowsWithValidationIssues,
    });
  }

  function performDeleteRowsWithValidationIssues() {
    const issueRowIds = new Set(validationIssues.map((issue) => issue.rowId).filter(Boolean));
    const rowIds = rows
      .filter((row, index) => issueRowIds.size ? issueRowIds.has(row.__rowId) : validationIssues.some((issue) => issue.row - 1 === index))
      .map((row) => row.__rowId);
    commitRowsToDataBin(rowIds, {
      label: "Move rows with issues to Data Bin",
      reason: `Failed the latest scan in ${visibleColumns.join(", ")}`,
      sourceAction: "validation issues",
      audit: { type: "moveInvalidRowsToBin", columns: [...visibleColumns], rules: snapshotColumnRules(visibleColumns) },
    });
    setValidationIssues([]);
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setIsValidationPanelOpen(false);
    setShowIssueRowsOnly(false);
    setHasUnscannedChanges(true);
  }

  function changeFillColumn(column) {
    setFillDraft((currentDraft) => ({
      ...currentDraft,
      column,
      method: "custom",
      groupBy: "",
      orderBy: "",
      orderDirection: "asc",
    }));
  }

  function buildCurrentFillPlan(collectChanges = false) {
    if (fillDraft.column === ALL_ISSUE_COLUMNS) {
      const columnOptions = fillIssueColumns.map((column) => {
        const rule = resolveColumnRule(columnRules[column] ?? createColumnRule("Text"), regexRuleLibrary);
        return {
          column,
          isValid: (value) => validateValue(value, rule).valid,
          isMissing: (value) => isMissingValue(value, rule),
          isIgnoredMissing: (value, row) => isMissingValue(value, rule) && !getMissingIssue(row, column, rule),
        };
      });
      return calculateMultiColumnCustomFill(rows, columnOptions, fillDraft, collectChanges);
    }
    const rule = resolveColumnRule(columnRules[fillDraft.column] ?? createColumnRule("Text"), regexRuleLibrary);
    return calculateColumnFill(rows, {
      ...fillDraft,
      customValue: getFillReplacementValue(fillDraft, rule),
      type: rule.type,
      isValid: (value) => validateValue(value, rule).valid,
      isMissing: (value) => isMissingValue(value, rule),
      isIgnoredMissing: (value, row) => isMissingValue(value, rule) && !getMissingIssue(row, fillDraft.column, rule),
    }, collectChanges);
  }

  function applyFillPlan(confirmedEstimate = false) {
    const plan = buildCurrentFillPlan(true);
    if (!plan.valid || !plan.changes?.length) return;
    const methodLabel = fillMethods.find((method) => method.id === fillDraft.method)?.label ?? "Fill values";
    if (!confirmedEstimate && !["custom", "customDate"].includes(fillDraft.method)) {
      requestConfirmation({
        title: `Apply ${methodLabel}?`,
        message: `This will estimate ${plan.changes.length.toLocaleString()} value${plan.changes.length === 1 ? "" : "s"} from other rows. Continue only when this method fits the data`,
        confirmLabel: "Apply estimate",
        tone: "default",
        onConfirm: () => applyFillPlan(true),
      });
      return;
    }
    setRows((currentRows) => applyCellChanges(currentRows, plan.changes, "redo"));
    pushHistory({
      label: `${methodLabel}: ${fillDraft.column === ALL_ISSUE_COLUMNS ? "all issue columns" : fillDraft.column}`,
      kind: "cells",
      changes: plan.changes,
      audit: {
        type: "fill",
        columns: fillDraft.column === ALL_ISSUE_COLUMNS ? [...fillIssueColumns] : [fillDraft.column],
        scope: fillDraft.scope,
        method: fillDraft.method,
        customValue: effectiveFillCustomValue,
        groupBy: fillDraft.groupBy,
        orderBy: fillDraft.orderBy,
        orderDirection: fillDraft.orderDirection,
        rules: snapshotColumnRules(fillDraft.column === ALL_ISSUE_COLUMNS ? fillIssueColumns : [fillDraft.column]),
      },
    });
    setActiveCleaningTool("home");
    setIsCleaningToolsOpen(false);
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
    if (conversionChanges.length) pushHistory({
      label: `Convert ${selectedColumn}`,
      kind: "compound",
      actions: [
        { kind: "cells", changes: conversionChanges },
        { kind: "config", before: { columnRules, relationshipRules }, after: { columnRules: nextColumnRules, relationshipRules } },
      ],
      audit: { type: "numericConversion", column: selectedColumn, targetType },
    });
    setColumnRules(nextColumnRules);
    setValidationIssues(validateRows(nextVisibleRows, nextVisibleColumnRules));
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setLastScannedAt(new Date());
    setColumnConversionNotice(`${convertedCount.toLocaleString()} values converted${skippedCount ? `; ${skippedCount.toLocaleString()} invalid values skipped` : ""}.`);
    setHasUnscannedChanges(false);
  }

  function convertSelectedDateColumn() {
    if (!selectedColumn || !selectedDateTargetPreset) return;
    const sourcePreset = getPreset(dateConversionSourcePresetId);
    requestConfirmation({
      title: `Change ${selectedColumn} date format?`,
      message: `Change dates in "${selectedColumn}" from ${sourcePreset.name} to ${selectedDateTargetPreset.name}? Dates already using ${selectedDateTargetPreset.name} stay untouched and empty or invalid values will be skipped.`,
      confirmLabel: "Change date format",
      tone: "default",
      onConfirm: performDateColumnConversion,
    });
  }

  function performDateColumnConversion() {
    if (!selectedColumn || !selectedDateTargetPreset) return;
    const plan = buildDateConversionChanges(
      rows,
      selectedColumn,
      dateConversionSourcePresetId,
      selectedDateTargetPreset.id,
    );
    if (!plan.valid) {
      setColumnConversionNotice(plan.error);
      return;
    }

    const nextRows = applyCellChanges(rows, plan.changes, "redo");
    const nextVisibleRows = nextRows.map((row) => pickColumns(row, visibleColumns));
    if (plan.changes.length) {
      setRows(nextRows);
      pushHistory({
        label: `Change ${selectedColumn} date format`,
        kind: "cells",
        changes: plan.changes,
        audit: {
          type: "dateConversion",
          column: selectedColumn,
          sourcePresetId: dateConversionSourcePresetId,
          targetPresetId: selectedDateTargetPreset.id,
        },
      });
    }
    setValidationIssues(validateRows(nextVisibleRows, visibleColumnRules));
    setRelationshipIssues([]);
    setSelectedRelationshipFixes([]);
    setLastScannedAt(new Date());
    setColumnConversionNotice(
      `${plan.changeCount.toLocaleString()} date${plan.changeCount === 1 ? "" : "s"} changed`
      + `${plan.skippedCount ? ` and ${plan.skippedCount.toLocaleString()} invalid value${plan.skippedCount === 1 ? "" : "s"} skipped` : ""}`,
    );
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

  function exportCsv() {
    const exportRows = rows.map((row) => {
      const { __rowId: _rowId, ...visibleRow } = pickColumns(row, visibleColumns);
      return visibleRow;
    });
    const csv = Papa.unparse(exportRows);
    downloadCsv(csv, "cleansheet_export.csv");
  }

  function exportIssuesCsv() {
    const csv = Papa.unparse(validationIssues.map(({ rowId: _rowId, ...issue }) => issue));
    downloadCsv(csv, "cleansheet_validation_issues.csv");
  }

  function exportDataBinCsv() {
    if (!dataBin.length) return;
    const csv = Papa.unparse(createDataBinExportRows(dataBin));
    downloadCsv(csv, "cleansheet_data_bin.csv");
  }

  function downloadCsv(csv, outputFileName) {
    downloadText(csv, outputFileName, "text/csv;charset=utf-8");
  }

  function downloadText(text, outputFileName, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = outputFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderCleaningTools() {
    return (
      <div className="rule-builder-backdrop" onMouseDown={() => setIsCleaningToolsOpen(false)}>
        <section className="cleaning-tools-dialog" role="dialog" aria-modal="true" aria-labelledby="cleaning-tools-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="rule-builder-heading cleaning-tools-heading">
            <div>
              <span className="section-label">Cleaning workspace</span>
              <h2 id="cleaning-tools-title">{getCleaningTool(activeCleaningTool).title}</h2>
              <p>{getCleaningTool(activeCleaningTool).description}</p>
            </div>
            <div className="cleaning-tools-heading-actions">
              {activeCleaningTool !== "home" && <button type="button" className="dialog-close" onClick={() => setActiveCleaningTool("home")}>All tools</button>}
              <button type="button" className="dialog-close" onClick={() => setIsCleaningToolsOpen(false)}>Close</button>
            </div>
          </div>
          {renderCleaningToolContent()}
        </section>
      </div>
    );
  }

  function renderCleaningToolContent() {
    if (activeCleaningTool === "home") {
      return (
        <div className="cleaning-tool-home">
          <div className="tool-access-summary">
            <strong>{cleaningToolAccess.unlockedIds.length}/{CLEANING_TOOLS.length} tools online</strong>
            <span>
              {activeChallenge
                ? "This level switches on what it needs and completed levels keep their tools unlocked"
                : "Free Clean keeps every tool unlocked"}
            </span>
          </div>
          {toolLockNotice && <div className="tool-lock-notice" role="status">{toolLockNotice}</div>}
          <div className="cleaning-tool-grid">
            {CLEANING_TOOLS.map((tool) => {
              const locked = !isCleaningToolUnlocked(cleaningToolAccess, tool.id);
              return (
                <ToolCard
                  key={tool.id}
                  title={tool.cardTitle ?? tool.title}
                  description={locked ? tool.lockedDescription ?? "A challenge that needs this tool will switch it on" : tool.cardDescription}
                  onClick={() => openCleaningTools(tool.id)}
                  locked={locked}
                  badge={locked
                    ? "LOCKED"
                    : tool.id === "dataBin"
                      ? `${dataBin.length.toLocaleString()} ROWS`
                    : tool.id === "fillIssues"
                      ? hasUnscannedChanges
                        ? "SCAN AGAIN"
                        : lastScannedAt
                          ? `${validationIssues.length.toLocaleString()} ISSUES`
                          : "SCAN FIRST"
                      : ""}
                  disabled={!locked && (
                    tool.availability === "issues"
                      ? !fillIssueColumns.length || hasUnscannedChanges
                      : tool.availability === "visibleColumns"
                      ? !visibleColumns.length
                      : tool.availability === "columns" && !columns.length
                  )}
                />
              );
            })}
          </div>
        </div>
      );
    }

    if (activeCleaningTool === "fillIssues") return renderFillIssuesTool();

    if (activeCleaningTool === "missingValues") {
      const condition = missingRuleDraft.missingCondition ?? DEFAULT_MISSING_CONDITION;
      return (
        <>
          <div className="cleaning-tool-body">
            <label>
              <span>Column</span>
              <select value={missingRuleDraft.column} onChange={(event) => changeMissingRuleColumn(event.target.value)}>
                {columns.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
            <section className="missing-rule-card">
              <div>
                <span className="field-label">Missing values</span>
                <p>Choose when an empty cell or null marker should count as a problem.</p>
              </div>
              <label>
                <span>Policy</span>
                <select value={missingRuleDraft.missingPolicy} onChange={(event) => updateMissingRuleDraft("missingPolicy", event.target.value)}>
                  <option value="required">Required</option>
                  <option value="allowed">Allowed</option>
                  <option value="conditional">Required when...</option>
                </select>
              </label>
              {missingRuleDraft.missingPolicy === "conditional" && (
                <div className="missing-condition-grid">
                  <label>
                    <span>Other column</span>
                    <select
                      value={condition.column}
                      onChange={(event) => updateMissingRuleDraft("missingCondition", { ...condition, column: event.target.value })}
                    >
                      <option value="">Choose a column</option>
                      {columns.filter((column) => column !== missingRuleDraft.column).map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Condition</span>
                    <select
                      value={condition.operator}
                      onChange={(event) => updateMissingRuleDraft("missingCondition", { ...condition, operator: event.target.value })}
                    >
                      <option value="equals">Equals</option>
                      <option value="notEquals">Does not equal</option>
                      <option value="isEmpty">Is empty</option>
                      <option value="isNotEmpty">Is not empty</option>
                    </select>
                  </label>
                  {!["isEmpty", "isNotEmpty"].includes(condition.operator) && (
                    <label>
                      <span>Value</span>
                      <input
                        value={condition.value}
                        onChange={(event) => updateMissingRuleDraft("missingCondition", { ...condition, value: event.target.value })}
                        placeholder="Active"
                      />
                    </label>
                  )}
                </div>
              )}
              <label>
                <span>Also treat these as missing</span>
                <input
                  value={missingRuleDraft.missingTokensInput}
                  onChange={(event) => {
                    const missingTokensInput = event.target.value;
                    setMissingRuleDraft((draft) => ({ ...draft, missingTokensInput, missingTokens: parseMissingTokens(missingTokensInput) }));
                    setMissingRuleNotice("");
                  }}
                  placeholder="NULL, N/A, ?, -"
                />
              </label>
              <ToolCheck
                checked={missingRuleDraft.missingTokenCaseSensitive}
                onChange={() => updateMissingRuleDraft("missingTokenCaseSensitive", !missingRuleDraft.missingTokenCaseSensitive)}
                label="Null markers are case-sensitive"
              />
              {!missingToolState.valid && <div className="regex-state error">{missingToolState.error}</div>}
            </section>
            {missingRuleNotice && <div className="tool-message">{missingRuleNotice}</div>}
          </div>
          <ToolActions
            onCancel={() => { setActiveCleaningTool("home"); setMissingRuleNotice(""); }}
            onApply={saveMissingRuleDraft}
            applyLabel="Save settings"
            disabled={!missingToolState.valid}
          />
        </>
      );
    }

    if (activeCleaningTool === "findReplace") {
      return (
        <>
          <div className="cleaning-tool-body">
            <label><span>Mode</span><select value={findReplaceDraft.mode} onChange={(event) => setFindReplaceDraft((draft) => ({ ...draft, mode: event.target.value }))}><option value="exact">Exact match</option><option value="contains">Contains text</option><option value="regex">Regex</option></select></label>
            <label><span>Find</span><input value={findReplaceDraft.find} onChange={(event) => setFindReplaceDraft((draft) => ({ ...draft, find: event.target.value }))} placeholder={findReplaceDraft.mode === "regex" ? "\\bN/?A\\b" : "N/A"} /></label>
            <label><span>Replace with</span><input value={findReplaceDraft.replace} onChange={(event) => setFindReplaceDraft((draft) => ({ ...draft, replace: event.target.value }))} placeholder="Leave empty to clear" /></label>
            {findReplaceDraft.mode !== "regex" && <ToolCheck checked={findReplaceDraft.caseSensitive} onChange={() => setFindReplaceDraft((draft) => ({ ...draft, caseSensitive: !draft.caseSensitive }))} label="Case sensitive" />}
            <ToolPreview valid={findReplacePreview.valid} error={findReplacePreview.error} summary={`${findReplacePreview.count.toLocaleString()} values will change`}>
              {findReplacePreview.examples.map((item, index) => <div key={`${item.column}-${index}`}><code>{item.column}</code> {item.before} → {item.after || "(empty)"}</div>)}
            </ToolPreview>
          </div>
          <ToolActions onCancel={() => setActiveCleaningTool("home")} onApply={applyFindReplace} applyLabel="Apply replacements" disabled={!findReplacePreview.valid || !findReplacePreview.count} />
        </>
      );
    }

    if (activeCleaningTool === "duplicates") {
      return (
        <>
          <div className="cleaning-tool-body">
            <ColumnPicker columns={columns} selected={duplicateDraft.columns} onToggle={(column) => toggleToolColumn(setDuplicateDraft, "columns", column)} onSelectAll={() => setDuplicateDraft((draft) => ({ ...draft, columns: [...columns] }))} onSelectVisible={() => setDuplicateDraft((draft) => ({ ...draft, columns: [...visibleColumns] }))} label="Compare columns" />
            <div className="tool-option-grid">
              <ToolCheck checked={duplicateDraft.trimValues} onChange={() => setDuplicateDraft((draft) => ({ ...draft, trimValues: !draft.trimValues }))} label="Ignore outer spaces" />
              <ToolCheck checked={duplicateDraft.ignoreCase} onChange={() => setDuplicateDraft((draft) => ({ ...draft, ignoreCase: !draft.ignoreCase }))} label="Ignore capitalization" />
            </div>
            <label><span>When duplicates are found</span><select value={duplicateDraft.keep} onChange={(event) => setDuplicateDraft((draft) => ({ ...draft, keep: event.target.value }))}><option value="first">Keep the first row</option><option value="last">Keep the last row</option><option value="all">Move every copy to the Data Bin</option></select></label>
            <ToolPreview valid={duplicatePreview.valid} error={duplicatePreview.error} summary={`${duplicatePreview.deleteCount.toLocaleString()} rows will move to the Data Bin from ${duplicatePreview.groupCount.toLocaleString()} groups`}>
              {duplicatePreview.examples.map((item, index) => <div key={index}><code>{item.values.join(" | ") || "(empty)"}</code> appears {item.count.toLocaleString()} times</div>)}
            </ToolPreview>
          </div>
          <ToolActions onCancel={() => setActiveCleaningTool("home")} onApply={applyDuplicateRemoval} applyLabel="Move duplicates" disabled={!duplicatePreview.valid || !duplicatePreview.deleteCount} danger />
        </>
      );
    }

    if (activeCleaningTool === "textCleanup") {
      return (
        <>
          <div className="cleaning-tool-body">
            <ColumnPicker columns={columns} selected={textCleanupDraft.columns} onToggle={(column) => toggleToolColumn(setTextCleanupDraft, "columns", column)} onSelectAll={() => setTextCleanupDraft((draft) => ({ ...draft, columns: [...columns] }))} onSelectVisible={() => setTextCleanupDraft((draft) => ({ ...draft, columns: [...visibleColumns] }))} label="Clean columns" />
            <div className="tool-option-grid">
              <ToolCheck checked={textCleanupDraft.trimEdges} onChange={() => setTextCleanupDraft((draft) => ({ ...draft, trimEdges: !draft.trimEdges }))} label="Trim outer spaces" />
              <ToolCheck checked={textCleanupDraft.collapseWhitespace} onChange={() => setTextCleanupDraft((draft) => ({ ...draft, collapseWhitespace: !draft.collapseWhitespace }))} label="Collapse repeated spaces" />
            </div>
            <label><span>Capitalization</span><select value={textCleanupDraft.caseMode} onChange={(event) => setTextCleanupDraft((draft) => ({ ...draft, caseMode: event.target.value }))}><option value="keep">Keep as written</option><option value="lower">lowercase</option><option value="upper">UPPERCASE</option><option value="title">Title Case</option></select></label>
            <ToolPreview valid={textCleanupPreview.valid} error={textCleanupPreview.error} summary={`${textCleanupPreview.changeCount.toLocaleString()} cells will change`}>
              {textCleanupPreview.examples.map((item, index) => <div key={`${item.column}-${index}`}><code>{item.column}</code> {item.before || "(empty)"} → {item.after || "(empty)"}</div>)}
            </ToolPreview>
          </div>
          <ToolActions onCancel={() => setActiveCleaningTool("home")} onApply={applyTextCleanup} applyLabel="Apply cleanup" disabled={!textCleanupPreview.valid || !textCleanupPreview.changeCount} />
        </>
      );
    }

    if (activeCleaningTool === "manageColumns") return renderManageColumnsTool();
    if (activeCleaningTool === "dataBin") return renderDataBinTool();
    return null;
  }

  function renderFillIssuesTool() {
    return (
      <>
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

          {selectedFillMethod?.usesCustomValue && (
            <label className="fill-field">
              <span>{fillDraft.method === "customDate" ? "Replacement date" : "Replacement value"}</span>
              <input
                type={fillDraft.method === "customDate" ? "date" : "text"}
                value={fillDraft.method === "customDate" ? fillDraft.customDate : fillDraft.customValue}
                onChange={(event) => setFillDraft((draft) => (
                  fillDraft.method === "customDate"
                    ? { ...draft, customDate: event.target.value }
                    : { ...draft, customValue: event.target.value }
                ))}
                placeholder={fillDraft.method === "customDate" ? "" : "NaN, unknown, or leave empty"}
              />
            </label>
          )}
          {selectedFillMethod?.supportsGrouping && (
            <label className="fill-field">
              <span>Calculate within groups (optional)</span>
              <select value={fillDraft.groupBy} onChange={(event) => setFillDraft((draft) => ({ ...draft, groupBy: event.target.value }))}>
                <option value="">Use the whole column</option>
                {columns.filter((column) => column !== fillDraft.column).map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
          )}
          {selectedFillMethod?.requiresOrder && (
            <div className="fill-order-fields">
              <label className="fill-field">
                <span>Order by</span>
                <select value={fillDraft.orderBy} onChange={(event) => setFillDraft((draft) => ({ ...draft, orderBy: event.target.value }))}>
                  <option value="">Choose a column</option>
                  {columns.filter((column) => column !== fillDraft.column).map((column) => <option key={column} value={column}>{column}</option>)}
                </select>
              </label>
              <label className="fill-field">
                <span>Direction</span>
                <select value={fillDraft.orderDirection} onChange={(event) => setFillDraft((draft) => ({ ...draft, orderDirection: event.target.value }))}>
                  <option value="asc">Smallest / earliest first</option>
                  <option value="desc">Largest / latest first</option>
                </select>
              </label>
            </div>
          )}
          {selectedFillMethod?.warning && (
            <div className="fill-method-caution">
              <strong>Simulation only</strong>
              <span>This keeps the column proportions, but the value assigned to each row is invented.</span>
            </div>
          )}
          {estimatedFillWarning && <div className="fill-warning estimate-warning">{estimatedFillWarning}</div>}
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

        <ToolActions
          onCancel={() => setActiveCleaningTool("home")}
          onApply={() => applyFillPlan()}
          applyLabel="Apply fill"
          disabled={isFillPreviewPending || !fillPreview.valid || !fillPreview.changeCount}
        />
      </>
    );
  }

  function renderManageColumnsTool() {
    const operation = columnOperationMode === "split" ? splitDraft : combineDraft;
    const preview = columnOperationMode === "split" ? splitPreview : combinePreview;
    const operationValidation = validateSchemaOperation(columns, operation);
    const createOperation = { ...createColumnDraft, column: createColumnDraft.column.trim() };
    const createSchemaValidation = validateSchemaOperation(columns, createOperation);
    const createValueValidation = validateCreateColumnValue(createOperation);
    const createValidation = createSchemaValidation.valid ? createValueValidation : createSchemaValidation;
    const deleteOperation = { ...deleteColumnsDraft, columns: [...deleteColumnsDraft.columns] };
    const deleteValidation = validateSchemaOperation(columns, deleteOperation);
    const deletedColumnSet = new Set(deleteOperation.columns);
    const deletedRelationships = relationshipRules.filter((rule) => (
      getRelationshipRuleColumns(rule).some((column) => deletedColumnSet.has(column))
    ));
    return (
      <>
        <div className="tool-mode-switch manage-column-mode-switch">
          <button type="button" className={columnOperationMode === "create" ? "selected" : ""} onClick={() => setColumnOperationMode("create")}>Create</button>
          <button type="button" className={columnOperationMode === "delete" ? "selected" : ""} onClick={() => setColumnOperationMode("delete")}>Delete</button>
          <button type="button" className={columnOperationMode === "split" ? "selected" : ""} onClick={() => setColumnOperationMode("split")}>Split</button>
          <button type="button" className={columnOperationMode === "combine" ? "selected" : ""} onClick={() => setColumnOperationMode("combine")}>Combine</button>
        </div>
        {columnOperationMode === "create" ? (
          <div className="cleaning-tool-body">
            <label>
              <span>Column name</span>
              <input value={createColumnDraft.column} onChange={(event) => setCreateColumnDraft((draft) => ({ ...draft, column: event.target.value }))} placeholder="New column" />
            </label>
            <label>
              <span>Column type</span>
              <select value={createColumnDraft.dataType} onChange={(event) => setCreateColumnDraft((draft) => ({ ...draft, dataType: event.target.value }))}>
                {TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Starting values</span>
              <select value={createColumnDraft.initialMode} onChange={(event) => setCreateColumnDraft((draft) => ({ ...draft, initialMode: event.target.value }))}>
                <option value="empty">Leave every row empty</option>
                <option value="fixed">Use one value for every row</option>
              </select>
            </label>
            {createColumnDraft.initialMode === "fixed" && (
              <label>
                <span>Starting value</span>
                <input value={createColumnDraft.initialValue} onChange={(event) => setCreateColumnDraft((draft) => ({ ...draft, initialValue: event.target.value }))} placeholder={`Value matching ${createColumnDraft.dataType}`} />
              </label>
            )}
            <ToolPreview
              valid={createValidation.valid}
              error={createValidation.error}
              summary={`"${createOperation.column}" will be added after ${columns.at(-1) ?? "the current columns"}`}
            >
              <div>{rows.length.toLocaleString()} rows will start {createOperation.initialMode === "fixed" ? `with "${createOperation.initialValue}"` : "empty"}</div>
            </ToolPreview>
            <ToolActions onCancel={() => setActiveCleaningTool("home")} onApply={applyCreateColumn} applyLabel="Create column" disabled={!createValidation.valid} />
          </div>
        ) : columnOperationMode === "delete" ? (
          <div className="cleaning-tool-body">
            <ColumnPicker
              columns={columns}
              selected={deleteColumnsDraft.columns}
              onToggle={(column) => toggleToolColumn(setDeleteColumnsDraft, "columns", column)}
              onSelectAll={() => setDeleteColumnsDraft((draft) => ({ ...draft, columns: [...columns] }))}
              onSelectVisible={() => setDeleteColumnsDraft((draft) => ({ ...draft, columns: [...visibleColumns] }))}
              label="Columns to delete"
            />
            <ToolPreview
              valid={deleteValidation.valid}
              error={deleteValidation.error}
              summary={`${deleteColumnsDraft.columns.length.toLocaleString()} column${deleteColumnsDraft.columns.length === 1 ? "" : "s"} will be deleted`}
            >
              <div>{rows.length.toLocaleString()} rows will change</div>
              {deletedRelationships.length > 0 && (
                <div>{deletedRelationships.length.toLocaleString()} connected relation{deletedRelationships.length === 1 ? "" : "s"} will also be removed</div>
              )}
            </ToolPreview>
            <ToolActions onCancel={() => setActiveCleaningTool("home")} onApply={applyDeleteColumns} applyLabel="Delete columns" disabled={!deleteValidation.valid} danger />
          </div>
        ) : columnOperationMode === "split" ? (
          <div className="cleaning-tool-body">
            <label><span>Source column</span><select value={splitDraft.sourceColumn} onChange={(event) => setSplitDraft((draft) => ({ ...draft, sourceColumn: event.target.value, outputColumns: [`${event.target.value} 1`, `${event.target.value} 2`] }))}><option value="">Choose a column</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
            <label><span>Split using</span><select value={splitDraft.separatorMode} onChange={(event) => setSplitDraft((draft) => ({ ...draft, separatorMode: event.target.value }))}><option value="whitespace">Spaces</option><option value="comma">Comma</option><option value="hyphen">Hyphen</option><option value="slash">Slash</option><option value="custom">Custom separator</option></select></label>
            {splitDraft.separatorMode === "custom" && <label><span>Custom separator</span><input value={splitDraft.customSeparator} onChange={(event) => setSplitDraft((draft) => ({ ...draft, customSeparator: event.target.value }))} /></label>}
            <fieldset className="tool-fieldset">
              <legend>Output columns</legend>
              {splitDraft.outputColumns.map((column, index) => (
                <div className="output-column-row" key={index}>
                  <input value={column} onChange={(event) => setSplitDraft((draft) => ({ ...draft, outputColumns: draft.outputColumns.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
                  <button type="button" className="secondary-button" onClick={() => setSplitDraft((draft) => ({ ...draft, outputColumns: draft.outputColumns.filter((_, itemIndex) => itemIndex !== index) }))} disabled={splitDraft.outputColumns.length <= 2}>Remove</button>
                </div>
              ))}
              <button type="button" className="secondary-button" onClick={() => setSplitDraft((draft) => ({ ...draft, outputColumns: [...draft.outputColumns, `Part ${draft.outputColumns.length + 1}`] }))}>Add output column</button>
            </fieldset>
            <ToolCheck checked={splitDraft.removeSources} onChange={() => setSplitDraft((draft) => ({ ...draft, removeSources: !draft.removeSources }))} label="Remove the source column after splitting" />
            <ToolPreview valid={preview.valid && operationValidation.valid} error={preview.error || operationValidation.error} summary={`${preview.changedRowCount.toLocaleString()} rows will be split`}>
              {preview.examples.map((item, index) => <div key={index}><code>{item.before || "(empty)"}</code> → {item.outputs.join(" | ")}</div>)}
            </ToolPreview>
            <ToolActions onCancel={() => setActiveCleaningTool("home")} onApply={applySplitColumns} applyLabel="Split column" disabled={!preview.valid || !operationValidation.valid} />
          </div>
        ) : (
          <div className="cleaning-tool-body">
            <ColumnPicker columns={columns} selected={combineDraft.sourceColumns} onToggle={(column) => toggleToolColumn(setCombineDraft, "sourceColumns", column)} label="Source columns" />
            {!!combineDraft.sourceColumns.length && (
              <div className="ordered-column-list">
                {combineDraft.sourceColumns.map((column, index) => (
                  <div key={column}>
                    <span>{index + 1}. {column}</span>
                    <div><button type="button" className="secondary-button" disabled={index === 0} onClick={() => setCombineDraft((draft) => ({ ...draft, sourceColumns: moveArrayItem(draft.sourceColumns, index, -1) }))}>Up</button><button type="button" className="secondary-button" disabled={index === combineDraft.sourceColumns.length - 1} onClick={() => setCombineDraft((draft) => ({ ...draft, sourceColumns: moveArrayItem(draft.sourceColumns, index, 1) }))}>Down</button></div>
                  </div>
                ))}
              </div>
            )}
            <label><span>Output column</span><input value={combineDraft.outputColumn} onChange={(event) => setCombineDraft((draft) => ({ ...draft, outputColumn: event.target.value }))} /></label>
            <label><span>Join using</span><select value={combineDraft.separatorMode} onChange={(event) => setCombineDraft((draft) => ({ ...draft, separatorMode: event.target.value }))}><option value="space">Space</option><option value="comma">Comma and space</option><option value="hyphen">Hyphen</option><option value="slash">Slash</option><option value="none">No separator</option><option value="custom">Custom separator</option></select></label>
            {combineDraft.separatorMode === "custom" && <label><span>Custom separator</span><input value={combineDraft.customSeparator} onChange={(event) => setCombineDraft((draft) => ({ ...draft, customSeparator: event.target.value }))} /></label>}
            <div className="tool-option-grid"><ToolCheck checked={combineDraft.skipEmpty} onChange={() => setCombineDraft((draft) => ({ ...draft, skipEmpty: !draft.skipEmpty }))} label="Skip empty values" /><ToolCheck checked={combineDraft.removeSources} onChange={() => setCombineDraft((draft) => ({ ...draft, removeSources: !draft.removeSources }))} label="Remove source columns" /></div>
            <ToolPreview valid={preview.valid && operationValidation.valid} error={preview.error || operationValidation.error} summary={`${preview.changedRowCount.toLocaleString()} rows will be combined`}>
              {preview.examples.map((item, index) => <div key={index}><code>{item.values.join(" | ")}</code> → {item.after || "(empty)"}</div>)}
            </ToolPreview>
            <ToolActions onCancel={() => setActiveCleaningTool("home")} onApply={applyCombinedColumns} applyLabel="Combine columns" disabled={!preview.valid || !operationValidation.valid} />
          </div>
        )}
      </>
    );
  }

  function renderDataBinTool() {
    return (
      <div className="data-bin-workspace">
        <div className="data-bin-summary">
          <div>
            <span className="field-label">Recoverable rows</span>
            <strong>{dataBin.length.toLocaleString()} row{dataBin.length === 1 ? "" : "s"} in the Bin</strong>
            <p>These rows are outside scans and normal exports until you restore them</p>
          </div>
          <div className="data-bin-actions">
            <button type="button" onClick={() => restoreDataBinEntries(selectedBinEntryIds)} disabled={!selectedBinEntryIds.length}>Restore selected ({selectedBinEntryIds.length.toLocaleString()})</button>
            <button type="button" className="secondary-button" onClick={() => restoreDataBinEntries(dataBin.map((entry) => entry.id))} disabled={!dataBin.length}>Restore all</button>
            <button type="button" className="secondary-button" onClick={exportDataBinCsv} disabled={!dataBin.length}>Export Bin CSV</button>
          </div>
        </div>
        {dataBin.length ? (
          <div className="ag-theme-quartz data-bin-grid">
            <AgGridReact
              rowData={dataBin}
              columnDefs={dataBinGridColumns}
              defaultColDef={{ filter: true, sortable: true, resizable: true, editable: false }}
              getRowId={(params) => params.data.id}
              pagination
              paginationPageSize={100}
              rowSelection={GRID_ROW_SELECTION}
              onSelectionChanged={(event) => setSelectedBinEntryIds(event.api.getSelectedRows().map((entry) => entry.id))}
            />
          </div>
        ) : <div className="tool-empty">Nothing is in the Data Bin</div>}
      </div>
    );
  }

  return (
    <main className={`app-shell ${activeChallenge ? "challenge-workspace" : ""} ${isEffectsReduced ? "effects-reduced" : "effects-full"} ${isHellContext ? "hell-context" : ""}`}>
      <PixelSelectOverlay />
      {viewMode === "campaign" && (
        <CampaignMap
          challenges={CHALLENGES}
          progress={gameProgress}
          savedWorkspaceIds={savedWorkspaceIds}
          powerSequenceSignal={campaignPowerSequenceSignal}
          activePack={campaignPack}
          onPackChange={setCampaignPack}
          onHellTransition={handleHellTransition}
          containmentSignal={hellContainmentSignal}
          initialChallengeId={activeChallengeId}
          onContainmentComplete={() => setHellContainmentSignal(0)}
          reducedEffects={isEffectsReduced}
          onPowerSequenceComplete={() => setCampaignPowerSequenceSignal(0)}
          onStart={(challengeId) => requestChallengeStory(challengeId)}
          onContinue={(challengeId) => openChallenge(challengeId)}
          onRestart={(challengeId) => requestChallengeStory(challengeId, true)}
          onFreeClean={openFreeClean}
          onAchievements={() => setIsAchievementsOpen(true)}
          onSound={async (name) => {
            await enableGameAudio();
            playSound(name);
          }}
          onClipbitHit={async () => {
            if (isClipbitMinimized) return;
            await enableGameAudio();
            const now = Date.now();
            const recentHits = clipbitFileHitTimesRef.current
              .filter((hitAt) => now - hitAt <= CLIPBIT_FILE_RAGE_WINDOW);
            recentHits.push(now);
            clipbitFileHitTimesRef.current = recentHits;
            if (recentHits.length >= CLIPBIT_FILE_RAGE_COUNT) {
              clipbitFileHitTimesRef.current = [];
              playSound("clipbitBreak");
              setIsClipbitMinimized(false);
              setClipbitReaction({
                message: "FOUR FILES IS NOT DATA CLEANING, I QUIT",
                mood: "angry",
              });
              setClipbitBreakSignal((current) => current + 1);
              return;
            }
            playSound("clipbitHit");
            const message = CLIPBIT_FILE_HIT_REACTIONS[
              clipbitFileHitReactionRef.current % CLIPBIT_FILE_HIT_REACTIONS.length
            ];
            clipbitFileHitReactionRef.current += 1;
            setClipbitReaction({ message, mood: "alarmed" });
          }}
          soundControls={(
            <>
              <SoundControls
                settings={audioSettings}
                onMute={() => changeAudioSettings({ muted: !audioSettings.muted })}
                onVolume={(volume) => changeAudioSettings({ volume, muted: false })}
              />
              <EffectsControl mode={effectsMode} onChange={changeEffectsMode} />
            </>
          )}
        />
      )}
      <aside
        className="sidebar"
        aria-hidden={viewMode === "campaign" ? true : undefined}
        inert={viewMode === "campaign" ? "" : undefined}
      >
        <div className="brand-lockup">
          <div className="brand">CleanSheet</div>
        </div>

        <section className="control-section">
          <h2>{activeChallenge ? "Challenge file" : "Load data"}</h2>
          {!activeChallenge && (
            <>
              <button type="button" onClick={loadSample}>Load Sample Dataset</button>
              <label className="file-picker">
                Upload CSV
                <input type="file" accept=".csv" onChange={handleFileUpload} />
              </label>
            </>
          )}
          <span className="file-name">{fileName}</span>
          <button type="button" className="challenge-launch-button" onClick={showCampaign}>
            <span>Campaign Desktop</span>
            <small>{CHALLENGES.length} files waiting</small>
          </button>
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
                    <span className="column-meta">{columnRules[column]?.type ?? UNIDENTIFIED_TYPE}</span>
                  </button>
                </label>
              </div>
            ))}
          </div>
        </section>
        <section className="sidebar-effects-section">
          <span>Visual effects</span>
          <EffectsControl mode={effectsMode} onChange={changeEffectsMode} compact />
        </section>
        {!activeChallenge && (
          <section className="sidebar-clear-section">
            <button type="button" className="sidebar-clear-file" onClick={clearLoadedFile} disabled={!rows.length}>
              Clear loaded file
            </button>
          </section>
        )}
      </aside>

      <section
        className="workspace"
        aria-hidden={viewMode === "campaign" ? true : undefined}
        inert={viewMode === "campaign" ? "" : undefined}
      >
        <section className={`panel workspace-panel ${isObjectivesPortable || isInformationPortable ? "has-portable-note" : ""}`}>
          <div className="workspace-header">
            <div>
              <h1>{fileName}</h1>
              <p>Double click cells to edit. Select a column to change its type and format.</p>
              <p className="autosave-message">
                {autosaveStatus}{!activeChallenge && ". Export CSV when you want a file you can move elsewhere."}
              </p>
            </div>
            {!activeChallenge && (
              <div className="workspace-actions">
                <button type="button" onClick={scanForIssues} disabled={!canScan || isScanning}>
                  {isScanning ? "Scanning..." : "Scan Again"}
                </button>
                <button type="button" className="export-button" onClick={exportCsv} disabled={!rows.length}>
                  Export CSV
                </button>
              </div>
            )}
          </div>

          <div className="workspace-toolbar">
            <div className="toolbar-chip-group">
              <ToolbarChip label="Rows" value={rows.length.toLocaleString()} />
              <ToolbarChip label="Columns" value={visibleColumns.length.toLocaleString()} />
              <ToolbarChip label="Issues" value={validationIssues.length.toLocaleString()} tone="danger" />
            </div>
            <div className={`status-chip ${hasUnscannedChanges ? "warning" : "ok"}`}>
              {hasUnscannedChanges ? "Needs scan" : "Last change"}
              {lastScannedAt ? ` • ${lastScannedAt.toLocaleTimeString()}` : ""}
            </div>
          </div>

          {!activeChallenge?.tutorial && (
            <DataHealthMap
              rowCount={rows.length}
              columns={visibleColumns}
              issues={validationIssues}
              current={Boolean(lastScannedAt) && !hasUnscannedChanges}
              unidentifiedColumns={unidentifiedVisibleColumns}
              onIssueSelect={focusHealthIssue}
            />
          )}

          {activeChallenge && (
            <section
              ref={objectivesPanelMovement.rootRef}
              className={`challenge-objectives ${isObjectivesOpen ? "open" : ""} ${isObjectivesPortable ? "portable-note" : ""} ${objectivesPanelMovement.dragging ? "dragging" : ""}`}
              style={objectivesPanelMovement.style}
            >
              {isObjectivesPortable && (
                <div className="portable-note-handle" {...objectivesPanelMovement.handleProps}>
                  <span>Objectives note</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsObjectivesPortable(false);
                      setIsObjectivesOpen(false);
                    }}
                    aria-label="Close objectives note"
                  >
                    x
                  </button>
                </div>
              )}
              <div className="challenge-objectives-heading">
                <button type="button" className="challenge-objectives-toggle" onClick={() => setIsObjectivesOpen((open) => !open)}>
                  <span className="challenge-number">{activeChallenge.tutorial ? `Boot 0.${activeChallenge.tutorialStage}C` : `Challenge ${activeChallenge.number}`}</span>
                  <span>
                    <strong>{activeChallenge.title}</strong>
                    <small>{challengeEvaluation ? `${challengeEvaluation.completedCount}/${challengeEvaluation.totalCount} objectives` : "Scan to check your work"}</small>
                  </span>
                  <span className="challenge-stars" aria-label={`${challengeEvaluation?.stars ?? 0} stars`}>
                    {[1, 2, 3].map((star) => <span key={star} className={star <= (challengeEvaluation?.stars ?? 0) ? "earned" : ""}>*</span>)}
                  </span>
                  <span>{isObjectivesOpen ? "Hide" : "Show"}</span>
                </button>
                {!isObjectivesPortable && (
                  <button
                    type="button"
                    className="portable-note-launch"
                    onClick={() => {
                      setIsObjectivesOpen(true);
                      setIsObjectivesPortable(true);
                    }}
                  >
                    Carry note
                  </button>
                )}
                {!isObjectivesPortable && (
                  <button type="button" className="challenge-exit-button" onClick={exitChallenge}>Exit challenge</button>
                )}
              </div>
              <div className={`challenge-run-hud ${activeFeedback?.kind === "scan-error" ? "feedback-error" : ""}`}>
                {activeFeedback?.kind === "scan-error" && (
                  <span className="hud-error-fragments" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
                  </span>
                )}
                <div className="corruption-meter">
                  <div>
                    <span>DATA CORRUPTION</span>
                    <strong>{challengeEvaluation ? `${challengeScore.corruption}%` : "???"}</strong>
                  </div>
                  <div className="corruption-meter-track" aria-label={challengeEvaluation ? `${challengeScore.corruption}% data corruption remaining` : "Scan to measure data corruption"}>
                    <span style={{ width: `${challengeEvaluation ? challengeScore.corruption : 100}%` }} />
                  </div>
                </div>
                <div className="challenge-run-stats">
                  <span><small>Moves</small><strong>{runStats.moves}</strong></span>
                  <span><small>Best combo</small><strong>x{runStats.maxCombo}</strong></span>
                  <span><small>Hints</small><strong>{runStats.hintsUsed}</strong></span>
                </div>
              </div>
              {isObjectivesOpen && (
                <div className="challenge-objectives-body">
                  <p>{activeChallenge.subtitle}</p>
                  <div className="challenge-objective-list">
                    {activeChallenge.objectives.map((objective) => {
                      const result = challengeEvaluation?.objectives.find((item) => item.id === objective.id);
                      return (
                        <div
                          key={objective.id}
                          className={`${result?.complete ? "complete" : ""} ${activeFeedback?.objectiveIds?.includes(objective.id) ? "just-completed" : ""}`}
                        >
                          <span className="objective-check">{result?.complete ? "OK" : "??"}</span>
                          {activeFeedback?.objectiveIds?.includes(objective.id) && <span className="objective-clean-stamp" aria-hidden="true">CLEAN</span>}
                          <span><strong>{objective.title}</strong><small>{result?.detail ?? "Not checked yet"}</small></span>
                        </div>
                      );
                    })}
                  </div>
                  {!!activeChallenge.rules?.length && (
                    <div className="challenge-rules">
                      <span className="field-label">Challenge rules</span>
                      <div className="challenge-rule-list">
                        {activeChallenge.rules.map((rule) => {
                          const result = challengeEvaluation?.rules?.find((item) => item.id === rule.id);
                          return (
                            <div key={rule.id} className={result?.complete ? "complete" : ""}>
                              <span className="objective-check">{result?.complete ? "OK" : "??"}</span>
                              <span><strong>{rule.title}</strong><small>{result?.detail ?? "Scan to check this rule"}</small></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!!activeChallenge.hints?.length && (
                    <details
                      className="challenge-hints"
                      onToggle={(event) => {
                        if (!event.currentTarget.open || runStats.hintsUsed) return;
                        setRunStats((current) => ({ ...current, hintsUsed: 1 }));
                        setClipbitReaction({ message: "Hints are allowed and I only judge a little bit", mood: "smug" });
                      }}
                    >
                      <summary>Hints (may contain spoilers)</summary>
                      {activeChallenge.hints.map((hint) => <p key={hint}>{hint}</p>)}
                    </details>
                  )}
                  {activeChallenge.credit && (
                    <div className="challenge-credit">
                      <span className="field-label">Dataset credit</span>
                      <p><strong>{activeChallenge.credit.dataset}</strong> by {activeChallenge.credit.creator} via {activeChallenge.credit.source}</p>
                      <div>
                        <a href={activeChallenge.credit.sourceUrl} target="_blank" rel="noreferrer">Source</a>
                        <a href={activeChallenge.credit.licenseUrl} target="_blank" rel="noreferrer">CC BY 4.0 license</a>
                        <a href={activeChallenge.credit.doiUrl} target="_blank" rel="noreferrer">DOI</a>
                      </div>
                      <small>{activeChallenge.credit.changes}</small>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <section
            ref={informationPanelMovement.rootRef}
            className={`information-panel ${activeChallenge?.tutorial ? "tutorial-walkthrough-highlight" : ""} ${isInformationPortable ? "portable-note" : ""} ${informationPanelMovement.dragging ? "dragging" : ""}`}
            style={informationPanelMovement.style}
          >
            {isInformationPortable && (
              <div className="portable-note-handle" {...informationPanelMovement.handleProps}>
                <span>Walkthrough note</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsInformationPortable(false);
                    setIsInformationOpen(false);
                  }}
                  aria-label="Close walkthrough note"
                >
                  x
                </button>
              </div>
            )}
            <div className="information-heading">
              <button
                type="button"
                className="information-toggle"
                onClick={() => setIsInformationOpen(!isInformationOpen)}
              >
                <span>{activeChallenge?.tutorial ? `Boot 0.${activeChallenge.tutorialStage}C Walkthrough` : "Sample Dataset Walkthrough"}</span>
                <span>{isInformationOpen ? "Hide walkthrough" : "Open walkthrough"}</span>
              </button>
              {!isInformationPortable && (
                <button
                  type="button"
                  className="portable-note-launch walkthrough-note-launch"
                  onClick={() => {
                    setIsInformationOpen(true);
                    setIsInformationPortable(true);
                  }}
                >
                  Carry note
                </button>
              )}
            </div>
            {isInformationOpen && (
              <div className="information-content">
                <div className="information-intro">
                  <strong>{activeChallenge?.tutorial ? `Boot 0.${activeChallenge.tutorialStage}C training file` : "Try it with the sample dataset"}</strong>
                  <p>{activeChallenge?.tutorial ? `This stage has ${activeChallenge.objectives.length} objective${activeChallenge.objectives.length === 1 ? "" : "s"}, follow the steps below and scan when you are done` : "Load the sample, then follow the steps below to get familiar with the project"}</p>
                </div>
                {activeChallenge?.tutorialStage === 1 ? (
                  <BootScanWalkthrough />
                ) : activeChallenge?.tutorialStage === 2 ? (
                  <BootCategoryWalkthrough />
                ) : activeChallenge?.tutorialStage === 3 ? (
                  <BootIssueWalkthrough />
                ) : activeChallenge?.tutorialStage === 4 ? (
                  <BootRecoveryWalkthrough />
                ) : activeChallenge?.tutorialStage === 5 ? (
                  <BootRelationshipWalkthrough />
                ) : (
                <ol className="walkthrough-list">
                  <li>
                    <span>1</span>
                    {activeChallenge?.tutorial
                      ? <div><strong>Training file loaded</strong><p>Boot Sequence opens the broken training file for you, so you can start cleaning right away</p></div>
                      : <div><strong>Load the sample</strong><p>Use <HintCode hint="Loads the built-in practice CSV without uploading a file.">Load Sample Dataset</HintCode> in the sidebar. It contains a dirty dataset I 'borrowed' from Kaggle</p></div>}
                  </li>
                  <li>
                    <span>2</span>
                    <div><strong>Choose what to scan</strong><p>Only visible columns are included when you <HintCode hint="Checks every visible cell against the type and format selected for its column. Changing a column type changes what the next scan considers valid.">Scan</HintCode>. For now, <HintCode hint="Removes a column from the table and excludes it from scanning.">Hide</HintCode> everything except <span className="column-reference">Item</span>, <span className="column-reference">Quantity</span>, <span className="column-reference">Price Per Unit</span>, and <span className="column-reference">Total Spent</span></p></div>
                  </li>
                  <li>
                    <span>3</span>
                    <div><strong>Set the column types</strong><p>Choose <code>Number</code> for <span className="column-reference">Quantity</span>, <span className="column-reference">Price Per Unit</span>, and <span className="column-reference">Total Spent</span>, then set <span className="column-reference">Item</span> to <code>Category</code> and allow only Cake, Coffee, Cookie, Juice, Salad, Sandwich, Smoothie, and Tea</p></div>
                  </li>
                  <li>
                    <span>4</span>
                    <div>
                      <strong>Let Item and price identify each other</strong>
                      <p>Every Item has its own price, so open <HintCode hint="Learns trusted matches from rows where both columns are already valid">Column Relationships</HintCode>, choose <code>Logical relation</code>, use Item as the anchor, then click <code>Find relations</code></p>
                      <div className="formula-reference-list">
                        <span className="formula-reference">Item ↔ Price Per Unit</span>
                      </div>
                      <p>Price Per Unit should rise to the top, verify it on the full file and add the recommended relation, then apply every fixable match</p>
                    </div>
                  </li>
                  <li>
                    <span>5</span>
                    <div>
                      <strong>Link the three number columns</strong>
                      <p>In <HintCode hint="Creates calculations between columns to find and fill missing values">Column Relationships</HintCode>, switch to <code>Mathematical relation</code> and add these three rules:</p>
                      <div className="formula-reference-list">
                        <span className="formula-reference">Total Spent = [Quantity] * [Price Per Unit]</span>
                        <span className="formula-reference">Quantity = [Total Spent] / [Price Per Unit]</span>
                        <span className="formula-reference">Price Per Unit = [Total Spent] / [Quantity]</span>
                      </div>
                    </div>
                  </li>
                  <li>
                    <span>6</span>
                    <div><strong>Run the relationships in passes</strong><p>Click <HintCode hint="Runs every enabled Logical and Mathematical relation against the current data">Check all relationships</HintCode>, select every fixable row, and apply the fixes, then check again because a recovered price may reveal an Item and a recovered Item may reveal another price</p></div>
                  </li>
                  <li>
                    <span>7</span>
                    <div><strong>Handle the dates without guessing</strong><p>Show <span className="column-reference">Transaction Date</span>, set it to <code>Date</code> with <code>YYYY-MM-DD</code>, then open <code>Missing Rules</code>, allow missing values and add ERROR and UNKNOWN as missing tokens. They mean the real date is unknown so leave them missing instead of inventing one</p></div>
                  </li>
                  <li>
                    <span>8</span>
                    <div><strong>Move only the hopeless rows</strong><p>After the relationships stop finding fixes, scan again and open <HintCode hint="Shows every empty or invalid cell found during the latest scan">Validation Issues</HintCode>. Use <HintCode hint="Moves affected rows out of the active table while keeping them recoverable">Move rows to Data Bin</HintCode> only when Item, price, quantity, and total leave no trustworthy way to recover the row, then open <code>Data Bin</code> if you want to review or restore anything</p></div>
                  </li>
                  <li>
                    <span>9</span>
                    <div><strong>Check only what the job needs</strong><p>Keep <span className="column-reference">Item</span>, the three number columns, and <span className="column-reference">Transaction Date</span> visible, then scan again. Payment Method and Location are still unknown here so the tutorial will not ask you to invent them</p></div>
                  </li>
                  <li>
                    <span>10</span>
                    {activeChallenge?.tutorial
                      ? <div><strong>Finish Boot Sequence</strong><p>Scan one last time after fixing the remaining columns and Boot Sequence will complete when every objective is clean</p></div>
                      : <div><strong>Export when finished</strong><p><HintCode hint="Downloads the currently visible columns as a new CSV file.">Export CSV</HintCode> When you are done, all changes will be applied</p></div>}
                  </li>
                </ol>
                )}
                {(!activeChallenge?.tutorial || activeChallenge.tutorialStage === 5) && <section className="tutorial-tricks">
                  <div>
                    <span className="section-label">Useful tricks</span>
                    <strong>Easy to miss and very useful</strong>
                  </div>
                  <div className="tutorial-trick-grid">
                    <article>
                      <strong>Calculate separately within groups</strong>
                      <p>In <HintCode hint="Contains batch tools for cleaning the loaded data">Cleaning Tools</HintCode>, open <code>Fill Issues</code>, choose Median, Average, or Most common value and then choose a column under <code>Calculate within groups</code>. Challenge 4 uses Priority so every Priority gets its own median in one action</p>
                    </article>
                    <article>
                      <strong>Missing does not always mean broken</strong>
                      <p>Open <HintCode hint="Contains batch tools for cleaning the loaded data">Cleaning Tools</HintCode>, choose <code>Missing Rules</code>, select a column, and change its Policy to <code>Allowed</code> when empty values are valid. Challenge 2 uses this for optional phone numbers</p>
                    </article>
                    <article>
                      <strong>Change the table itself</strong>
                      <p>Open <HintCode hint="Contains batch tools for cleaning the loaded data">Cleaning Tools</HintCode> then choose <code>Manage Columns</code> to create, delete, split, or combine columns and drag any table header when you want to move it. Undo can bring deleted columns back</p>
                    </article>
                  </div>
                </section>}
              </div>
            )}
          </section>

          {(!activeChallenge?.tutorial || activeChallenge.tutorialStage >= 4) && <section className="relationship-panel">
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
                    <p>{relationshipDraft.kind === "lookup"
                      ? "A Logical relation learns matching pairs from rows where both cells already pass their column rules"
                      : <>Build a Mathematical relation using your columns Example: [Target Column] = [Unit amount] * [Unit price]<br />You don't have to add equal sign '=' the assigned [Target Column] is what's on the left side of the equation</>}</p>
                  </div>
                  <label>
                    <span>Relationship type</span>
                    <select value={relationshipDraft.kind} onChange={(event) => updateRelationshipDraft("kind", event.target.value)}>
                      <option value="formula">Mathematical relation</option>
                      <option value="lookup">Logical relation</option>
                    </select>
                  </label>
                  {relationshipDraft.kind === "lookup" && (
                    <label>
                      <span>Anchor column</span>
                      <select value={relationshipDraft.sourceColumn} onChange={(event) => updateRelationshipDraft("sourceColumn", event.target.value)}>
                        <option value="">Choose an anchor column</option>
                        {visibleColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                      </select>
                    </label>
                  )}
                  {relationshipDraft.kind === "formula" && <label>
                    <span>Target column</span>
                    <select value={relationshipDraft.targetColumn} onChange={(event) => updateRelationshipDraft("targetColumn", event.target.value)}>
                      <option value="">Choose target column</option>
                      {columns.filter((column) => column !== relationshipDraft.sourceColumn).map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </label>}
                  {relationshipDraft.kind === "formula" ? <>
                  <div className="relationship-formula-field">
                    <span>Formula</span>
                    <input
                      aria-label="Formula"
                      value={relationshipDraft.formula}
                      onChange={(event) => updateRelationshipDraft("formula", event.target.value)}
                      placeholder="[Unit amount] * [Unit price]"
                    />
                  </div>
                  <div className="formula-tools">
                    <span className="field-label">Math symbols </span>
                    <p>
                      Formulas follow the normal order of operations<br />
                      You can use your keyboard instead of the buttons and type numbers directly into the formula
                    </p>
                    <div className="formula-token-picker" aria-label="Insert math symbols">
                      <button type="button" onClick={() => insertRelationshipToken("+")} title="Add">+ Add</button>
                      <button type="button" onClick={() => insertRelationshipToken("-")} title="Subtract or make the next value negative">- Subtract</button>
                      <button type="button" onClick={() => insertRelationshipToken("*")} title="Multiply">* Multiply</button>
                      <button type="button" onClick={() => insertRelationshipToken("/")} title="Divide">/ Divide</button>
                      <button type="button" onClick={() => insertRelationshipToken("%")} title="Remainder after division">% Remainder</button>
                      <button type="button" onClick={() => insertRelationshipToken("(")} title="Open a grouped calculation">( Open</button>
                      <button type="button" onClick={() => insertRelationshipToken(")")} title="Close a grouped calculation">) Close</button>
                      <button
                        type="button"
                        className="clear-formula-button"
                        onClick={() => updateRelationshipDraft("formula", "")}
                        disabled={!relationshipDraft.formula}
                      >
                        Clear formula
                      </button>
                    </div>
                  </div>
                  <div className="formula-column-tools">
                    <div>
                      <span className="field-label">Columns</span>
                      <small>Click a column to add it to the formula</small>
                    </div>
                    <div className="formula-column-picker" aria-label="Insert columns">
                      {columns.map((column) => (
                        <button type="button" key={column} onClick={() => insertRelationshipColumn(column)}>{column}</button>
                      ))}
                    </div>
                  </div>
                  </> : (
                    <div className="lookup-explainer">
                      <strong>Find what connects to the anchor</strong>
                      <p>Every visible column is compared with the anchor in both directions using up to 50,000 rows</p>
                      <p>Strong and useful matches rise to the top, then you can verify one against the full file</p>
                      <button
                        type="button"
                        className="lookup-preview-button"
                        onClick={findLogicalRelations}
                        disabled={!relationshipDraft.sourceColumn || visibleColumns.length < 2 || lookupAnalysisProgress?.mode === "finding"}
                      >
                        {lookupAnalysisProgress?.mode === "finding" ? "Finding relations..." : "Find relations"}
                      </button>
                      {lookupAnalysisProgress && (
                        <div className="lookup-analysis-progress" aria-live="polite">
                          <div><span style={{ width: `${Math.round(lookupAnalysisProgress.progress * 100)}%` }} /></div>
                          <p>{lookupAnalysisProgress.label} {Math.round(lookupAnalysisProgress.progress * 100)}%</p>
                        </div>
                      )}
                      {activeLookupFinder && activeLookupFinder.results.length > 0 && (
                        <div className="lookup-finder-results">
                          <div className="lookup-finder-heading">
                            <strong>{activeLookupFinder.results.length} column{activeLookupFinder.results.length === 1 ? "" : "s"} compared</strong>
                            <span>{activeLookupFinder.sampleSize.toLocaleString()} of {activeLookupFinder.totalRows.toLocaleString()} rows sampled</span>
                          </div>
                          <div className="lookup-candidate-list">
                            {activeLookupFinder.results.map((candidate) => {
                              const recommendedResult = candidate.recommendation === "reverse"
                                ? candidate.reverse
                                : candidate.forward;
                              const bestResult = candidate.forward.dependencyStrength >= candidate.reverse.dependencyStrength
                                ? candidate.forward
                                : candidate.reverse;
                              const displayedResult = candidate.recommendation === "none" ? bestResult : recommendedResult;
                              const repairs = candidate.recommendation === "both"
                                ? candidate.forward.counts.safe + candidate.reverse.counts.safe
                                : candidate.recommendation === "reverse"
                                  ? candidate.reverse.counts.safe
                                  : candidate.recommendation === "forward"
                                    ? candidate.forward.counts.safe
                                    : Math.max(candidate.forward.counts.safe, candidate.reverse.counts.safe);
                              const direction = candidate.recommendation === "both"
                                ? `${relationshipDraft.sourceColumn} ↔ ${candidate.column}`
                                : candidate.recommendation === "reverse"
                                  ? `${candidate.column} → ${relationshipDraft.sourceColumn}`
                                  : candidate.recommendation === "forward"
                                    ? `${relationshipDraft.sourceColumn} → ${candidate.column}`
                                    : "No clear direction";
                              return (
                                <article
                                  className={getLookupStrengthLevel(displayedResult)}
                                  key={candidate.column}
                                  data-lookup-candidate={candidate.column}
                                >
                                  <div>
                                    <strong>{candidate.column}</strong>
                                    <code>{direction}</code>
                                  </div>
                                  <span>{displayedResult.dependencyStrength.toLocaleString()}% best dependency</span>
                                  <span>{repairs.toLocaleString()} possible repair{repairs === 1 ? "" : "s"} in the sample</span>
                                  <button
                                    type="button"
                                    onClick={() => verifyLogicalRelation(candidate.column)}
                                    disabled={lookupAnalysisProgress !== null}
                                  >
                                    Verify {candidate.column} relation
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {activeLookupFinder?.status === "ready" && activeLookupFinder.results.length === 0 && (
                        <p className="relationship-preview-needed">No other visible columns are available to compare</p>
                      )}
                      {activeLookupFinder?.status === "error" && (
                        <div className="relationship-error">{activeLookupFinder.error}</div>
                      )}
                      {activeLookupPreview && (
                        <div className="lookup-draft-preview">
                          <strong>Full file verification</strong>
                          <div className="lookup-direction-grid">
                            <article className={getLookupStrengthLevel(activeLookupPreview.forward)}>
                              <code>{relationshipDraft.sourceColumn} → {relationshipDraft.targetColumn}</code>
                              <strong>{activeLookupPreview.forward.dependencyStrength.toLocaleString()}% dependency strength</strong>
                              <span>{activeLookupPreview.forward.evidenceRowCount.toLocaleString()} valid pairs checked</span>
                              <span>{activeLookupPreview.forward.mappingCount.toLocaleString()} usable matches and {activeLookupPreview.forward.ambiguousMappingCount.toLocaleString()} conflicts</span>
                              <span>{activeLookupPreview.forward.counts.safe.toLocaleString()} repairs available now</span>
                            </article>
                            <article className={getLookupStrengthLevel(activeLookupPreview.reverse)}>
                              <code>{relationshipDraft.targetColumn} → {relationshipDraft.sourceColumn}</code>
                              <strong>{activeLookupPreview.reverse.dependencyStrength.toLocaleString()}% dependency strength</strong>
                              <span>{activeLookupPreview.reverse.evidenceRowCount.toLocaleString()} valid pairs checked</span>
                              <span>{activeLookupPreview.reverse.mappingCount.toLocaleString()} usable matches and {activeLookupPreview.reverse.ambiguousMappingCount.toLocaleString()} conflicts</span>
                              <span>{activeLookupPreview.reverse.counts.safe.toLocaleString()} repairs available now</span>
                            </article>
                          </div>
                          {activeLookupPreview.recommendation === "none" ? (
                            <p className="lookup-recommendation no-recommendation">No recommendation, neither direction has enough consistent evidence</p>
                          ) : (
                            <p className="lookup-recommendation">
                              Recommended: <code>{activeLookupPreview.recommendation === "both"
                                ? `${relationshipDraft.sourceColumn} ↔ ${relationshipDraft.targetColumn}`
                                : activeLookupPreview.recommendation === "reverse"
                                  ? `${relationshipDraft.targetColumn} → ${relationshipDraft.sourceColumn}`
                                  : `${relationshipDraft.sourceColumn} → ${relationshipDraft.targetColumn}`}</code>
                            </p>
                          )}
                          <div className="lookup-direction-options" aria-label="Logical relation direction">
                            <button type="button" disabled={!activeLookupPreview.forward.mappingCount} className={relationshipDraft.lookupDirection === "forward" ? "selected" : ""} onClick={() => updateRelationshipDraft("lookupDirection", "forward")}>{relationshipDraft.sourceColumn} → {relationshipDraft.targetColumn}</button>
                            <button type="button" disabled={!activeLookupPreview.reverse.mappingCount} className={relationshipDraft.lookupDirection === "reverse" ? "selected" : ""} onClick={() => updateRelationshipDraft("lookupDirection", "reverse")}>{relationshipDraft.targetColumn} → {relationshipDraft.sourceColumn}</button>
                            <button type="button" disabled={!activeLookupPreview.forward.mappingCount || !activeLookupPreview.reverse.mappingCount} className={relationshipDraft.lookupDirection === "both" ? "selected" : ""} onClick={() => updateRelationshipDraft("lookupDirection", "both")}>{relationshipDraft.sourceColumn} ↔ {relationshipDraft.targetColumn}</button>
                          </div>
                          <LookupValuePreview
                            anchorColumn={relationshipDraft.sourceColumn}
                            targetColumn={relationshipDraft.targetColumn}
                            preview={activeLookupPreview}
                            direction={relationshipDraft.lookupDirection}
                          />
                          {activeLookupPreview.recommendation === "none" && <p>You can still choose a weak direction if the relationship makes sense outside this table</p>}
                        </div>
                      )}
                    </div>
                  )}
                  {!relationshipDraftValidation.valid && (
                    relationshipDraft.kind === "formula"
                      ? Boolean(relationshipDraft.formula || relationshipDraft.targetColumn)
                      : Boolean(relationshipDraft.targetColumn)
                  ) && (
                    <div className="relationship-error">{relationshipDraftValidation.error}</div>
                  )}
                  {relationshipDraft.kind === "lookup" && relationshipDraft.sourceColumn && !activeLookupFinder && !activeLookupPreview && (
                    <p className="relationship-preview-needed">Find a relation before adding it</p>
                  )}
                  <div className="relationship-editor-actions">
                    <button type="button" onClick={saveRelationshipRule} disabled={!canSaveRelationship}>
                      {relationshipDraft.id ? "Save relationship" : "Add relationship"}
                    </button>
                    {relationshipDraft.id && (
                      <button type="button" className="secondary-button" onClick={() => { setRelationshipDraft(EMPTY_RELATIONSHIP_DRAFT); setLookupPreview(null); setLookupFinder(null); }}>Cancel edit</button>
                    )}
                  </div>
                </div>

                <div className="relationship-rule-list">
                  <div className="relationship-list-heading">
                    <span className="field-label">Saved rules</span>
                  </div>
                  {relationshipRuleStates.length === 0 ? (
                    <p className="relationship-empty">No relationships yet. Add a Mathematical or Logical relation</p>
                  ) : relationshipRuleStates.map((rule) => (
                    <article className="relationship-rule" key={rule.id}>
                      <div>
                        <strong>{rule.name}</strong>
                        <span className={`relationship-kind ${rule.kind === "lookup" ? "lookup" : "formula"}`}>{rule.kind === "lookup" ? "LOGICAL" : "MATHEMATICAL"}</span>
                        <code>{rule.kind === "lookup"
                          ? `${rule.sourceColumn} ${rule.bidirectional ? "\u2194" : "\u2192"} ${rule.targetColumn}`
                          : `${rule.targetColumn} = ${rule.formula}`}</code>
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

                {relationshipRuleStates.length > 0 && (
                  <div className="relationship-results">
                    <div className="relationship-list-heading">
                      <div>
                        <span className="field-label">Suggested fixes and checks</span>
                        <p>{relationshipIssues.length
                          ? `${relationshipIssues.length.toLocaleString()} relationship issue${relationshipIssues.length === 1 ? "" : "s"} found.`
                          : "Check your saved rules to find fixable values."}</p>
                        {Object.keys(lookupIssueCounts).length > 0 && (
                          <div className="lookup-preview-counts">
                            <span className="safe">{(lookupIssueCounts.safe ?? 0).toLocaleString()} safe</span>
                            <span>{(lookupIssueCounts.ambiguous ?? 0).toLocaleString()} ambiguous</span>
                            <span>{(lookupIssueCounts.noEvidence ?? 0).toLocaleString()} no evidence</span>
                            <span>{(lookupIssueCounts.invalidSource ?? 0).toLocaleString()} invalid source</span>
                          </div>
                        )}
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
                        <button type="button" className="secondary-button" onClick={() => checkRelationshipRules()} disabled={!relationshipRuleStates.some((rule) => rule.enabled && rule.validation.valid) || !rows.length}>Check all relationships</button>
                      </div>
                    </div>
                    {relationshipIssues.length > 0 && (
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
                    )}
                    {relationshipIssues.length > 500 && <p className="relationship-limit">Showing the first 500 issues. Apply fixes in batches, then check again.</p>}
                  </div>
                )}
              </div>
            )}
          </section>}

          <div className="validation-panel">
            <button
              type="button"
              className="validation-toggle"
              onClick={() => setIsValidationPanelOpen(!isValidationPanelOpen)}
            >
              <span>Validation issues</span>
              <span>{uniqueValidationIssues.length.toLocaleString()}</span>
            </button>

            {isValidationPanelOpen && (
              <div className="validation-content">
                {validationIssues.length === 0 ? (
                  <div className="success-box">No type mismatches found.</div>
                ) : (
                  <>
                  <div className="issue-actions">
                    <span>
                      Showing {uniqueValidationIssues.length.toLocaleString()} unique error{uniqueValidationIssues.length === 1 ? "" : "s"} from {validationIssues.length.toLocaleString()} affected cell{validationIssues.length === 1 ? "" : "s"}.
                    </span>
                    <div className="issue-buttons">
                      <button type="button" className="secondary-button" onClick={exportIssuesCsv}>
                        Export Issues CSV
                      </button>
                      <button type="button" className="delete-issue-rows-button" onClick={deleteRowsWithValidationIssues}>
                        Move rows to Data Bin ({validationIssueRowCount.toLocaleString()})
                      </button>
                    </div>
                  </div>
                  <div className="issue-table-wrap">
                    <table className="issue-table">
                      <thead>
                        <tr>
                          <th>Rows</th>
                          <th>Column</th>
                          <th>Expected</th>
                          <th>Value</th>
                          <th>Issue</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uniqueValidationIssues.map((issue) => (
                          <tr key={issue.key}>
                            <td>{formatIssueRows(issue)}</td>
                            <td>{issue.column}</td>
                            <td>{issue.expected}</td>
                            <td>{issue.value || "(empty)"}</td>
                            <td>{issue.reason}</td>
                            <td>{issue.count.toLocaleString()}</td>
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

          <section className="table-control-deck" aria-label="Table and selected column controls">
            <div className="column-control-row">
              {selectedColumn ? (
                <>
                  <div className="selected-column-summary">
                    <span className="field-label">Selected column</span>
                    <strong title={selectedColumn}>{selectedColumn}</strong>
                    <small>Detected as {selectedDetectedType}</small>
                  </div>
                  <label className="column-type-control">
                    <span>Column Type</span>
                    <select
                      value={selectedRule?.type ?? UNIDENTIFIED_TYPE}
                      onChange={(event) => handleExpectedTypeChange(selectedColumn, event.target.value)}
                    >
                      {selectedRule?.type === UNIDENTIFIED_TYPE && (
                        <option value={UNIDENTIFIED_TYPE} disabled>{UNIDENTIFIED_TYPE}</option>
                      )}
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <div className="column-rule-control">
                    <div>
                      <span>Validation rule</span>
                      <strong title={getRuleDisplayName(selectedRule ?? createColumnRule(UNIDENTIFIED_TYPE))}>
                        {getRuleDisplayName(selectedRule ?? createColumnRule(UNIDENTIFIED_TYPE))}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={openRuleBuilder}
                      disabled={selectedRule?.type === UNIDENTIFIED_TYPE}
                      title={selectedRule?.type === UNIDENTIFIED_TYPE ? "Choose a column type first" : "Configure this validation rule"}
                    >
                      Configure
                    </button>
                  </div>
                  <div className={`column-issue-count ${selectedColumnIssueCount ? "has-issues" : ""}`}>
                    <span>Issues</span>
                    <strong>{selectedColumnIssueCount.toLocaleString()}</strong>
                  </div>
                  {["Number", "Integer"].includes(selectedRule?.type) && (
                    <div className="column-control-actions">
                      <details className="column-convert-menu" key={selectedColumn}>
                        <summary>Convert values</summary>
                        <div>
                          <button type="button" className="secondary-button" onClick={() => convertSelectedNumericColumn("Integer")}>
                            Convert to Integer
                          </button>
                          {selectedRule?.type === "Number" && (
                            <button type="button" className="secondary-button" onClick={() => convertSelectedNumericColumn("Number")}>
                              Convert to Float
                            </button>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                  {selectedDateTargetPreset && (
                    <div className="column-control-actions">
                      <details className="column-convert-menu" key={selectedColumn}>
                        <summary>Change date format</summary>
                        <div className="date-convert-menu-content">
                          <label>
                            <span>Current format</span>
                            <select
                              value={dateConversionSourcePresetId}
                              onChange={(event) => setDateConversionSourcePresetId(event.target.value)}
                            >
                              {DATE_VALIDATION_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>{preset.name}</option>
                              ))}
                            </select>
                          </label>
                          <small>Change to {selectedDateTargetPreset.name}</small>
                          <button type="button" className="secondary-button" onClick={convertSelectedDateColumn}>
                            Change dates
                          </button>
                        </div>
                      </details>
                    </div>
                  )}
                </>
              ) : (
                <div className="column-control-empty">
                  <strong>Select a column</strong>
                  <span>Choose a table cell, header, or column from the left to edit its type and rules</span>
                </div>
              )}
            </div>

            {columnConversionNotice && (
              <div className="column-action-notice" role="status">{columnConversionNotice}</div>
            )}

            <div className="dataset-control-row">
              <div className="issue-jump-meta">
                <span className="field-label">Dataset actions</span>
                <strong>
                  {validationIssues.length
                    ? `${validationIssues.length.toLocaleString()} issue${validationIssues.length === 1 ? "" : "s"} found`
                    : "No scanned issues"}
                </strong>
                <span>
                  {validationIssues.length ? "Review the latest scan or continue cleaning" : "Clean the data and scan when you are ready"}
                </span>
              </div>
              <div className="issue-jump-actions">
                <div className="issue-jump-action-row issue-jump-history-actions">
                  {selectedGridRowIds.length > 0 && (
                    <button
                      type="button"
                      className="move-selected-rows-button"
                      onClick={moveSelectedRowsToDataBin}
                      title="Move selected rows out of the table without losing them"
                    >
                      Move {selectedGridRowIds.length.toLocaleString()} to Bin
                    </button>
                  )}
                  <button type="button" className="secondary-button" onClick={() => openCleaningTools("home")}>Cleaning Tools</button>
                  <button type="button" className="secondary-button" onClick={undo} disabled={!history.past.length}>Undo</button>
                  <button type="button" className="secondary-button" onClick={redo} disabled={!history.future.length}>Redo</button>
                </div>
                <div className="issue-jump-action-row issue-jump-workflow-actions">
                  {scanBlockerMessage && <span className="scan-blocker-message" role="alert">{scanBlockerMessage}</span>}
                  <button type="button" onClick={scanForIssues} disabled={!canScan || isScanning}>
                    {isScanning ? "Scanning..." : lastScannedAt ? "Scan Again" : "Scan"}
                  </button>
                  <button
                    type="button"
                    className={`secondary-button ${showIssueRowsOnly ? "active-view-button" : ""}`}
                    onClick={() => setShowIssueRowsOnly((current) => !current)}
                    disabled={!showIssueRowsOnly && (!validationIssues.length || hasUnscannedChanges)}
                  >
                    {showIssueRowsOnly ? "Show All Rows" : "Display invalid rows"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className={`ag-theme-quartz table-grid ${tableFeedback ? `table-feedback-${tableFeedback.kind}` : ""}`}>
            <ScanOverlay active={isScanning} progress={scanProgress} onCancel={cancelScan} />
            <CleaningFeedbackLayer event={tableFeedback} reduced={isEffectsReduced} />
            <AgGridReact
              ref={gridRef}
              rowData={gridRows}
              columnDefs={gridColumns}
              defaultColDef={{ editable: true, filter: true, sortable: true, resizable: true, cellDataType: false }}
              getRowId={(params) => params.data.__rowId}
              pagination
              paginationPageSize={100}
              rowSelection={GRID_ROW_SELECTION}
              onSelectionChanged={(event) => setSelectedGridRowIds(event.api.getSelectedRows().map((row) => row.__rowId))}
              onCellValueChanged={handleCellValueChanged}
              onColumnMoved={handleColumnMoved}
              onColumnHeaderClicked={(event) => {
                if (event.column?.getColId() && event.column.getColId() !== "__rowId") {
                  selectColumn(event.column.getColId());
                }
              }}
              suppressDragLeaveHidesColumns
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

      {isRowWipeoutSceneOpen && <div className="row-wipeout-backdrop" aria-hidden="true" />}
      {(viewMode === "campaign" || activeChallenge) && (
        <Clipbit
          message={clipbitReaction.message}
          mood={clipbitReaction.mood}
          minimized={isClipbitMinimized}
          campaign={viewMode === "campaign"}
          hell={isHellContext}
          reducedEffects={isEffectsReduced}
          spotlight={isRowWipeoutSceneOpen}
          spotlightActionLabel="Restart level"
          onSpotlightAction={restartAfterRowWipeout}
          onToggle={() => setIsClipbitMinimized((current) => !current)}
          onMinimize={() => setIsClipbitMinimized(true)}
          breakSignal={clipbitBreakSignal}
          onPester={async () => {
            await enableGameAudio();
            playSound("clipbit");
            if (activeChallenge) setRunStats((current) => ({ ...current, clipbitClicks: current.clipbitClicks + 1 }));
            const reaction = CLIPBIT_PESTER_REACTIONS[clipbitPesterCountRef.current % CLIPBIT_PESTER_REACTIONS.length];
            clipbitPesterCountRef.current += 1;
            setClipbitReaction(reaction);
          }}
          onRage={async () => {
            await enableGameAudio();
            playSound("clipbitBreak");
            if (activeChallenge) setRunStats((current) => ({ ...current, clipbitClicks: current.clipbitClicks + 1 }));
            setClipbitReaction({
              message: "CLICK LIMIT EXCEEDED and Clipbit.exe has rage quit the spreadsheet",
              mood: "angry",
            });
          }}
        />
      )}
      {isAchievementsOpen && (
        <AchievementsDialog
          progress={gameProgress}
          onClose={() => setIsAchievementsOpen(false)}
          onReset={resetPlayerProgress}
          onUnlockHell={import.meta.env.DEV ? unlockHellDiskForTesting : undefined}
        />
      )}
      <AchievementToast achievement={activeAchievement} />
      {viewMode === "workspace" && activeChallenge && (
        <OfficeChat
          messages={officeMessages}
          open={isOfficeChatOpen}
          onOpen={() => setIsOfficeChatOpen(true)}
          onClose={() => setIsOfficeChatOpen(false)}
        />
      )}
      <CleaningFeedbackLayer
        event={isViewportFeedback ? activeFeedback : null}
        reduced={isEffectsReduced}
        placement="viewport"
      />
      {pendingChallengeLaunch && storyChallenge && (
        <div className="challenge-story-backdrop" onMouseDown={closeChallengeStory}>
          <section className={`challenge-story-dialog ${storyChallenge.accent} ${storyChallenge.pack === "hell" ? "hell-story-dialog" : ""}`} role="dialog" aria-modal="true" aria-labelledby="challenge-story-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="challenge-story-heading">
              <div>
                <span className="section-label">{storyChallenge.pack === "hell" ? `H${storyChallenge.number} // SIGNAL CORRUPTED` : storyChallenge.tutorial ? `Boot 0.${storyChallenge.tutorialStage}C briefing` : `Challenge ${storyChallenge.number} briefing`}</span>
                <CorruptedText
                  as="h2"
                  id="challenge-story-title"
                  active={storyChallenge.pack === "hell"}
                  reducedEffects={isEffectsReduced}
                >
                  {storyChallenge.title}
                </CorruptedText>
              </div>
              <button type="button" className="dialog-close" onClick={closeChallengeStory}>Back</button>
            </div>

            <div className="challenge-story-progress" aria-label={`Story page ${challengeStoryPage + 1} of ${storyChallenge.story.length}`}>
              {storyChallenge.story.map((page, index) => (
                <span key={page} className={index < challengeStoryPage ? "complete" : index === challengeStoryPage ? "active" : ""}>{index + 1}</span>
              ))}
            </div>

            <div
              className={`challenge-story-textbox ${isChallengeStoryPageComplete ? "complete" : "typing"}`}
              role="button"
              tabIndex={0}
              aria-describedby="challenge-story-full-text"
              onClick={() => {
                if (!isChallengeStoryPageComplete) revealChallengeStoryPage();
              }}
              onKeyDown={(event) => {
                if (["Enter", " "].includes(event.key) && !isChallengeStoryPageComplete) {
                  event.preventDefault();
                  revealChallengeStoryPage();
                }
              }}
            >
              <span className="challenge-story-label">{storyChallenge.pack === "hell" ? "Recovered transmission" : "Incident report"}</span>
              <p id="challenge-story-full-text" className="screen-reader-only">{challengeStoryText}</p>
              <p className="challenge-story-visible-text" aria-hidden="true">
                {challengeStoryText.slice(0, challengeStoryCharacterCount)}
                {!isChallengeStoryPageComplete && <span className="challenge-story-cursor" />}
              </p>
              <small>{isChallengeStoryPageComplete ? "Page ready" : "Click or press Space to reveal the page"}</small>
            </div>

            <div className="challenge-story-actions">
              <button type="button" className="secondary-button" onClick={closeChallengeStory}>Back</button>
              {challengeStoryPage < storyChallenge.story.length - 1 ? (
                <button type="button" onClick={showNextChallengeStoryPage} disabled={!isChallengeStoryPageComplete}>Next</button>
              ) : (
                <button type="button" onClick={beginPendingChallenge} disabled={!isChallengeStoryPageComplete}>
                  {pendingChallengeLaunch.restart ? "Restart challenge" : "Begin challenge"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {isChallengeCelebrating && (
        <div className="challenge-confetti" role="status" aria-label="Challenge complete">
          {Array.from({ length: 48 }, (_, index) => (
            <span
              aria-hidden="true"
              key={index}
              style={{
                "--confetti-delay": `${index % 8 * 24}ms`,
                "--confetti-drift": `${(index % 9 - 4) * 22}px`,
                "--confetti-left": `${(index * 37 + 9) % 100}%`,
                "--confetti-turn": `${(index % 2 ? 1 : -1) * (380 + index * 17)}deg`,
                backgroundColor: CHALLENGE_CONFETTI_COLORS[index % CHALLENGE_CONFETTI_COLORS.length],
              }}
            />
          ))}
        </div>
      )}
      {isChallengeResultOpen && activeChallenge && challengeEvaluation && (
        <div className="challenge-result-backdrop" onMouseDown={() => setIsChallengeResultOpen(false)}>
          <section className="challenge-result" role="dialog" aria-modal="true" aria-labelledby="challenge-result-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="section-label">Dataset cleaned</span>
            <h2 id="challenge-result-title">{activeChallenge.title}</h2>
            <div className={`challenge-result-grade grade-${challengeScore.grade.toLowerCase()}`} aria-label={`Grade ${challengeScore.grade}`}>{challengeScore.grade}</div>
            <p>{challengeScore.total}/100 points in {challengeScore.moves} move{challengeScore.moves === 1 ? "" : "s"} with a best combo of x{challengeScore.maxCombo}</p>
            <div className="challenge-score-breakdown">
              {Object.entries(challengeScore.breakdown).map(([label, value]) => (
                <span key={label}><small>{label}</small><strong>{value}</strong></span>
              ))}
            </div>
            <Clipbit
              message={`You did it human and I am genuinely impressed, please do not make this weird\n${activeChallenge.assistant?.win ?? "The file is clean and even I ran out of complaints"}`}
              mood="happy"
              hell={isHellContext}
              reducedEffects={isEffectsReduced}
              embedded
            />
            <div className="challenge-result-actions">
              <button type="button" className="secondary-button" onClick={() => setIsChallengeResultOpen(false)}>Keep cleaning</button>
              <button type="button" onClick={() => {
                setIsChallengeResultOpen(false);
                showCampaign();
              }}>{activeChallenge.tutorial
                ? activeChallenge.tutorialStage < 5 ? "Back to boot menu" : "Power the challenge rack"
                : "Choose another mess"}</button>
            </div>
          </section>
        </div>
      )}
      {isChallengeLoading && (
        <div className="challenge-load-backdrop">
          <section className="challenge-load-dialog" role="status" aria-live="polite">
            <span className="challenge-load-spinner" aria-hidden="true" />
            <span className="section-label">{loadingKind === "challenge" ? "Opening challenge" : "Opening file"}</span>
            <h2>{challengeLoadingTitle}</h2>
            <p>
              {loadingProgress.rowCount
                ? `${loadingProgress.rowCount.toLocaleString()} rows read${loadingProgress.progress === null ? "" : ` · ${Math.round(loadingProgress.progress * 100)}%`}`
                : "The big datasets need a moment"}
            </p>
          </section>
        </div>
      )}
      {!!challengeLoadError && !isChallengeLoading && (
        <div className="challenge-load-backdrop" onMouseDown={() => setChallengeLoadError("")}>
          <section className="challenge-load-dialog error" role="alertdialog" aria-modal="true" aria-labelledby="challenge-load-error-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="section-label">Challenge refused to wake up</span>
            <h2 id="challenge-load-error-title">Could not load the dataset</h2>
            <p>{challengeLoadError}</p>
            <button type="button" onClick={() => setChallengeLoadError("")}>Back to challenges</button>
          </section>
        </div>
      )}
      {isCleaningToolsOpen && renderCleaningTools()}
      {isRuleBuilderOpen && ruleDraft && (
        <div className="rule-builder-backdrop" onMouseDown={() => setIsRuleBuilderOpen(false)}>
          <section
            className={`rule-builder-dialog ${ruleDraft.mode === "friendly" && ruleDraft.type === "Category" ? "category-rule-builder-dialog" : ""}`}
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
                  <div className="category-values-picker">
                    <section className="existing-values-list category-values-pane">
                      <div className="category-values-pane-heading">
                        <div>
                          <strong>Values found in column</strong>
                          <span>{existingCategoryOptions.length.toLocaleString()} unique values</span>
                        </div>
                        <button type="button" className="secondary-button" disabled={!filteredExistingCategoryOptions.length} onClick={addShownCategoryValues}>Add all</button>
                      </div>
                      <div className="existing-values-toolbar">
                        <input value={existingCategoryFilter} onChange={(event) => setExistingCategoryFilter(event.target.value)} placeholder="Search existing values" />
                        <strong>{selectedExistingCategoryCount.toLocaleString()} selected</strong>
                      </div>
                      <div className="existing-values-options">
                        {filteredExistingCategoryOptions.map((value) => {
                          const isSelected = ruleDraft.allowedValues.includes(value);
                          return (
                            <button
                              type="button"
                              key={value}
                              className={`existing-value-option ${isSelected ? "is-selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() => toggleExistingCategoryValue(value)}
                            >
                              <span className="existing-value-check" aria-hidden="true">{isSelected ? "X" : ""}</span>
                              <span className="existing-value-name">{value}</span>
                              <span className="existing-value-state">{isSelected ? "Added" : "Add"}</span>
                            </button>
                          );
                        })}
                        {!filteredExistingCategoryOptions.length && (
                          <div className="existing-values-empty">
                            {existingCategoryOptions.length ? "No values match this search" : "This column has no existing values"}
                          </div>
                        )}
                      </div>
                    </section>
                    <section className="allowed-values-current category-values-pane">
                      <div className="category-values-pane-heading">
                        <div>
                          <strong>Allowed values</strong>
                          <span>{(ruleDraft.allowedValues ?? []).length.toLocaleString()} selected</span>
                        </div>
                        <button type="button" className="secondary-button" disabled={!ruleDraft.allowedValues.length} onClick={() => updateRuleDraft("allowedValues", [])}>Clear all</button>
                      </div>
                      <div className="allowed-values-list">
                        {(ruleDraft.allowedValues ?? []).map((value) => (
                          <button type="button" className="allowed-value-option" key={value} onClick={() => removeAllowedValue(value)}>
                            <span>{value}</span>
                            <span>Remove</span>
                          </button>
                        ))}
                        {!ruleDraft.allowedValues.length && <span className="allowed-values-empty">Pick values from the list on the left or type your own above</span>}
                      </div>
                    </section>
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

function BootScanWalkthrough() {
  return (
    <ol className="walkthrough-list compact-walkthrough">
      <li>
        <span>1</span>
        <div><strong>Pick the column</strong><p>Click <span className="column-reference">Tickets Closed</span> in the table header and its controls will appear above the table</p></div>
      </li>
      <li>
        <span>2</span>
        <div><strong>Tell the scanner what belongs</strong><p>Choose <code>Integer</code> under <code>Column Type</code> because ticket counts should be whole numbers</p></div>
      </li>
      <li>
        <span>3</span>
        <div><strong>Run your first scan</strong><p>Click <HintCode hint="Checks every visible cell against the type selected for its column">Scan</HintCode> and Stage 1 will finish when the scanner confirms every ticket count is an integer</p></div>
      </li>
    </ol>
  );
}

function BootCategoryWalkthrough() {
  return (
    <ol className="walkthrough-list compact-walkthrough">
      <li>
        <span>1</span>
        <div><strong>Normalize the writing</strong><p>Open <code>Cleaning Tools</code> then <code>Text Cleanup</code>, choose <span className="column-reference">Status</span>, trim spaces and use <code>Title Case</code></p></div>
      </li>
      <li>
        <span>2</span>
        <div><strong>Turn Status into a Category</strong><p>Click the <span className="column-reference">Status</span> header then choose <code>Category</code> under <code>Column Type</code></p></div>
      </li>
      <li>
        <span>3</span>
        <div><strong>Finish the stage</strong><p>Click <HintCode hint="Checks the cleaned Status values against the Category type">Scan</HintCode> and 0.3C will unlock</p></div>
      </li>
    </ol>
  );
}

function BootIssueWalkthrough() {
  return (
    <ol className="walkthrough-list compact-walkthrough">
      <li>
        <span>1</span>
        <div><strong>Set the target type</strong><p>Click <span className="column-reference">Daily Target</span> and choose <code>Integer</code> because every agent should have the whole number 8</p></div>
      </li>
      <li>
        <span>2</span>
        <div><strong>Find the broken targets</strong><p>Click <HintCode hint="Checks every visible Daily Target against the Integer type">Scan</HintCode> and open <code>Validation Issues</code> to see the empty value, the word, and the question marks</p></div>
      </li>
      <li>
        <span>3</span>
        <div><strong>Repair all three together</strong><p>Open <code>Cleaning Tools</code> then <code>Fill Issues</code>, choose <span className="column-reference">Daily Target</span>, keep <code>Empty and invalid</code>, choose <code>Custom value</code>, enter <code>8</code>, then apply the fill</p></div>
      </li>
      <li>
        <span>4</span>
        <div><strong>Confirm the repair</strong><p>Scan again and 0.4C will unlock when every Daily Target is a valid Integer with the value 8</p></div>
      </li>
    </ol>
  );
}

function BootRecoveryWalkthrough() {
  return (
    <ol className="walkthrough-list compact-walkthrough">
      <li>
        <span>1</span>
        <div><strong>Prepare the meter columns</strong><p>Set <span className="column-reference">Start Reading</span>, <span className="column-reference">End Reading</span>, and <span className="column-reference">Usage</span> to <code>Number</code>, then scan to reveal the missing readings</p></div>
      </li>
      <li>
        <span>2</span>
        <div><strong>Build one relationship</strong><p>Open <code>Column Relationships</code>, keep <code>Mathematical relation</code>, choose <span className="column-reference">Usage</span> as the target and enter <span className="formula-reference">[End Reading] - [Start Reading]</span>, then add the relationship</p></div>
      </li>
      <li>
        <span>3</span>
        <div><strong>Apply every proven fix</strong><p>Click <code>Check all relationships</code>, choose <code>Select all fixable</code>, then <code>Apply selected fixes</code>. Three Usage values can be recovered from the other readings</p></div>
      </li>
      <li>
        <span>4</span>
        <div><strong>Move the impossible row</strong><p>Scan again and open <code>Validation Issues</code>. The remaining row is missing both Start Reading and Usage so the formula has nothing to work with, choose <code>Move rows to Data Bin</code> then scan one last time</p></div>
      </li>
    </ol>
  );
}

function BootRelationshipWalkthrough() {
  return (
    <ol className="walkthrough-list">
      <li>
        <span>1</span>
        <div><strong>Choose what to scan</strong><p>Only visible columns are included when you <HintCode hint="Checks every visible cell against the type and format selected for its column. Changing a column type changes what the next scan considers valid.">Scan</HintCode>. For now, <HintCode hint="Removes a column from the table and excludes it from scanning.">Hide</HintCode> everything except <span className="column-reference">Item</span>, <span className="column-reference">Quantity</span>, <span className="column-reference">Price Per Unit</span>, and <span className="column-reference">Total Spent</span></p></div>
      </li>
      <li>
        <span>2</span>
        <div><strong>Set the column rules</strong><p>Choose <code>Number</code> for <span className="column-reference">Quantity</span>, <span className="column-reference">Price Per Unit</span>, and <span className="column-reference">Total Spent</span>, then set <span className="column-reference">Item</span> to <code>Category</code> and allow only Cake, Coffee, Cookie, Juice, Salad, Sandwich, Smoothie, and Tea</p></div>
      </li>
      <li>
        <span>3</span>
        <div>
          <strong>Connect Item and price with one Logical relation</strong>
          <p>Open <HintCode hint="Learns matching pairs only from rows where both cells pass their column rules">Column Relationships</HintCode>, choose <code>Logical relation</code>, use <span className="column-reference">Item</span> as the anchor, then click <code>Find relations</code></p>
          <div className="formula-reference-list">
            <span className="formula-reference">Item ↔ Price Per Unit</span>
          </div>
          <p>Choose <span className="column-reference">Price Per Unit</span> from the results and verify it on the full file, then add the recommended relation. It can use Coffee to repair a missing 2 or use 2 to repair a missing Coffee</p>
        </div>
      </li>
      <li>
        <span>4</span>
        <div>
          <strong>Link the three number columns</strong>
          <p>Switch to <code>Mathematical relation</code> and add these three rules:</p>
          <div className="formula-reference-list">
            <span className="formula-reference">Total Spent = [Quantity] * [Price Per Unit]</span>
            <span className="formula-reference">Quantity = [Total Spent] / [Price Per Unit]</span>
            <span className="formula-reference">Price Per Unit = [Total Spent] / [Quantity]</span>
          </div>
        </div>
      </li>
      <li>
        <span>5</span>
        <div><strong>Run the relationships in passes</strong><p>Click <HintCode hint="Runs every enabled Logical and Mathematical relation against the current data">Check all relationships</HintCode>, select every fixable row, and apply the fixes, then check again because one repaired cell may give another rule enough information to work</p></div>
      </li>
      <li>
        <span>6</span>
        <div><strong>Handle the dates without guessing</strong><p>Show <span className="column-reference">Transaction Date</span>, set it to <code>Date</code> with <code>YYYY-MM-DD</code>, then open <code>Missing Rules</code>, allow missing values and add ERROR and UNKNOWN as missing tokens. They mean the real date is unknown so leave them missing instead of inventing one</p></div>
      </li>
      <li>
        <span>7</span>
        <div><strong>Move only the hopeless rows</strong><p>After the relationships stop finding fixes, scan again and open <HintCode hint="Shows every empty or invalid cell found during the latest scan">Validation Issues</HintCode>. Use <HintCode hint="Moves affected rows out of the active table while keeping them recoverable">Move rows to Data Bin</HintCode> only when Item, price, quantity, and total leave no trustworthy way to recover the row, then open <code>Data Bin</code> if you want to review or restore anything</p></div>
      </li>
      <li>
        <span>8</span>
        <div><strong>Check only what the job needs</strong><p>Keep <span className="column-reference">Item</span>, the three number columns, and <span className="column-reference">Transaction Date</span> visible, then scan again. Payment Method and Location are still unknown here so the tutorial will not ask you to invent them</p></div>
      </li>
      <li>
        <span>9</span>
        <div><strong>Finish Boot Sequence</strong><p>Scan one last time after fixing the remaining columns and Boot Sequence will complete when every objective is clean</p></div>
      </li>
    </ol>
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

function createSchemaHistoryAction({ label, operation, rows, addedColumns, removedColumns, before, after, audit }) {
  const removedValues = removedColumns.length
    ? rows.map((row) => ({ rowId: row.__rowId, values: Object.fromEntries(removedColumns.map((column) => [column, row[column] ?? ""])) }))
    : [];
  return {
    label,
    kind: "schema",
    operation: cloneSerializable(operation),
    addedColumns: [...addedColumns],
    removedColumns: [...removedColumns],
    removedValues,
    before: cloneSerializable(before),
    after: cloneSerializable(after),
    audit,
  };
}

function undoSchemaTransformRows(rows, action) {
  const removedByRowId = new Map(action.removedValues.map((item) => [item.rowId, item.values]));
  return rows.map((row) => {
    const nextRow = { ...row };
    for (const column of action.addedColumns) delete nextRow[column];
    const removedValues = removedByRowId.get(row.__rowId);
    if (removedValues) Object.assign(nextRow, removedValues);
    return nextRow;
  });
}

function moveArrayItem(items, index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value));
}

function pickColumns(row, selectedColumns) {
  const picked = { __rowId: row.__rowId };
  for (const column of selectedColumns) picked[column] = row[column] ?? "";
  return picked;
}

function getUniqueColumnValues(rows, column) {
  if (!column) return [];
  const seen = new Set();
  const values = [];
  for (const row of rows) {
    const value = String(row[column] ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
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

function getFillReplacementValue(draft, rule) {
  if (draft?.method !== "customDate") return draft?.customValue ?? "";
  const isoDate = String(draft.customDate ?? "").trim();
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))) return "";
  const [, year, month, day] = match;
  const presetId = rule?.mode === "preset" ? rule.presetId : "date-iso-dash";
  if (presetId === "date-iso-slash") return `${year}/${month}/${day}`;
  if (presetId === "date-us") return `${month}/${day}/${year}`;
  if (presetId === "date-eu") return `${day}/${month}/${year}`;
  return isoDate;
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
      ? savedRules
        .map((rule) => ({ kind: "formula", ...rule }))
        .filter((rule) => rule?.id && rule?.targetColumn && (
          rule.kind === "lookup" ? rule.sourceColumn : rule.formula
        ))
      : [];
  } catch {
    return [];
  }
}

function validateRelationshipRule(rule, columns) {
  if (rule.kind === "lookup") return validateLookupRule(rule, columns);
  if (!rule.targetColumn) return { valid: false, error: "Choose a target column." };
  if (!columns.includes(rule.targetColumn)) return { valid: false, error: `Target column “${rule.targetColumn}” is not in this file.` };
  if (!String(rule.formula ?? "").trim()) return { valid: false, error: "Enter a formula." };
  try {
    const parsed = parseFormula(rule.formula);
    const unknownColumn = parsed.references.find((column) => !columns.includes(column));
    if (unknownColumn) return { valid: false, error: `Column “${unknownColumn}” is not in this file.` };
    if (parsed.references.includes(rule.targetColumn)) return { valid: false, error: "The target column cannot also be a formula input." };
    if (!parsed.references.length) return { valid: false, error: "Add at least one column reference." };
    return { valid: true, ast: parsed.ast, references: parsed.references };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Invalid formula." };
  }
}

function parseNumericValueForConversion(value) {
  if (isEmptyValue(value)) return null;
  const normalized = String(value).trim().replaceAll(",", "");
  if (!normalized) return null;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function checkRelationshipRows(rows, rule, ast, columnRules) {
  const issues = [];
  rows.forEach((row, rowIndex) => {
    let calculatedValue;
    try {
      calculatedValue = evaluateFormula(ast, row);
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
    const suggestedValue = formatFormulaNumber(calculatedValue);
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
    const numericTarget = parseFormulaNumber(targetValue);
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
  const normalizedRule = normalizeMissingRule(rule);
  if (!isCustomRegexMode(normalizedRule) || !normalizedRule.savedRegexId) return normalizedRule;
  const savedRule = regexRules.find((item) => item.id === normalizedRule.savedRegexId);
  if (!savedRule) return normalizedRule;
  return normalizeMissingRule({
    ...normalizedRule,
    customPattern: savedRule.pattern,
    customPatternLabel: savedRule.label,
    matchMode: savedRule.matchMode ?? "full",
    builder: savedRule.builder ?? null,
  });
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
  if (rule.type === UNIDENTIFIED_TYPE) return "Choose a column type";
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
  const values = [];
  for (const row of rows) {
    const value = row[column];
    if (String(value ?? "").trim() === "") continue;
    values.push(value);
    if (values.length >= 1000) break;
  }
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
  return normalizeMissingRule({
    type,
    presetId: DEFAULT_PRESET_BY_TYPE[type] ?? DEFAULT_PRESET_BY_TYPE.Text,
    mode: "preset",
    customPattern: "",
    customPatternLabel: "",
    savedRegexId: "",
  });
}

function validateCreateColumnValue(operation) {
  if (!TYPE_OPTIONS.includes(operation.dataType)) return { valid: false, error: "Choose a column type." };
  if (operation.initialMode !== "fixed") return { valid: true, error: "" };
  if (!String(operation.initialValue ?? "").trim()) return { valid: false, error: "Enter a starting value or choose empty." };
  const rule = createColumnRule(operation.dataType);
  const result = validateValue(operation.initialValue, rule);
  return result.valid
    ? { valid: true, error: "" }
    : { valid: false, error: `The starting value does not match ${operation.dataType}.` };
}

function getRelationshipRuleColumns(rule) {
  if (rule.kind === "lookup") return [...new Set([rule.sourceColumn, rule.targetColumn].filter(Boolean))];
  const columns = [rule.targetColumn].filter(Boolean);
  try {
    columns.push(...parseFormula(rule.formula).references);
  } catch {
    // Invalid drafts still depend on their selected target.
  }
  return [...new Set(columns)];
}

function getPresetsForType(type) {
  return VALIDATION_PRESETS.filter((preset) => preset.type === type);
}

function getPreset(presetId) {
  return VALIDATION_PRESETS.find((preset) => preset.id === presetId) ?? VALIDATION_PRESETS[0];
}

function validateRows(rows, columnRules) {
  const issues = [];
  rows.forEach((row, rowIndex) => appendRowIssues(row, rowIndex, columnRules, issues));
  return issues;
}

function validateRowsInChunks(rows, columnRules, options) {
  return processRowsInChunks(
    rows,
    (row, rowIndex, issues) => appendRowIssues(row, rowIndex, columnRules, issues),
    options,
  );
}

function appendRowIssues(row, rowIndex, columnRules, issues) {
  for (const [column, rule] of Object.entries(columnRules)) {
    if (column === "__rowId" || rule.type === UNIDENTIFIED_TYPE) continue;
    const value = row[column];
    if (isMissingValue(value, rule)) {
      const missingIssue = getMissingIssue(row, column, rule);
      if (missingIssue) {
        issues.push({
          row: rowIndex + 1,
          rowId: row.__rowId,
          column,
          expected: `${rule.type}: ${getRuleDisplayName(rule)}`,
          value: missingIssue.value,
          reason: missingIssue.reason,
        });
      }
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

function formatIssueLabel(count) {
  return `${count.toLocaleString()} ${count === 1 ? "issue" : "issues"}`;
}
