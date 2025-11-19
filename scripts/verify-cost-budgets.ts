import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface Budget {
  id: string;
  cpuBudget: number;
  bandwidthGb: number;
}

interface CostReportEntry {
  cpuHours: number;
  egressGb: number;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

const budgetsPath = resolve('shared/config/cost-budgets.json');
const reportPath = resolve('reports/cost/latest.json');

if (!existsSync(budgetsPath)) {
  console.warn('[verify-cost] budgets file missing, skipping check');
  process.exit(0);
}

const budgets = loadJson<{ features: Budget[] }>(budgetsPath);

if (!existsSync(reportPath)) {
  console.warn('[verify-cost] no cost telemetry found, skipping check');
  process.exit(0);
}

const report = loadJson<Record<string, CostReportEntry>>(reportPath);

const violations: string[] = [];

for (const budget of budgets.features) {
  const entry = report[budget.id];
  if (!entry) continue;
  const cpuRatio = entry.cpuHours / budget.cpuBudget;
  const bwRatio = entry.egressGb / budget.bandwidthGb;
  if (cpuRatio > 1 || bwRatio > 1) {
    violations.push(
      `${budget.id} exceeds budget (cpu ${entry.cpuHours}/${budget.cpuBudget}, ` +
        `bandwidth ${entry.egressGb}/${budget.bandwidthGb})`
    );
  }
}

if (violations.length > 0) {
  console.error('[verify-cost] budget violations detected:\n- ' + violations.join('\n- '));
  process.exit(1);
}

console.log('[verify-cost] all features within budgets');

