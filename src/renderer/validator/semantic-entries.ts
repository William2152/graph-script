import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { SemanticRoleEntry } from './types';
import { getBooleanProperty, getNumberProperty, getStringProperty, resolveElementBox } from './helpers';

/**
 * Collects semantic role metadata from rendered diagram elements.
 * Includes synthetic title/subtitle entries for semantic panels/boxes.
 */
export function collectSemanticRoleEntries(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
  parentId?: string,
): SemanticRoleEntry[] {
  const entries: SemanticRoleEntry[] = [];

  for (const element of elements) {
    const box = resolveElementBox(element, values, traces, offsetX, offsetY);
    const role = getStringProperty(element, values, traces, 'semantic_role', '');
    if (role) {
      entries.push({
        id: element.name,
        type: element.type,
        role,
        size: getNumberProperty(element, values, traces, 'size', 0),
        box,
        parentId,
        connectorFrom: getStringProperty(element, values, traces, 'connector_from', ''),
        connectorTo: getStringProperty(element, values, traces, 'connector_to', ''),
        unplaced: getBooleanProperty(element, values, traces, 'connector_label_unplaced', false),
      });
    }

    if ((element.type === 'panel' || element.type === 'box') && box) {
      const label = getStringProperty(element, values, traces, 'label', '');
      const labelRole = getStringProperty(element, values, traces, 'semantic_label_role', '');
      if (label && labelRole) {
        const titleSize = getNumberProperty(element, values, traces, 'title_size', getNumberProperty(element, values, traces, 'size', 16));
        const titleHeight = Math.max(titleSize * 1.3, 26);
        entries.push({
          id: `${element.name}#title`,
          type: 'text',
          role: labelRole,
          size: titleSize,
          box: {
            id: `${element.name}#title`,
            type: 'text',
            x: box.x + 14,
            y: box.y + 18,
            width: Math.max(24, box.width - 28),
            height: titleHeight,
            allowOverlap: false,
          },
          parentId: element.name,
        });
      }

      const subtitle = getStringProperty(element, values, traces, 'subtitle', '');
      const subtitleRole = getStringProperty(element, values, traces, 'semantic_subtitle_role', '');
      if (subtitle && subtitleRole) {
        const titleSize = getNumberProperty(element, values, traces, 'title_size', getNumberProperty(element, values, traces, 'size', 16));
        const subtitleSize = getNumberProperty(element, values, traces, 'subtitle_size', 14);
        const titleHeight = label ? Math.max(titleSize * 1.3, 26) + 8 : 0;
        entries.push({
          id: `${element.name}#subtitle`,
          type: 'text',
          role: subtitleRole,
          size: subtitleSize,
          box: {
            id: `${element.name}#subtitle`,
            type: 'text',
            x: box.x + 16,
            y: box.y + 20 + titleHeight,
            width: Math.max(24, box.width - 32),
            height: Math.max(subtitleSize * 1.35, 22),
            allowOverlap: false,
          },
          parentId: element.name,
        });
      }
    }

    if (element.children?.length) {
      const childOffsetX = offsetX + getNumberProperty(element, values, traces, 'x', 0);
      const childOffsetY = offsetY + getNumberProperty(element, values, traces, 'y', 0);
      entries.push(...collectSemanticRoleEntries(element.children, values, traces, childOffsetX, childOffsetY, element.name));
    }
  }

  return entries;
}
