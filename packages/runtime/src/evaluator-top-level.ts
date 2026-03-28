import { AstNode } from '@graphscript/ast';
import { GSAlgorithm, GSFunction, GSValue, Trace } from './values';

interface TopLevelOps {
  evalExpression(expr: any): GSValue;
  createFunction(params: string[], body: any[]): GSFunction;
}

/**
 * Handles top-level declaration execution for runtime evaluator.
 */
export function executeTopLevelNode(
  node: AstNode,
  ops: TopLevelOps,
  scopeValues: Record<string, GSValue>,
  algorithms: Record<string, GSAlgorithm>,
  traces: Record<string, Trace>,
): void {
  switch (node.type) {
    case 'UseStatement':
    case 'ImportStatement':
    case 'ThemeDeclaration':
    case 'StyleDeclaration':
    case 'ComponentDeclaration':
    case 'PseudoDeclaration':
      break;
    case 'ConstDeclaration':
      scopeValues[node.name] = ops.evalExpression(node.value);
      break;
    case 'DataDeclaration':
      for (const binding of node.bindings) {
        scopeValues[binding.name] = ops.evalExpression(binding.value);
      }
      break;
    case 'FuncDeclaration':
      scopeValues[node.name] = ops.createFunction(node.params, node.body);
      break;
    case 'SubDeclaration':
      scopeValues[node.name] = ops.createFunction(node.params, node.body);
      break;
    case 'AlgoDeclaration': {
      const algo: GSAlgorithm = {
        type: 'algorithm',
        name: node.name,
        params: node.params,
        body: node.body,
        trace: { type: 'trace', columns: [], rows: [] },
      };
      algorithms[node.name] = algo;
      traces[node.name] = algo.trace;
      scopeValues[node.name] = algo;
      break;
    }
    case 'ChartDeclaration':
    case 'FlowDeclaration':
    case 'DiagramDeclaration':
    case 'TableDeclaration':
    case 'Plot3dDeclaration':
    case 'Scene3dDeclaration':
    case 'ErdDeclaration':
    case 'InfraDeclaration':
    case 'PageDeclaration':
    case 'RenderDeclaration':
      scopeValues[node.name] = node;
      break;
  }
}
