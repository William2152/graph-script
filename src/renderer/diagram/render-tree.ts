import { DiagramElement } from '../../ast/types';
import { round } from '../common';
import { createChildRenderContext, createElementRenderState, DiagramRenderContext, ElementRenderState } from './render-state';
import {
  renderBadgeOrCallout,
  renderChecker,
  renderCircle,
  renderEllipse,
  renderFormula,
  renderGrid,
  renderImage,
  renderLineOrArrow,
  renderPanelOrBox,
  renderText,
} from './render-shapes';
import { renderEmbedElement, renderFallback } from './render-embedded';

export async function renderElements(elements: DiagramElement[], ctx: DiagramRenderContext): Promise<string> {
  const rendered = await Promise.all(elements.map((element) => renderElement(element, ctx)));
  return rendered.join('');
}

async function renderElement(element: DiagramElement, ctx: DiagramRenderContext): Promise<string> {
  const state = createElementRenderState(element, ctx);
  let svg = '';
  if (state.shadow) svg += renderElementShadow(state);

  const renderedSelf = await renderElementBody(element, state);
  svg += renderedSelf;
  if (element.children?.length && shouldRenderChildren(element.type)) {
    const childCtx = createChildRenderContext(state, state.x, state.y, state.fontFamily);
    svg += await renderElements(element.children, childCtx);
  }
  return svg;
}

async function renderElementBody(element: DiagramElement, state: ElementRenderState): Promise<string> {
  switch (element.type) {
    case 'graph':
    case 'node':
    case 'edge':
      throw new Error(`Unexpected raw "${element.type}" element "${element.name}" during render. Graph elements must be compiled before rendering.`);
    case 'panel':
    case 'box':
      return renderPanelOrBox(state);
    case 'grid':
      return renderGrid(state);
    case 'checker':
      return renderChecker(state);
    case 'text':
      return renderText(state);
    case 'formula':
      return renderFormula(state);
    case 'circle':
      return renderCircle(state);
    case 'ellipse':
      return renderEllipse(state);
    case 'badge':
    case 'callout':
      return renderBadgeOrCallout(state);
    case 'image':
      return renderImage(state);
    case 'arrow':
    case 'line':
      return renderLineOrArrow(state);
    case 'embed':
      return renderEmbedElement(state);
    default:
      return renderFallback(state);
  }
}

function renderElementShadow(state: ElementRenderState): string {
  return `<rect x="${round(state.x + 6)}" y="${round(state.y + 8)}" width="${round(state.w)}" height="${round(state.h)}" rx="${state.radius}" fill="#94a3b8" fill-opacity="0.12"/>`;
}

function shouldRenderChildren(type: string): boolean {
  return type !== 'embed';
}
