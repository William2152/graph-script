import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { resolveValue } from '../common';
import { compileGraphElement } from '../graph';
import { measureDisplayFormula, measureRichTextBlock, readLatexMode } from '../latex';
import {
  BODY_TEXT_MIN,
  CHILD_GAP_MIN,
  FORMULA_TEXT_MIN,
  MIN_ASSET_HEIGHT,
  MIN_ASSET_WIDTH,
  ChildLayout,
  ContainerOptions,
} from './types';
import {
  alignToAnchor,
  clamp,
  cloneElement,
  element,
  getBoolean,
  getNumber,
  getString,
  offsetChildren,
  readContainerOptions,
} from './helpers';

type LayoutChildrenFn = (
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale?: number,
  fillImages?: boolean,
  fontScale?: number,
) => Promise<ChildLayout>;

/**
 * Measures a semantic child element for container layout.
 * Recursion for `group` goes through callback to avoid module cycles.
 */
export async function measureChild(
  child: DiagramElement,
  maxWidth: number,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number,
  fillImages: boolean,
  fontScale: number,
  layoutChildren: LayoutChildrenFn,
): Promise<ChildLayout> {
  switch (child.type) {
    case 'text': {
      const baseFontSize = Math.max(BODY_TEXT_MIN, getNumber(child, values, traces, 'size', BODY_TEXT_MIN));
      const size = baseFontSize * fontScale;
      const value = getString(child, values, traces, 'value', child.name);
      const weight = getString(child, values, traces, 'weight', '600');
      const align = getString(child, values, traces, 'align', 'center');
      const latex = readLatexMode(resolveValue(child.properties.latex, values, traces), 'auto');
      const metrics = await measureRichTextBlock(value, {
        x: 0,
        y: 0,
        maxWidth,
        fontSize: size,
        weight,
        anchor: alignToAnchor(align),
        latex,
        maxLines: Math.max(2, getNumber(child, values, traces, 'max_lines', 6)),
        fontFamily,
      });
      const width = Math.min(maxWidth, Math.max(24, metrics.width));
      const height = Math.max(size, metrics.height);
      return {
        width,
        height,
        elements: [
          cloneElement(child, {
            x: align === 'start' ? 0 : align === 'end' ? width : width / 2,
            y: 0,
            w: width,
            h: height,
            anchor: alignToAnchor(align),
            size,
            latex,
            font_family: fontFamily,
            math_fallback: metrics.mathFallbackCount > 0,
            normalized_value: metrics.normalizedValue,
            min_gap: CHILD_GAP_MIN,
            semantic_role: getString(child, values, traces, 'semantic_role', 'body_text'),
          }),
        ],
      };
    }
    case 'formula': {
      const baseFontSize = Math.max(FORMULA_TEXT_MIN, getNumber(child, values, traces, 'size', FORMULA_TEXT_MIN));
      const size = baseFontSize * fontScale;
      const value = getString(child, values, traces, 'value', child.name);
      const metrics = await measureDisplayFormula(value, { fontSize: size });
      const constrainedWidth = Math.min(Math.max(metrics.width, 48), maxWidth);
      return {
        width: constrainedWidth,
        height: metrics.height,
        elements: [
          cloneElement(child, {
            x: constrainedWidth / 2,
            y: metrics.ascent,
            w: constrainedWidth,
            h: metrics.height,
            ascent: metrics.ascent,
            size,
            math_fallback: metrics.fallback,
            normalized_value: metrics.normalizedValue,
            min_gap: CHILD_GAP_MIN,
            semantic_role: getString(child, values, traces, 'semantic_role', 'display_formula'),
          }),
        ],
      };
    }
    case 'image': {
      let naturalWidth = Math.max(1, getNumber(child, values, traces, 'w', Math.min(maxWidth, 180)));
      let naturalHeight = Math.max(1, getNumber(child, values, traces, 'h', 82));
      const minWidth = Math.min(maxWidth, Math.max(MIN_ASSET_WIDTH, getNumber(child, values, traces, 'min_w', MIN_ASSET_WIDTH)));
      const minHeight = Math.max(MIN_ASSET_HEIGHT, getNumber(child, values, traces, 'min_h', MIN_ASSET_HEIGHT));

      if (fillImages) {
        naturalWidth = Math.min(maxWidth, naturalWidth * 1.5);
        naturalHeight = Math.min(maxWidth * (naturalHeight / naturalWidth), naturalHeight * 1.5);
      }

      const desiredWidth = naturalWidth * imageScale;
      const desiredHeight = naturalHeight * imageScale;
      const width = clamp(desiredWidth, minWidth, maxWidth);
      let height = desiredHeight;
      if (height < minHeight * imageScale) height = minHeight * imageScale;

      return {
        width,
        height,
        elements: [
          cloneElement(child, {
            x: 0,
            y: 0,
            w: width,
            h: height,
            semantic_role: getString(child, values, traces, 'semantic_role', 'asset'),
          }),
        ],
      };
    }
    case 'graph': {
      const compiled = compileGraphElement(child, values, traces, {
        includeOwnPosition: false,
        defaultWidth: maxWidth,
        maxWidth,
      });
      return { width: compiled.width, height: compiled.height, elements: compiled.elements };
    }
    case 'divider': {
      const label = getString(child, values, traces, 'label', '');
      const stroke = getString(child, values, traces, 'stroke', '#cbd5e1');
      const strokeWidth = getNumber(child, values, traces, 'strokeWidth', 1.6);
      const textSize = Math.max(BODY_TEXT_MIN, getNumber(child, values, traces, 'size', BODY_TEXT_MIN));
      let labelHeight = 0;
      const elements: DiagramElement[] = [];
      if (label) {
        const labelMetrics = await measureRichTextBlock(label, {
          x: maxWidth / 2,
          y: 0,
          maxWidth: maxWidth * 0.75,
          fontSize: textSize,
          weight: getString(child, values, traces, 'weight', '700'),
          anchor: 'middle',
          latex: readLatexMode(resolveValue(child.properties.latex, values, traces), 'auto'),
          maxLines: 2,
          fontFamily,
        });
        labelHeight = labelMetrics.height + 8;
        elements.push(element('text', `${child.name}-label`, {
          x: maxWidth / 2,
          y: 0,
          w: maxWidth * 0.75,
          h: labelMetrics.height,
          anchor: 'middle',
          value: label,
          size: textSize,
          weight: getString(child, values, traces, 'weight', '700'),
          color: getString(child, values, traces, 'color', '#64748b'),
          font_family: fontFamily,
          validation_ignore: true,
          semantic_role: 'body_text',
        }));
      }
      elements.push(element('line', `${child.name}-line`, {
        x: 0,
        y: labelHeight + strokeWidth,
        x2: maxWidth,
        y2: labelHeight + strokeWidth,
        stroke,
        strokeWidth,
        validation_ignore: true,
        semantic_role: 'decorative',
      }));
      return {
        width: maxWidth,
        height: labelHeight + strokeWidth * 2 + 6,
        elements,
      };
    }
    case 'spacer': {
      const height = Math.max(0, getNumber(child, values, traces, 'h', getNumber(child, values, traces, 'size', CHILD_GAP_MIN)));
      return { width: 0, height, elements: [] };
    }
    case 'group': {
      const padding = Math.max(0, getNumber(child, values, traces, 'padding', 0));
      const gap = Math.max(CHILD_GAP_MIN, getNumber(child, values, traces, 'gap', CHILD_GAP_MIN));
      const layout = readContainerOptions(child, values, traces, 'stack', gap);
      const hasExplicitWidth = child.properties.w != null;
      const stretchWidth = !hasExplicitWidth && layout.align === 'stretch';
      let groupWidth = stretchWidth
        ? maxWidth
        : Math.min(maxWidth, Math.max(80, getNumber(child, values, traces, 'w', maxWidth)));
      let innerWidth = Math.max(60, groupWidth - padding * 2);
      let content = await layoutChildren(child.children ?? [], innerWidth, layout, values, traces, fontFamily, imageScale, fillImages, fontScale);
      if (!hasExplicitWidth && !stretchWidth) {
        groupWidth = clamp(content.width + padding * 2, 80, maxWidth);
        innerWidth = Math.max(60, groupWidth - padding * 2);
        content = await layoutChildren(child.children ?? [], innerWidth, layout, values, traces, fontFamily, imageScale, fillImages, fontScale);
      }
      const fill = getString(child, values, traces, 'fill', 'none');
      const stroke = getString(child, values, traces, 'stroke', 'none');
      const visible = fill !== 'none' || stroke !== 'none' || getBoolean(child, values, traces, 'show_box', false);
      const groupHeight = Math.max(getNumber(child, values, traces, 'min_h', 0), content.height + padding * 2);
      const box = element('box', child.name, {
        x: 0,
        y: 0,
        w: groupWidth,
        h: groupHeight,
        label: '',
        fill,
        stroke,
        radius: getNumber(child, values, traces, 'radius', 12),
        shadow: false,
        strokeWidth: getNumber(child, values, traces, 'strokeWidth', 1.4),
        validation_ignore: !visible,
        min_gap: layout.gap,
        semantic_role: 'group',
      }, offsetChildren(content.elements, padding, padding));
      return { width: groupWidth, height: groupHeight, elements: [box] };
    }
    default: {
      const width = Math.min(maxWidth, getNumber(child, values, traces, 'w', maxWidth));
      const height = getNumber(child, values, traces, 'h', 40);
      return {
        width,
        height,
        elements: [cloneElement(child, { x: 0, y: 0, w: width, h: height })],
      };
    }
  }
}
