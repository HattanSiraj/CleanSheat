export function parseFormula(formula) {
  const tokens = tokenizeFormula(String(formula ?? ""));
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

export function evaluateFormula(ast, row) {
  if (ast.type === "number") return ast.value;
  if (ast.type === "reference") {
    const value = parseFormulaNumber(row[ast.value]);
    if (value === null) throw new Error(`Input "${ast.value}" is empty or not numeric.`);
    return value;
  }
  if (ast.type === "unary") return -evaluateFormula(ast.value, row);
  const left = evaluateFormula(ast.left, row);
  const right = evaluateFormula(ast.right, row);
  if ((ast.operator === "/" || ast.operator === "%") && right === 0) throw new Error("Cannot divide by zero.");
  if (ast.operator === "+") return left + right;
  if (ast.operator === "-") return left - right;
  if (ast.operator === "*") return left * right;
  if (ast.operator === "/") return left / right;
  return left % right;
}

export function parseFormulaNumber(value) {
  const normalized = String(value ?? "").trim().replaceAll(",", "");
  if (!normalized || !/^-?(?:\d+|\d*\.\d+)$/.test(normalized)) return null;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function formatFormulaNumber(value) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

function tokenizeFormula(formula) {
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
    throw new Error(`Unsupported character "${character}". Use column references like [Amount].`);
  }
  if (!tokens.length) throw new Error("Enter a formula.");
  return tokens;
}
