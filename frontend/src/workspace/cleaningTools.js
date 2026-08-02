export const CLEANING_TOOLS = [
  {
    id: "fillIssues",
    title: "Fill Issues",
    cardDescription: "Repair empty or invalid cells using automatic filling methods",
    description: "Choose what to fill, review the preview, then apply it as one undoable change",
    availability: "issues",
  },
  {
    id: "findReplace",
    title: "Find & Replace",
    cardDescription: "Replace matching values across visible columns",
    description: "Applies across all visible columns, hidden columns are unchanged",
    availability: "visibleColumns",
  },
  {
    id: "missingValues",
    title: "Missing Rules",
    cardDescription: "Decide when blanks and markers like N/A count as problems",
    description: "Choose how blanks and null markers should behave in each column",
    availability: "columns",
  },
  {
    id: "duplicates",
    title: "Find Duplicates",
    cardTitle: "Duplicates",
    cardDescription: "Find repeated rows using the columns you choose",
    description: "Compare selected columns",
    availability: "columns",
  },
  {
    id: "textCleanup",
    title: "Text Cleanup",
    cardDescription: "Fix spacing and capitalization in bulk",
    description: "Fix extra spaces or change how text is capitalized",
    availability: "columns",
  },
  {
    id: "manageColumns",
    title: "Manage Columns",
    cardDescription: "Create, delete, split, or combine columns",
    description: "Create, delete, split, or combine columns",
    availability: "columns",
  },
  {
    id: "dataBin",
    title: "Data Bin",
    cardDescription: "Review and restore rows moved out of the active table",
    description: "Rows stay recoverable here and can be restored or exported separately",
    availability: "always",
  },
];

export function getCleaningTool(toolId) {
  if (toolId === "home") {
    return {
      id: "home",
      title: "Cleaning Tools",
      description: "Choose an action. Every data change includes a preview and Undo support",
    };
  }
  return CLEANING_TOOLS.find((tool) => tool.id === toolId) ?? {
    id: "home",
    title: "Cleaning Tools",
    description: "",
  };
}
