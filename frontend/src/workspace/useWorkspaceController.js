import { useReducer } from "react";

export function useWorkspaceController({
  readInitialRelationships,
  createInitialRunStats,
}) {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    { readInitialRelationships, createInitialRunStats },
    createWorkspaceState,
  );
  const set = (field) => (value) => dispatch({ type: "set", field, value });

  return {
    state,
    actions: {
      setRows: set("rows"),
      setColumns: set("columns"),
      setVisibleColumns: set("visibleColumns"),
      setColumnRules: set("columnRules"),
      setFileName: set("fileName"),
      setValidationIssues: set("validationIssues"),
      setLastScannedAt: set("lastScannedAt"),
      setHasUnscannedChanges: set("hasUnscannedChanges"),
      setShowRowNumbers: set("showRowNumbers"),
      setSelectedColumn: set("selectedColumn"),
      setRelationshipRules: set("relationshipRules"),
      setRelationshipIssues: set("relationshipIssues"),
      setSelectedRelationshipFixes: set("selectedRelationshipFixes"),
      setDataBin: set("dataBin"),
      setHistory: set("history"),
      setChallengeEvaluation: set("challengeEvaluation"),
      setRunStats: set("runStats"),
    },
  };
}

function createWorkspaceState({ readInitialRelationships, createInitialRunStats }) {
  return {
    rows: [],
    columns: [],
    visibleColumns: [],
    columnRules: {},
    fileName: "No file loaded",
    validationIssues: [],
    lastScannedAt: null,
    hasUnscannedChanges: false,
    showRowNumbers: true,
    selectedColumn: "",
    relationshipRules: readInitialRelationships(),
    relationshipIssues: [],
    selectedRelationshipFixes: [],
    dataBin: [],
    history: { past: [], future: [] },
    challengeEvaluation: null,
    runStats: createInitialRunStats(),
  };
}

function workspaceReducer(state, action) {
  if (action.type !== "set" || !(action.field in state)) return state;
  const current = state[action.field];
  const next = typeof action.value === "function" ? action.value(current) : action.value;
  return Object.is(current, next) ? state : { ...state, [action.field]: next };
}
