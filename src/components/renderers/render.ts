// D3 rendering of a single execution Step. Everything is drawn with CSS classes
// (no hard-coded colors) so light/dark theming lives entirely in CSS.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { select, type Selection } from 'd3-selection';
import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { hierarchy, tree } from 'd3-hierarchy';
import type { CallFrame, Step, VizMap, VizObject, VizSet, VizValue } from '../../engine/types';
import { isTagged } from '../../engine/types';
import { CHILD_FIELDS, VALUE_FIELDS, classify, isStructural } from './classify';

const CELL = 46;
const GAP = 6;

function primitiveText(v: VizValue): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  if (isTagged(v)) {
    if (v.__kind === 'function') return `ƒ ${v.name}`;
    if (v.__kind === 'object') return v.className ?? '{…}';
    return v.__kind;
  }
  return String(v);
}

function shortText(v: VizValue): string {
  if (v === null) return '·';
  if (typeof v === 'string') return v.length > 6 ? v.slice(0, 5) + '…' : v;
  if (typeof v === 'object') return '{}';
  return String(v);
}

function nodeValueField(o: VizObject): VizValue {
  for (const f of VALUE_FIELDS) if (f in o.fields) return o.fields[f];
  return null;
}

function block(parent: Selection<any, any, any, any>, label: string) {
  const wrap = parent.append('div').attr('class', 'viz-block');
  wrap.append('div').attr('class', 'viz-block-label').text(label);
  return wrap.append('div').attr('class', 'viz-block-body');
}

// --- 1D array --------------------------------------------------------------

function renderArray1d(parent: any, name: string, arr: VizValue[], prev?: VizValue[]) {
  const body = block(parent, `${name}  ·  array[${arr.length}]`);
  const width = Math.max(arr.length * (CELL + GAP) + GAP, CELL + GAP);
  const svg = body.append('svg').attr('width', width).attr('height', CELL + 34);

  const cells = svg
    .selectAll('g.cell')
    .data(arr)
    .enter()
    .append('g')
    .attr('class', 'cell')
    .attr('transform', (_d, i) => `translate(${GAP + i * (CELL + GAP)}, 6)`);

  cells
    .append('rect')
    .attr('width', CELL)
    .attr('height', CELL)
    .attr('rx', 8)
    .attr('class', (_d, i) => {
      const changed = prev && JSON.stringify(prev[i]) !== JSON.stringify(arr[i]);
      return `viz-cell${changed ? ' viz-cell-changed' : ''}`;
    });

  cells
    .append('text')
    .attr('x', CELL / 2)
    .attr('y', CELL / 2 + 5)
    .attr('text-anchor', 'middle')
    .attr('class', 'viz-cell-text')
    .text((d) => shortText(d));

  cells
    .append('text')
    .attr('x', CELL / 2)
    .attr('y', CELL + 22)
    .attr('text-anchor', 'middle')
    .attr('class', 'viz-index-text')
    .text((_d, i) => i);
}

// --- 2D array / matrix -----------------------------------------------------

function renderArray2d(parent: any, name: string, grid: VizValue[]) {
  const rows = grid as VizValue[][];
  const cols = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0)), 0);
  const body = block(parent, `${name}  ·  matrix[${rows.length}×${cols}]`);
  const svg = body
    .append('svg')
    .attr('width', cols * (CELL + GAP) + GAP)
    .attr('height', rows.length * (CELL + GAP) + GAP);

  rows.forEach((row, r) => {
    const cellsData = Array.isArray(row) ? row : [];
    const g = svg
      .selectAll(`g.r${r}`)
      .data(cellsData)
      .enter()
      .append('g')
      .attr('transform', (_d, c) => `translate(${GAP + c * (CELL + GAP)}, ${GAP + r * (CELL + GAP)})`);
    g.append('rect').attr('width', CELL).attr('height', CELL).attr('rx', 6).attr('class', 'viz-cell');
    g.append('text')
      .attr('x', CELL / 2)
      .attr('y', CELL / 2 + 5)
      .attr('text-anchor', 'middle')
      .attr('class', 'viz-cell-text')
      .text((d) => shortText(d));
  });
}

// --- Map / Set / Object ----------------------------------------------------

