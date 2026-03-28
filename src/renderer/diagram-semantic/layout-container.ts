import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { ChildLayout, ContainerOptions } from './types';
import { offsetChildren, resolveAlignedX } from './helpers';
import { measureChild } from './layout-child-measure';

/**
 * Lays out card child elements based on semantic container options.
 * Supports stack, row, and columns, and recursively handles nested groups.
 */
export async function layoutContainerChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number = 1,
  fillImages: boolean = false,
  fontScale: number = 1,
): Promise<ChildLayout> {
  if (!children.length) return { width, height: 0, elements: [] };
  if (options.layout === 'row') return layoutRowChildren(children, width, options, values, traces, fontFamily, imageScale, fillImages, fontScale);
  if (options.layout === 'columns') return layoutColumnChildren(children, width, options, values, traces, fontFamily, imageScale, fillImages, fontScale);
  return layoutStackChildren(children, width, options, values, traces, fontFamily, imageScale, fillImages, fontScale);
}

async function layoutStackChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number,
  fillImages: boolean,
  fontScale: number,
): Promise<ChildLayout> {
  let cursorY = 0;
  let usedWidth = 0;
  const elements: DiagramElement[] = [];
  for (const child of children) {
    const measured = await measureChild(
      child,
      width,
      values,
      traces,
      fontFamily,
      imageScale,
      fillImages,
      fontScale,
      layoutContainerChildren,
    );
    const x = resolveAlignedX(options.align, width, measured.width);
    usedWidth = Math.max(usedWidth, measured.width);
    elements.push(...offsetChildren(measured.elements, x, cursorY));
    cursorY += measured.height + options.gap;
  }
  const height = Math.max(0, cursorY - options.gap);
  return { width: Math.min(width, usedWidth || width), height, elements };
}

async function layoutRowChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number,
  fillImages: boolean,
  fontScale: number,
): Promise<ChildLayout> {
  const count = Math.max(children.length, 1);
  const naturalMeasured: ChildLayout[] = [];
  for (const child of children) {
    naturalMeasured.push(await measureChild(
      child,
      width,
      values,
      traces,
      fontFamily,
      imageScale,
      fillImages,
      fontScale,
      layoutContainerChildren,
    ));
  }
  const naturalTotalWidth = naturalMeasured.reduce((sum, entry) => sum + entry.width, 0) + options.gap * Math.max(0, naturalMeasured.length - 1);

  let measured = naturalMeasured;
  let totalWidth = naturalTotalWidth;
  if (naturalTotalWidth > width + 8) {
    const compactMeasured = await measureRowChildrenToFit(
      children,
      naturalMeasured,
      width,
      options,
      values,
      traces,
      fontFamily,
      imageScale,
      fillImages,
      fontScale,
    );
    const compactTotalWidth = compactMeasured.reduce((sum, entry) => sum + entry.width, 0) + options.gap * Math.max(0, compactMeasured.length - 1);
    if (compactTotalWidth > width + 8 && children.length > 1) {
      return layoutStackChildren(
        children,
        width,
        { ...options, align: options.align === 'stretch' ? 'stretch' : 'center' },
        values,
        traces,
        fontFamily,
        imageScale,
        fillImages,
        fontScale,
      );
    }
    measured = compactMeasured;
    totalWidth = compactTotalWidth;
  }

  const rowHeight = Math.max(...measured.map((entry) => entry.height), 48);
  let cursorX = resolveAlignedX(options.align, width, totalWidth);
  const elements: DiagramElement[] = [];
  measured.forEach((entry) => {
    const y = (rowHeight - entry.height) / 2;
    elements.push(...offsetChildren(entry.elements, cursorX, y));
    cursorX += entry.width + options.gap;
  });
  return { width: Math.min(width, totalWidth), height: rowHeight, elements };
}

