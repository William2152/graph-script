import { ChartDeclaration, Expression } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { ChartConfig, DataSeries } from './types';

export function extractChartConfig(decl: ChartDeclaration, values?: Record<string, GSValue>, traces?: Map<string, Trace>): ChartConfig {
  const config: ChartConfig = {
    title: decl.name,
    type: 'line',
    width: 900,
    height: 480,
  };

  const typeValue = resolveValue(decl.properties.type, values, traces);
  if (typeof typeValue === 'string' && ['bar', 'line', 'scatter', 'pie', 'box', 'area'].includes(typeValue)) {
    config.type = typeValue as ChartConfig['type'];
  }

  const widthValue = resolveValue(decl.properties.width, values, traces);
  if (typeof widthValue === 'number') config.width = widthValue;
  const heightValue = resolveValue(decl.properties.height, values, traces);
  if (typeof heightValue === 'number') config.height = heightValue;

  const xLabelValue = resolveValue(decl.properties.xlabel, values, traces);
  if (typeof xLabelValue === 'string') config.xLabel = xLabelValue;
  const yLabelValue = resolveValue(decl.properties.ylabel, values, traces);
  if (typeof yLabelValue === 'string') config.yLabel = yLabelValue;
  const titleValue = resolveValue(decl.properties.title, values, traces);
  if (typeof titleValue === 'string') config.title = titleValue;

  const labelValue = resolveValue(decl.properties.labels, values, traces);
  const labels = asStringArray(labelValue);
  if (labels.length) config.labels = labels;

  return config;
}

export function buildChartSeries(
  decl: ChartDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): DataSeries[] {
  const sourceValue = resolveValue(decl.properties.source, values, traces);
  const xValue = resolveValue(decl.properties.x, values, traces);
  const yValue = resolveValue(decl.properties.y, values, traces);
  const labelValue = resolveValue(decl.properties.labels, values, traces);
  const explicitLabels = asStringArray(labelValue);
  const xLabels = asStringArray(xValue);
  const labels = explicitLabels.length ? explicitLabels : xLabels;

  const trace = sourceValue && typeof sourceValue === 'object' && (sourceValue as Trace).type === 'trace'
    ? sourceValue as Trace
    : resolveTraceFromExpression(decl.properties.source, traces);

  if (trace) {
    const xColumn = expressionToFieldName(decl.properties.x) ?? firstNumericColumn(trace) ?? trace.columns[0];
    const yColumn = expressionToFieldName(decl.properties.y) ?? secondNumericColumn(trace, xColumn) ?? firstNumericColumn(trace) ?? trace.columns[0];
    const labelColumn = expressionToFieldName(decl.properties.labels) ?? firstStringColumn(trace);
    const x = numericColumn(trace, xColumn);
    const y = numericColumn(trace, yColumn);
    const traceLabels = labelColumn ? stringColumn(trace, labelColumn) : undefined;
    if (y.length) return [{ name: yColumn, x: x.length === y.length ? x : undefined, y, labels: traceLabels }];
  }

  const sourceMatrix = asNumberMatrix(sourceValue);
  if (sourceMatrix.length > 1) {
    return sourceMatrix.map((row, idx) => ({
      name: labels[idx] ?? `Series ${idx + 1}`,
      y: row,
    }));
  }

  const yMatrix = asNumberMatrix(yValue);
  if (yMatrix.length > 1) {
    return yMatrix.map((row, idx) => ({
      name: labels[idx] ?? `Series ${idx + 1}`,
      x: asNumberArray(xValue),
      y: row,
      labels,
    }));
  }

  const x = asNumberArray(xValue);
  const y = asNumberArray(yValue ?? sourceValue);
  if (y.length) {
    return [{
      name: expressionToFieldName(decl.properties.y) ?? expressionToFieldName(decl.properties.source) ?? 'series',
      x: x.length === y.length ? x : undefined,
      y,
      labels,
    }];
  }

  return Object.entries(values)
    .filter(([, value]) => Array.isArray(value) && value.every((item) => typeof item === 'number'))
    .map(([name, value]) => ({ name, y: value as number[] }));
}

function resolveTraceFromExpression(expr: Expression | undefined, traces: Map<string, Trace>): Trace | undefined {
  if (!expr || expr.type !== 'MemberExpression' || expr.property !== 'trace' || expr.object.type !== 'Identifier') return undefined;
  return traces.get(expr.object.name);
}

function resolveValue(expr: Expression | undefined, values?: Record<string, GSValue>, traces?: Map<string, Trace>): any {
  if (!expr) return undefined;
  switch (expr.type) {
    case 'Literal':
      return expr.value;
    case 'Identifier':
      return values && expr.name in values ? values[expr.name] : expr.name;
    case 'ArrayExpression':
      return expr.elements.map((element) => resolveValue(element, values, traces));
    case 'ObjectExpression':
      return Object.fromEntries(expr.properties.map((prop) => [prop.key, resolveValue(prop.value, values, traces)]));
    case 'MemberExpression': {
      if (expr.property === 'trace' && expr.object.type === 'Identifier') return traces?.get(expr.object.name);
      const object = resolveValue(expr.object, values, traces);
      return object && typeof object === 'object' ? object[expr.property] : undefined;
    }
    case 'IndexExpression': {
      const object = resolveValue(expr.object, values, traces);
      const index = resolveValue(expr.index, values, traces);
      return Array.isArray(object) ? object[index] : object?.[index];
    }
    default:
      return undefined;
  }
}

function expressionToFieldName(expr?: Expression): string | undefined {
  if (!expr) return undefined;
  if (expr.type === 'Identifier') return expr.name;
  if (expr.type === 'Literal' && typeof expr.value === 'string') return expr.value;
  return undefined;
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asNumberMatrix(value: unknown): number[][] {
  if (!Array.isArray(value) || !value.length || !Array.isArray(value[0])) return [];
  return value
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.filter((item): item is number => typeof item === 'number'))
    .filter((row) => row.length > 0);
}

function numericColumn(trace: Trace, column: string): number[] {
  return trace.rows.map((row) => row[column]).filter((value): value is number => typeof value === 'number');
}

function stringColumn(trace: Trace, column: string): string[] {
  return trace.rows.map((row) => row[column]).filter((value): value is string => typeof value === 'string');
}

function firstNumericColumn(trace: Trace): string | undefined {
  return trace.columns.find((column) => trace.rows.some((row) => typeof row[column] === 'number'));
}

function secondNumericColumn(trace: Trace, exclude?: string): string | undefined {
  return trace.columns.find((column) => column !== exclude && trace.rows.some((row) => typeof row[column] === 'number'));
}

function firstStringColumn(trace: Trace): string | undefined {
  return trace.columns.find((column) => trace.rows.some((row) => typeof row[column] === 'string'));
}