function renderMap(parent: any, name: string, map: VizMap) {
  const body = block(parent, `${name}  ·  map{${map.entries.length}}`);
  const table = body.append('table').attr('class', 'viz-kv');
  const rows = table.append('tbody').selectAll('tr').data(map.entries).enter().append('tr');
  rows.append('td').attr('class', 'viz-kv-key').text((d) => primitiveText(d[0]));
  rows.append('td').attr('class', 'viz-kv-arrow').text('→');
  rows.append('td').attr('class', 'viz-kv-val').text((d) => primitiveText(d[1]));
}

function renderSet(parent: any, name: string, set: VizSet) {
  const body = block(parent, `${name}  ·  set{${set.items.length}}`);
  body
    .append('div')
    .attr('class', 'viz-chips')
    .selectAll('span')
    .data(set.items)
    .enter()
    .append('span')
    .attr('class', 'viz-chip')
    .text((d) => primitiveText(d));
}

function renderObject(parent: any, name: string, obj: VizObject) {
  const label = obj.className ? `${name}  ·  ${obj.className}` : name;
  const body = block(parent, label);
  const entries = Object.entries(obj.fields);
  const table = body.append('table').attr('class', 'viz-kv');
  const rows = table.append('tbody').selectAll('tr').data(entries).enter().append('tr');
  rows.append('td').attr('class', 'viz-kv-key').text((d) => d[0]);
  rows.append('td').attr('class', 'viz-kv-arrow').text(':');
  rows.append('td').attr('class', 'viz-kv-val').text((d) => primitiveText(d[1] as VizValue));
}

// --- Node-link diagrams (linked list / tree / graph) -----------------------

interface GNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
}
interface GLink {
  source: string;
  target: string;
  field: string;
}

function flattenNodes(root: VizObject): { nodes: GNode[]; links: GLink[] } {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const ids = new Map<VizObject, string>();
  let counter = 0;

  const visit = (obj: VizObject): string => {
    const existing = ids.get(obj);
    if (existing) return existing;
    const id = `n${counter++}`;
    ids.set(obj, id);
    nodes.push({ id, label: shortText(nodeValueField(obj)) });
    for (const field of CHILD_FIELDS) {
      const child = obj.fields[field];
      if (isTagged(child) && child.__kind === 'object') links.push({ source: id, target: visit(child), field });
      else if (Array.isArray(child)) {
        child.forEach((c) => {
          if (isTagged(c) && c.__kind === 'object') links.push({ source: id, target: visit(c), field });
        });
      }
    }
    return id;
  };

  visit(root);
  return { nodes, links };
}

function ensureArrowMarker(svg: any) {
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'viz-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 22)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('class', 'viz-arrow-head');
}

function drawNodeLink(parent: any, name: string, nodes: GNode[], links: GLink[], label: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = Math.max(...nodes.map((n) => n.x ?? 0), 0) + 60;
  const height = Math.max(...nodes.map((n) => n.y ?? 0), 0) + 60;
  const body = block(parent, `${name}  ·  ${label}`);
  const svg = body.append('svg').attr('width', width).attr('height', height);
  ensureArrowMarker(svg);

  svg
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('class', 'viz-edge')
    .attr('marker-end', 'url(#viz-arrow)')
    .attr('x1', (d) => byId.get(d.source)!.x!)
    .attr('y1', (d) => byId.get(d.source)!.y!)
    .attr('x2', (d) => byId.get(d.target)!.x!)
    .attr('y2', (d) => byId.get(d.target)!.y!);

  const g = svg
    .selectAll('g.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', (d) => `translate(${d.x},${d.y})`);
  g.append('circle').attr('r', 18).attr('class', 'viz-node');
  g.append('text').attr('text-anchor', 'middle').attr('dy', 5).attr('class', 'viz-node-text').text((d) => d.label);
}

function renderLinkedList(parent: any, name: string, root: VizObject) {
  const { nodes, links } = flattenNodes(root);
  nodes.forEach((n, i) => {
    n.x = 40 + i * 80;
    n.y = 40;
  });
  drawNodeLink(parent, name, nodes, links, 'linked list');
}