async function measureRowChildrenToFit(
  children: DiagramElement[],
  naturalMeasured: ChildLayout[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number,
  fillImages: boolean,
  fontScale: number,
): Promise<ChildLayout[]> {
  const count = Math.max(children.length, 1);
  const availableWidth = Math.max(84 * count, width - options.gap * Math.max(0, count - 1));
  const fixedIndices = children
    .map((child, index) => (child.properties.w != null && child.type !== 'image' ? index : -1))
    .filter((index) => index >= 0);
  const flexibleIndices = children
    .map((child, index) => (child.properties.w == null || child.type === 'image' ? index : -1))
    .filter((index) => index >= 0);

  if (!flexibleIndices.length) {
    const budget = Math.max(84, availableWidth / count);
    return Promise.all(children.map((child) =>
      measureChild(child, budget, values, traces, fontFamily, imageScale, fillImages, fontScale, layoutContainerChildren)));
  }

  const fixedWidth = fixedIndices.reduce((sum, index) => sum + naturalMeasured[index].width, 0);
  if (fixedWidth >= availableWidth - 8) {
    const budget = Math.max(84, availableWidth / count);
    return Promise.all(children.map((child) =>
      measureChild(child, budget, values, traces, fontFamily, imageScale, fillImages, fontScale, layoutContainerChildren)));
  }

  const flexibleNaturalWidth = flexibleIndices.reduce((sum, index) => sum + Math.max(84, naturalMeasured[index].width), 0);
  const remainingWidth = Math.max(84 * flexibleIndices.length, availableWidth - fixedWidth);
  const budgets = new Map<number, number>();
  for (const index of fixedIndices) budgets.set(index, naturalMeasured[index].width);

  let allocatedFlexibleWidth = 0;
  flexibleIndices.forEach((index, position) => {
    const isLast = position === flexibleIndices.length - 1;
    const naturalWidth = Math.max(84, naturalMeasured[index].width);
    const share = flexibleNaturalWidth > 0 ? remainingWidth * (naturalWidth / flexibleNaturalWidth) : remainingWidth / flexibleIndices.length;
    const budget = isLast
      ? Math.max(84, remainingWidth - allocatedFlexibleWidth)
      : Math.max(84, share);
    budgets.set(index, budget);
    allocatedFlexibleWidth += budget;
  });

  return Promise.all(children.map((child, index) =>
    measureChild(
      child,
      Math.max(84, budgets.get(index) ?? (availableWidth / count)),
      values,
      traces,
      fontFamily,
      imageScale,
      fillImages,
      fontScale,
      layoutContainerChildren,
    )));
}

async function layoutColumnChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number,
  fillImages: boolean,
  fontScale: number,
): Promise<ChildLayout> {
  const columns = Math.max(1, options.columns);
  const cellWidth = (width - options.gap * (columns - 1)) / columns;
  const measured = await Promise.all(children.map((child) =>
    measureChild(child, cellWidth, values, traces, fontFamily, imageScale, fillImages, fontScale, layoutContainerChildren)));
  const rowHeights = new Map<number, number>();
  measured.forEach((entry, index) => {
    const row = Math.floor(index / columns);
    rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, entry.height));
  });

  const elements: DiagramElement[] = [];
  let totalHeight = 0;
  for (let index = 0; index < measured.length; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const y = totalHeight + rowOffset(rowHeights, row, options.gap);
    const rowHeight = rowHeights.get(row) ?? measured[index].height;
    const localX = col * (cellWidth + options.gap) + resolveAlignedX(options.align, cellWidth, measured[index].width);
    const localY = y + (rowHeight - measured[index].height) / 2;
    elements.push(...offsetChildren(measured[index].elements, localX, localY));
  }

  const compactColumnWidths = new Map<number, number>();
  measured.forEach((entry, index) => {
    const col = index % columns;
    compactColumnWidths.set(col, Math.max(compactColumnWidths.get(col) ?? 0, entry.width));
  });
  let usedWidth = 0;
  for (let col = 0; col < columns; col += 1) usedWidth += compactColumnWidths.get(col) ?? 0;
  if (columns > 1) usedWidth += options.gap * (columns - 1);

  if (rowHeights.size > 0) totalHeight = [...rowHeights.values()].reduce((sum, value) => sum + value, 0) + options.gap * Math.max(0, rowHeights.size - 1);
  return { width: Math.min(width, usedWidth || width), height: totalHeight, elements };
}

function rowOffset(rowHeights: Map<number, number>, row: number, gap: number): number {
  let offset = 0;
  for (let current = 0; current < row; current += 1) offset += (rowHeights.get(current) ?? 0) + gap;
  return offset;
}
