export function getCircularFormulaRuleIds(rules) {
  const formulaRules = rules.filter((rule) => rule.kind === "formula" && rule.targetColumn);
  const targetColumns = new Set(formulaRules.map((rule) => rule.targetColumn));
  const graph = new Map([...targetColumns].map((column) => [column, new Set()]));

  for (const rule of formulaRules) {
    const dependencies = graph.get(rule.targetColumn);
    for (const reference of rule.references ?? []) {
      if (targetColumns.has(reference)) dependencies.add(reference);
    }
  }

  const circularTargets = new Set([...targetColumns].filter((target) => reachesTarget(
    graph,
    target,
    graph.get(target),
  )));
  return new Set(formulaRules
    .filter((rule) => circularTargets.has(rule.targetColumn))
    .map((rule) => rule.id));
}

function reachesTarget(graph, target, startingColumns) {
  const pending = [...startingColumns];
  const visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(graph.get(current) ?? []));
  }
  return false;
}