function renderTree(parent: any, name: string, root: VizObject) {
  // Build a d3.hierarchy over child fields, then lay it out top-down.
  const buildChildren = (o: VizObject): VizObject[] => {
    const kids: VizObject[] = [];
    for (const f of ['left', 'right', 'children']) {
      const child = o.fields[f];
      if (isTagged(child) && child.__kind === 'object') kids.push(child);
      else if (Array.isArray(child)) child.forEach((c) => isTagged(c) && c.__kind === 'object' && kids.push(c as VizObject));
    }
    return kids;
  };

  const root_ = hierarchy<VizObject>(root, buildChildren);
  const count = root_.descendants().length;
  const depth = root_.height + 1;
  const width = Math.max(count * 60, 160);
  const height = depth * 70;
  tree<VizObject>().size([width - 60, height - 60])(root_);

  const nodes: GNode[] = root_.descendants().map((d, i) => ({
    id: `n${i}`,
    label: shortText(nodeValueField(d.data)),
    x: (d as any).x + 30,
    y: (d as any).y + 30,
  }));
  const nodeIndex = new Map(root_.descendants().map((d, i) => [d, i]));
  const links: GLink[] = root_.links().map((l) => ({
    source: `n${nodeIndex.get(l.source)}`,
    target: `n${nodeIndex.get(l.target)}`,
    field: 'child',
  }));
  drawNodeLink(parent, name, nodes, links, 'tree');
}

function renderGraphFallback(parent: any, name: string, root: VizObject) {
  const { nodes, links } = flattenNodes(root);
  const width = 420;
  const height = 260;
  const sim = forceSimulation(nodes as any)
    .force('link', forceLink(links as any).id((d: any) => d.id).distance(70))
    .force('charge', forceManyBody().strength(-220))
    .force('center', forceCenter(width / 2, height / 2))
    .stop();
  for (let i = 0; i < 200; i++) sim.tick();
  nodes.forEach((n) => {
    n.x = Math.max(24, Math.min(width - 24, n.x!));
    n.y = Math.max(24, Math.min(height - 24, n.y!));
  });
  drawNodeLink(parent, name, nodes, links, 'graph');
}

// --- Scalars + call stack --------------------------------------------------

function renderScalars(parent: any, entries: [string, VizValue][]) {
  if (!entries.length) return;
  const body = block(parent, 'variables');
  const table = body.append('table').attr('class', 'viz-kv');
  const rows = table.append('tbody').selectAll('tr').data(entries).enter().append('tr');
  rows.append('td').attr('class', 'viz-kv-key').text((d) => d[0]);
  rows.append('td').attr('class', 'viz-kv-arrow').text('=');
  rows.append('td').attr('class', 'viz-kv-val').text((d) => primitiveText(d[1]));
}

function renderCallStack(parent: any, stack: CallFrame[]) {
  if (stack.length <= 1) return;
  const body = block(parent, 'call stack');
  body
    .append('div')
    .attr('class', 'viz-stack')
    .selectAll('span')
    .data([...stack].reverse())
    .enter()
    .append('span')
    .attr('class', (_d, i) => `viz-stack-frame${i === 0 ? ' viz-stack-top' : ''}`)
    .text((d) => `${d.fn}()  ·  line ${d.line}`);
}

/** Clears `container` and renders one step. `prev` enables change highlighting. */
export function renderStep(container: HTMLElement, step: Step | null, prev: Step | null): void {
  const root = select(container);
  root.selectAll('*').remove();
  if (!step) {
    root.append('div').attr('class', 'viz-empty').text('Run your code to see it visualized here.');
    return;
  }

  const structural: [string, VizValue][] = [];
  const scalars: [string, VizValue][] = [];
  for (const [name, value] of Object.entries(step.variables)) {
    if (isStructural(classify(value))) structural.push([name, value]);
    else scalars.push([name, value]);
  }

  renderCallStack(root, step.callStack);
  renderScalars(root, scalars);

  for (const [name, value] of structural) {
    const kind = classify(value);
    const prevVal = prev?.variables[name];
    switch (kind) {
      case 'array1d':
        renderArray1d(root, name, value as VizValue[], Array.isArray(prevVal) ? (prevVal as VizValue[]) : undefined);
        break;
      case 'array2d':
        renderArray2d(root, name, value as VizValue[]);
        break;
      case 'map':
        renderMap(root, name, value as VizMap);
        break;
      case 'set':
        renderSet(root, name, value as VizSet);
        break;
      case 'linkedList':
        renderLinkedList(root, name, value as VizObject);
        break;
      case 'tree':
        renderTree(root, name, value as VizObject);
        break;
      case 'graph':
        renderGraphFallback(root, name, value as VizObject);
        break;
      default:
        renderObject(root, name, value as VizObject);
    }
  }

  if (!structural.length && !scalars.length) {
    root.append('div').attr('class', 'viz-empty').text('No variables in scope at this step.');
  }
}
