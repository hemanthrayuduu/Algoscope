// D3 rendering for interpreter step snapshots.
//
// Given a step snapshot ({ line, scope, ... }) this picks out array-shaped
// variables to render as bar/cell tracks, Map/Set-shaped variables as
// key-value tables, linked-list/tree-shaped objects (plain objects with
// val/next or val/left/right fields) as node-link graphs, and everything
// else as a small scalar variables table.

import * as d3 from 'd3';

const ARRAY_BAR_HEIGHT = 140;
const CELL_SIZE = 42;
const CELL_GAP = 6;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !value.__type;
}

function looksLikeListOrTreeNode(value) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.includes('val') && (keys.includes('next') || keys.includes('left') || keys.includes('right'));
}

function classifyVariables(scope) {
  const arrays = [];
  const maps = [];
  const sets = [];
  const nodes = [];
  const scalars = [];

  for (const [name, value] of Object.entries(scope)) {
    if (Array.isArray(value) && value.every((v) => typeof v !== 'object' || v === null)) {
      arrays.push([name, value]);
    } else if (value && value.__type === 'Map') {
      maps.push([name, value]);
    } else if (value && value.__type === 'Set') {
      sets.push([name, value]);
    } else if (looksLikeListOrTreeNode(value)) {
      nodes.push([name, value]);
    } else if (typeof value !== 'object' || value === null) {
      scalars.push([name, value]);
    } else {
      scalars.push([name, JSON.stringify(value)]);
    }
  }
  return { arrays, maps, sets, nodes, scalars };
}

function renderArrayTrack(container, name, values) {
  const width = values.length * (CELL_SIZE + CELL_GAP) + CELL_GAP;
  const wrapper = container.append('div').attr('class', 'lv-track');
  wrapper.append('div').attr('class', 'lv-track-label').text(name);
  const svg = wrapper.append('svg').attr('width', width).attr('height', ARRAY_BAR_HEIGHT);

  const cell = svg.selectAll('g.lv-cell').data(values).enter().append('g')
    .attr('class', 'lv-cell')
    .attr('transform', (_, i) => `translate(${CELL_GAP + i * (CELL_SIZE + CELL_GAP)}, 20)`);

  cell.append('rect')
    .attr('width', CELL_SIZE)
    .attr('height', CELL_SIZE)
    .attr('rx', 6)
    .attr('class', 'lv-cell-rect');

  cell.append('text')
    .attr('x', CELL_SIZE / 2)
    .attr('y', CELL_SIZE / 2 + 5)
    .attr('text-anchor', 'middle')
    .attr('class', 'lv-cell-text')
    .text((d) => (d === undefined ? '·' : String(d)));

  cell.append('text')
    .attr('x', CELL_SIZE / 2)
    .attr('y', CELL_SIZE + 18)
    .attr('text-anchor', 'middle')
    .attr('class', 'lv-index-text')
    .text((_, i) => i);
}

function renderKeyValueTable(container, name, label, rows) {
  const wrapper = container.append('div').attr('class', 'lv-track');
  wrapper.append('div').attr('class', 'lv-track-label').text(`${name} (${label})`);
  const table = wrapper.append('table').attr('class', 'lv-kv-table');
  const tbody = table.append('tbody');
  const tr = tbody.selectAll('tr').data(rows).enter().append('tr');
  tr.append('td').attr('class', 'lv-kv-key').text((d) => JSON.stringify(d[0]));
  tr.append('td').attr('class', 'lv-kv-val').text((d) => JSON.stringify(d[1]));
}

function flattenNodeGraph(root, rootName) {
  const nodes = [];
  const links = [];
  const idFor = new Map();
  let counter = 0;

  function visit(value) {
    if (!looksLikeListOrTreeNode(value)) return null;
    if (idFor.has(value)) return idFor.get(value);
    const id = `n${counter++}`;
    idFor.set(value, id);
    nodes.push({ id, val: value.val });
    for (const field of ['next', 'left', 'right']) {
      if (value[field] && looksLikeListOrTreeNode(value[field])) {
        const childId = visit(value[field]);
        links.push({ source: id, target: childId, field });
      }
    }
    return id;
  }

  visit(root);
  return { nodes, links, rootName };
}

function renderNodeGraph(container, name, root) {
  const { nodes, links } = flattenNodeGraph(root, name);
  const width = 360;
  const height = 220;
  const wrapper = container.append('div').attr('class', 'lv-track');
  wrapper.append('div').attr('class', 'lv-track-label').text(name);
  const svg = wrapper.append('svg').attr('width', width).attr('height', height);

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(60))
    .force('charge', d3.forceManyBody().strength(-180))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .stop();

  for (let i = 0; i < 150; i++) simulation.tick();

  svg.selectAll('line').data(links).enter().append('line')
    .attr('class', 'lv-edge')
    .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
    .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);

  const g = svg.selectAll('g.lv-node').data(nodes).enter().append('g')
    .attr('class', 'lv-node')
    .attr('transform', (d) => `translate(${d.x},${d.y})`);

  g.append('circle').attr('r', 16).attr('class', 'lv-node-circle');
  g.append('text').attr('text-anchor', 'middle').attr('dy', 5).text((d) => d.val);
}

/**
 * Renders one interpreter step snapshot into `container` (a D3 selection).
 */
export function renderStep(container, step) {
  container.selectAll('*').remove();
  if (!step) return;

  const { arrays, maps, sets, nodes, scalars } = classifyVariables(step.scope || {});

  for (const [name, values] of arrays) renderArrayTrack(container, name, values);
  for (const [name, m] of maps) renderKeyValueTable(container, name, 'Map', m.entries);
  for (const [name, s] of sets) renderKeyValueTable(container, name, 'Set', s.values.map((v) => [v, '']));
  for (const [name, root] of nodes) renderNodeGraph(container, name, root);

  if (scalars.length) {
    const wrapper = container.append('div').attr('class', 'lv-track');
    wrapper.append('div').attr('class', 'lv-track-label').text('variables');
    const table = wrapper.append('table').attr('class', 'lv-kv-table');
    const tr = table.append('tbody').selectAll('tr').data(scalars).enter().append('tr');
    tr.append('td').attr('class', 'lv-kv-key').text((d) => d[0]);
    tr.append('td').attr('class', 'lv-kv-val').text((d) => (d[1] === undefined ? 'undefined' : String(d[1])));
  }
}
