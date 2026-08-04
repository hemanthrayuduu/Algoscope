// A small, sandboxed, step-by-step JavaScript interpreter.
//
// It never uses eval() or new Function(): it parses the user's code with acorn
// and walks the AST as a generator, yielding a serializable Step after each
// statement. That gives safe execution plus natural pause points for the
// play/step/rewind UI. Supported: var/let/const (+ destructuring), if/else,
// for/while/do-while/for-of/for-in, function declarations and expressions,
// arrow functions, recursion, break/continue/return, arrays, objects, Map,
// Set, template literals, and common Array/String/Map/Set/Math/Object methods.
// Unsupported constructs (async, classes, try/catch, regex, custom sort
// comparators) throw a clear "unsupported" error rather than failing silently.

import * as acorn from 'acorn';
import type {
  CallFrame,
  RunRequest,
  RunResult,
  Step,
  VizValue,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

export class InterpreterError extends Error {}

class BreakSignal {}
class ContinueSignal {}
class ReturnSignal {
  constructor(public value: any) {}
}
type Signal = BreakSignal | ContinueSignal | ReturnSignal | null;

interface UserFunction {
  __interpretedFunction: true;
  name: string;
  params: Node[];
  body: Node;
  isExpressionBody: boolean;
  closureScope: Scope;
}

class Scope {
  vars = new Map<string, any>();
  constructor(public parent: Scope | null = null) {}

  declare(name: string, value: any) {
    this.vars.set(name, value);
  }
  has(name: string): boolean {
    return this.vars.has(name) || (this.parent ? this.parent.has(name) : false);
  }
  get(name: string): any {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new InterpreterError(`"${name}" is not defined`);
  }
  set(name: string, value: any): void {
    if (this.vars.has(name)) return void this.vars.set(name, value);
    if (this.parent) return this.parent.set(name, value);
    throw new InterpreterError(`"${name}" is not defined`);
  }
  snapshot(): Record<string, VizValue> {
    const chain: Scope[] = [];
    for (let s: Scope | null = this; s; s = s.parent) chain.unshift(s);
    const out: Record<string, VizValue> = {};
    for (const scope of chain) {
      for (const [name, value] of scope.vars) out[name] = toViz(value);
    }
    return out;
  }
}

interface Interp {
  output: string;
  callStack: CallFrame[];
  callDepth: number;
  /**
   * Operations executed so far. This is deliberately separate from the step
   * count: a loop with an empty body (`while (true) {}`) yields no steps at
   * all, so a step-based limit would never fire and the run would hang. Every
   * statement and call ticks this instead, guaranteeing termination.
   */
  ops: number;
  maxOps: number;
}

function tick(interp: Interp): void {
  if (++interp.ops > interp.maxOps) {
    throw new InterpreterError(
      `Stopped after ${interp.maxOps} operations (possible infinite loop). Check your loop conditions.`,
    );
  }
}

function isUserFunction(v: any): v is UserFunction {
  return v && typeof v === 'object' && v.__interpretedFunction === true;
}

/** Convert a runtime JS value into the serializable VizValue model. */
function toViz(value: any, seen = new WeakSet<object>()): VizValue {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'number' || t === 'string' || t === 'boolean') return value;
  if (isUserFunction(value)) return { __kind: 'function', name: value.name || 'anonymous' };
  if (t === 'function') return { __kind: 'function', name: (value as any).name || 'native' };
  if (value instanceof Map) {
    return {
      __kind: 'map',
      entries: [...value.entries()].map(([k, v]) => [toViz(k, seen), toViz(v, seen)] as [VizValue, VizValue]),
    };
  }
  if (value instanceof Set) {
    return { __kind: 'set', items: [...value.values()].map((v) => toViz(v, seen)) };
  }
  if (typeof value === 'object' && seen.has(value)) return '<circular>';
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((v) => toViz(v, seen));
  }
  seen.add(value);
  const fields: Record<string, VizValue> = {};
  for (const key of Object.keys(value)) fields[key] = toViz(value[key], seen);
  return { __kind: 'object', fields };
}

const truthy = (v: any) => Boolean(v);

// --- Assignment / destructuring targets ------------------------------------

function* bindPattern(
  interp: Interp,
  pattern: Node,
  value: any,
  scope: Scope,
  isDeclaration: boolean,
): Generator<Step, void, unknown> {
  if (pattern.type === 'Identifier') {
    if (isDeclaration) scope.declare(pattern.name, value);
    else scope.set(pattern.name, value);
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    const arr = Array.isArray(value) ? value : [];
    for (let i = 0; i < pattern.elements.length; i++) {
      const el = pattern.elements[i];
      if (el) yield* bindPattern(interp, el, arr[i], scope, isDeclaration);
    }
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    const obj = value ?? {};
    for (const prop of pattern.properties) {
      const key = prop.computed ? yield* evalExpr(interp, prop.key, scope) : prop.key.name ?? prop.key.value;
      yield* bindPattern(interp, prop.value, obj[key], scope, isDeclaration);
    }
    return;
  }
  if (!isDeclaration && pattern.type === 'MemberExpression') {
    const obj = yield* evalExpr(interp, pattern.object, scope);
    const key = pattern.computed ? yield* evalExpr(interp, pattern.property, scope) : pattern.property.name;
    obj[key] = value;
    return;
  }
  throw new InterpreterError(`Unsupported ${isDeclaration ? 'declaration' : 'assignment'} target: ${pattern.type}`);
}

// --- Functions -------------------------------------------------------------

function makeFunction(node: Node, closureScope: Scope, name?: string): UserFunction {
  return {
    __interpretedFunction: true,
    name: name ?? node.id?.name ?? '',
    params: node.params,
    body: node.body,
    isExpressionBody: node.body.type !== 'BlockStatement',
    closureScope,
  };
}

function bindParamSync(pattern: Node, value: any, scope: Scope): void {
  if (pattern.type === 'Identifier') return scope.declare(pattern.name, value);
  if (pattern.type === 'ArrayPattern') {
    const arr = Array.isArray(value) ? value : [];
    pattern.elements.forEach((el: Node, i: number) => el && bindParamSync(el, arr[i], scope));
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    const obj = value ?? {};
    for (const prop of pattern.properties) bindParamSync(prop.value, obj[prop.key.name ?? prop.key.value], scope);
    return;
  }
  if (pattern.type === 'RestElement') return scope.declare(pattern.argument.name, value);
  throw new InterpreterError(`Unsupported parameter pattern: ${pattern.type}`);
}

function* callFunction(interp: Interp, fn: any, args: any[]): Generator<Step, any, unknown> {
  if (typeof fn === 'function') return fn(...args);
  if (!isUserFunction(fn)) throw new InterpreterError('Attempted to call a non-function value');

  tick(interp);
  interp.callDepth++;
  if (interp.callDepth > 800) {
    throw new InterpreterError('Maximum call stack depth exceeded (possible infinite recursion)');
  }
  interp.callStack.push({ fn: fn.name || 'anonymous', line: 0 });
  try {
    const fnScope = new Scope(fn.closureScope);
    fn.params.forEach((p: Node, i: number) => {
      if (p.type === 'RestElement') bindParamSync(p, args.slice(i), fnScope);
      else bindParamSync(p, args[i], fnScope);
    });
    if (fn.isExpressionBody) return yield* evalExpr(interp, fn.body, fnScope);
    const signal = yield* execBlock(interp, fn.body.body, fnScope);
    return signal instanceof ReturnSignal ? signal.value : undefined;
  } finally {
    interp.callStack.pop();
    interp.callDepth--;
  }
}

// --- Built-in methods ------------------------------------------------------

function callArrayMethod(arr: any, method: string, args: any[]): any {
  switch (method) {
    case 'push': return arr.push(...args);
    case 'pop': return arr.pop();
    case 'shift': return arr.shift();
    case 'unshift': return arr.unshift(...args);
    case 'slice': return arr.slice(...args);
    case 'splice': return arr.splice(...args);
    case 'indexOf': return arr.indexOf(args[0]);
    case 'lastIndexOf': return arr.lastIndexOf(args[0]);
    case 'includes': return arr.includes(args[0]);
    case 'join': return arr.join(...args);
    case 'concat': return arr.concat(...args);
    case 'reverse': return arr.reverse();
    case 'fill': return arr.fill(...args);
    case 'flat': return arr.flat(...args);
    case 'keys': return [...arr.keys()];
    case 'values': return [...arr.values()];
    case 'sort':
      // Comparator sorts are routed through callArrayHigherOrder, since calling
      // back into user code requires the generator. The default sort delegates
      // to the engine so it matches JS exactly — including the surprising
      // lexicographic ordering of numbers ([10, 9] sorts to [10, 9]).
      return arr.sort();
    default:
      throw new InterpreterError(`Unsupported array method: .${method}()`);
  }
}

function callStringMethod(str: any, method: string, args: any[]): any {
  switch (method) {
    case 'charAt': return str.charAt(args[0]);
    case 'charCodeAt': return str.charCodeAt(args[0]);
    case 'codePointAt': return str.codePointAt(args[0]);
    case 'at': return (str as any).at(args[0]);
    case 'slice': return str.slice(...args);
    case 'substring': return str.substring(...args);
    case 'substr': return str.substr(...args);
    case 'split': return str.split(...args);
    case 'indexOf': return str.indexOf(...args);
    case 'includes': return str.includes(args[0]);
    case 'startsWith': return str.startsWith(...args);
    case 'endsWith': return str.endsWith(...args);
    case 'toUpperCase': return str.toUpperCase();
    case 'toLowerCase': return str.toLowerCase();
    case 'trim': return str.trim();
    case 'repeat': return str.repeat(args[0]);
    case 'padStart': return str.padStart(args[0], args[1]);
    case 'padEnd': return str.padEnd(args[0], args[1]);
    case 'replace': return str.replace(args[0], args[1]);
    case 'replaceAll': return str.replaceAll(args[0], args[1]);
    case 'concat': return str.concat(...args);
    default:
      throw new InterpreterError(`Unsupported string method: .${method}()`);
  }
}

function callMapMethod(map: any, method: string, args: any[]): any {
  switch (method) {
    case 'set': map.set(args[0], args[1]); return map;
    case 'get': return map.get(args[0]);
    case 'has': return map.has(args[0]);
    case 'delete': return map.delete(args[0]);
    case 'clear': map.clear(); return undefined;
    case 'keys': return [...map.keys()];
    case 'values': return [...map.values()];
    case 'entries': return [...map.entries()];
    default:
      throw new InterpreterError(`Unsupported Map method: .${method}()`);
  }
}

function callSetMethod(set: any, method: string, args: any[]): any {
  switch (method) {
    case 'add': set.add(args[0]); return set;
    case 'has': return set.has(args[0]);
    case 'delete': return set.delete(args[0]);
    case 'clear': set.clear(); return undefined;
    case 'values': return [...set.values()];
    default:
      throw new InterpreterError(`Unsupported Set method: .${method}()`);
  }
}

const MATH_METHODS = new Set([
  'max', 'min', 'floor', 'ceil', 'round', 'abs', 'pow', 'sqrt', 'cbrt', 'random',
  'trunc', 'sign', 'log', 'log2', 'log10', 'hypot', 'sin', 'cos', 'tan',
]);

// --- Expression evaluation -------------------------------------------------

function* evalExpr(interp: Interp, node: Node, scope: Scope): Generator<Step, any, unknown> {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      if (node.name === 'Infinity') return Infinity;
      if (node.name === 'NaN') return NaN;
      return scope.get(node.name);
    case 'ThisExpression':
      throw new InterpreterError('`this` is not supported');
    case 'ArrayExpression': {
      const arr: any[] = [];
      for (const el of node.elements) {
        if (el === null) arr.push(undefined);
        else if (el.type === 'SpreadElement') arr.push(...(yield* evalExpr(interp, el.argument, scope)));
        else arr.push(yield* evalExpr(interp, el, scope));
      }
      return arr;
    }
    case 'ObjectExpression': {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') {
          Object.assign(obj, yield* evalExpr(interp, prop.argument, scope));
          continue;
        }
        const key = prop.computed ? yield* evalExpr(interp, prop.key, scope) : prop.key.name ?? prop.key.value;
        obj[key] = yield* evalExpr(interp, prop.value, scope);
      }
      return obj;
    }
    case 'TemplateLiteral': {
      let out = '';
      for (let i = 0; i < node.quasis.length; i++) {
        out += node.quasis[i].value.cooked;
        if (i < node.expressions.length) out += String(yield* evalExpr(interp, node.expressions[i], scope));
      }
      return out;
    }
    case 'BinaryExpression': {
      const left = yield* evalExpr(interp, node.left, scope);
      const right = yield* evalExpr(interp, node.right, scope);
      return evalBinary(node.operator, left, right);
    }
    case 'LogicalExpression': {
      const left = yield* evalExpr(interp, node.left, scope);
      if (node.operator === '&&') return truthy(left) ? yield* evalExpr(interp, node.right, scope) : left;
      if (node.operator === '||') return truthy(left) ? left : yield* evalExpr(interp, node.right, scope);
      if (node.operator === '??') return left ?? (yield* evalExpr(interp, node.right, scope));
      throw new InterpreterError(`Unsupported logical operator: ${node.operator}`);
    }
    case 'UnaryExpression': {
      const arg = yield* evalExpr(interp, node.argument, scope);
      switch (node.operator) {
        case '!': return !arg;
        case '-': return -arg;
        case '+': return +arg;
        case '~': return ~arg;
        case 'typeof': return typeof arg;
        default: throw new InterpreterError(`Unsupported unary operator: ${node.operator}`);
      }
    }
    case 'UpdateExpression': {
      const oldValue = yield* evalExpr(interp, node.argument, scope);
      const newValue = node.operator === '++' ? oldValue + 1 : oldValue - 1;
      yield* bindPattern(interp, node.argument, newValue, scope, false);
      return node.prefix ? newValue : oldValue;
    }
    case 'AssignmentExpression': {
      let value: any;
      if (node.operator === '=') {
        value = yield* evalExpr(interp, node.right, scope);
      } else {
        const current = yield* evalExpr(interp, node.left, scope);
        const rhs = yield* evalExpr(interp, node.right, scope);
        value = evalBinary(node.operator.slice(0, -1), current, rhs);
      }
      yield* bindPattern(interp, node.left, value, scope, false);
      return value;
    }
    case 'ConditionalExpression': {
      const test = yield* evalExpr(interp, node.test, scope);
      return truthy(test)
        ? yield* evalExpr(interp, node.consequent, scope)
        : yield* evalExpr(interp, node.alternate, scope);
    }
    case 'SequenceExpression': {
      let result: any;
      for (const expr of node.expressions) result = yield* evalExpr(interp, expr, scope);
      return result;
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return makeFunction(node, scope);
    case 'MemberExpression': {
      const obj = yield* evalExpr(interp, node.object, scope);
      const key = node.computed ? yield* evalExpr(interp, node.property, scope) : node.property.name;
      if (obj === undefined || obj === null) throw new InterpreterError(`Cannot read property "${key}" of ${obj}`);
      if ((obj instanceof Map || obj instanceof Set) && key === 'size') return obj.size;
      if ((Array.isArray(obj) || typeof obj === 'string') && key === 'length') return obj.length;
      return obj[key];
    }
    case 'NewExpression': {
      const name = node.callee.name;
      if (name === 'Map') return new Map();
      if (name === 'Set') return new Set(node.arguments.length ? yield* evalExpr(interp, node.arguments[0], scope) : []);
      if (name === 'Array') {
        const args: any[] = [];
        for (const a of node.arguments) args.push(yield* evalExpr(interp, a, scope));
        if (args.length === 1 && typeof args[0] === 'number') return new Array(args[0]).fill(undefined);
        return args;
      }
      throw new InterpreterError(`Unsupported constructor: new ${name}()`);
    }
    case 'CallExpression':
      return yield* evalCall(interp, node, scope);
    default:
      throw new InterpreterError(`Unsupported expression type: ${node.type}`);
  }
}

function* evalCall(interp: Interp, node: Node, scope: Scope): Generator<Step, any, unknown> {
  const args: any[] = [];
  for (const a of node.arguments) {
    if (a.type === 'SpreadElement') args.push(...(yield* evalExpr(interp, a.argument, scope)));
    else args.push(yield* evalExpr(interp, a, scope));
  }

  if (node.callee.type === 'MemberExpression') {
    const objNode = node.callee.object;
    const method = node.callee.property.name;

    if (objNode.type === 'Identifier') {
      if (objNode.name === 'Math' && MATH_METHODS.has(method)) return (Math as any)[method](...args);
      if (objNode.name === 'console' && (method === 'log' || method === 'error' || method === 'warn' || method === 'info')) {
        interp.output += args.map(displayForConsole).join(' ') + '\n';
        return undefined;
      }
      if (objNode.name === 'Object') {
        if (method === 'keys') return Object.keys(args[0]);
        if (method === 'values') return Object.values(args[0]);
        if (method === 'entries') return Object.entries(args[0]);
        if (method === 'assign') return Object.assign(args[0], ...args.slice(1));
        if (method === 'freeze') return args[0];
      }
      if (objNode.name === 'Array') {
        if (method === 'isArray') return Array.isArray(args[0]);
        if (method === 'from') {
          const [src, mapFn] = args;
          let items: any[];
          if (src instanceof Map) items = [...src.entries()];
          else if (src instanceof Set) items = [...src.values()];
          else if (Array.isArray(src)) items = src.slice();
          else if (typeof src === 'string') items = src.split('');
          else if (src && typeof src.length === 'number') items = new Array(src.length).fill(undefined);
          else items = [];
          if (!mapFn) return items;
          const out: any[] = [];
          for (let i = 0; i < items.length; i++) out.push(yield* callFunction(interp, mapFn, [items[i], i]));
          return out;
        }
        if (method === 'of') return args;
      }
      if (objNode.name === 'JSON') {
        if (method === 'stringify') return JSON.stringify(args[0]);
        if (method === 'parse') return JSON.parse(args[0]);
      }
    }

    const obj = yield* evalExpr(interp, objNode, scope);
    // Higher-order array methods need to call back into the interpreter.
    if (
      Array.isArray(obj) &&
      (['map', 'filter', 'forEach', 'reduce', 'some', 'every', 'find', 'findIndex'].includes(method) ||
        (method === 'sort' && args[0]))
    ) {
      return yield* callArrayHigherOrder(interp, obj, method, args);
    }
    if (Array.isArray(obj)) return callArrayMethod(obj, method, args);
    if (typeof obj === 'string') return callStringMethod(obj, method, args);
    if (obj instanceof Map) return callMapMethod(obj, method, args);
    if (obj instanceof Set) return callSetMethod(obj, method, args);
    if (isUserFunction(obj?.[method])) return yield* callFunction(interp, obj[method], args);
    throw new InterpreterError(`Unsupported method call: .${method}()`);
  }

  if (node.callee.type === 'Identifier') {
    const n = node.callee.name;
    if (n === 'parseInt') return parseInt(args[0], args[1]);
    if (n === 'parseFloat') return parseFloat(args[0]);
    if (n === 'Number') return Number(args[0]);
    if (n === 'String') return String(args[0]);
    if (n === 'Boolean') return Boolean(args[0]);
    if (n === 'isNaN') return isNaN(args[0]);
    if (n === 'Array') return args.length === 1 && typeof args[0] === 'number' ? new Array(args[0]).fill(undefined) : args;
    return yield* callFunction(interp, scope.get(n), args);
  }

  return yield* callFunction(interp, yield* evalExpr(interp, node.callee, scope), args);
}

function* callArrayHigherOrder(interp: Interp, arr: any[], method: string, args: any[]): Generator<Step, any, unknown> {
  const cb = args[0];
  switch (method) {
    case 'map': {
      const out: any[] = [];
      for (let i = 0; i < arr.length; i++) out.push(yield* callFunction(interp, cb, [arr[i], i, arr]));
      return out;
    }
    case 'filter': {
      const out: any[] = [];
      for (let i = 0; i < arr.length; i++) if (truthy(yield* callFunction(interp, cb, [arr[i], i, arr]))) out.push(arr[i]);
      return out;
    }
    case 'forEach':
      for (let i = 0; i < arr.length; i++) yield* callFunction(interp, cb, [arr[i], i, arr]);
      return undefined;
    case 'reduce': {
      let acc = args.length > 1 ? args[1] : arr[0];
      const start = args.length > 1 ? 0 : 1;
      for (let i = start; i < arr.length; i++) acc = yield* callFunction(interp, cb, [acc, arr[i], i, arr]);
      return acc;
    }
    case 'some':
      for (let i = 0; i < arr.length; i++) if (truthy(yield* callFunction(interp, cb, [arr[i], i, arr]))) return true;
      return false;
    case 'every':
      for (let i = 0; i < arr.length; i++) if (!truthy(yield* callFunction(interp, cb, [arr[i], i, arr]))) return false;
      return true;
    case 'find':
      for (let i = 0; i < arr.length; i++) if (truthy(yield* callFunction(interp, cb, [arr[i], i, arr]))) return arr[i];
      return undefined;
    case 'findIndex':
      for (let i = 0; i < arr.length; i++) if (truthy(yield* callFunction(interp, cb, [arr[i], i, arr]))) return i;
      return -1;
    case 'sort': {
      // Merge sort rather than delegating to Array#sort: the comparator is user
      // code, so each comparison must be driven through the interpreter's
      // generator. Merge sort is also stable, matching engine behaviour.
      const sorted = yield* mergeSort(interp, arr.slice(), cb);
      // sort() mutates in place and returns the same array.
      for (let i = 0; i < sorted.length; i++) arr[i] = sorted[i];
      return arr;
    }
    default:
      throw new InterpreterError(`Unsupported array method: .${method}()`);
  }
}

function* mergeSort(interp: Interp, items: any[], cb: any): Generator<Step, any[], unknown> {
  if (items.length <= 1) return items;
  const mid = Math.floor(items.length / 2);
  const left = yield* mergeSort(interp, items.slice(0, mid), cb);
  const right = yield* mergeSort(interp, items.slice(mid), cb);

  const out: any[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const order = Number(yield* callFunction(interp, cb, [left[i], right[j]]));
    // <= 0 keeps equal elements in their original order (stable).
    if (!Number.isFinite(order) || order <= 0) out.push(left[i++]);
    else out.push(right[j++]);
  }
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

function displayForConsole(v: any): string {
  if (typeof v === 'string') return v;
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function evalBinary(op: string, left: any, right: any): any {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '**': return left ** right;
    case '==': return left == right;
    case '!=': return left != right;
    case '===': return left === right;
    case '!==': return left !== right;
    case '<': return left < right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '>=': return left >= right;
    case '&': return left & right;
    case '|': return left | right;
    case '^': return left ^ right;
    case '<<': return left << right;
    case '>>': return left >> right;
    case '>>>': return left >>> right;
    default: throw new InterpreterError(`Unsupported operator: ${op}`);
  }
}

// --- Statement execution ---------------------------------------------------

function makeStep(interp: Interp, node: Node, scope: Scope, note?: string): Step {
  if (interp.callStack.length) interp.callStack[interp.callStack.length - 1].line = node.loc?.start.line ?? 0;
  return {
    line: node.loc?.start.line ?? 0,
    variables: scope.snapshot(),
    callStack: interp.callStack.map((f) => ({ ...f })),
    stdout: interp.output,
    note,
  };
}

function* execBlock(interp: Interp, statements: Node[], scope: Scope): Generator<Step, Signal, unknown> {
  for (const stmt of statements) {
    const signal = yield* execStatement(interp, stmt, scope);
    if (signal) return signal;
  }
  return null;
}

function* execStatement(interp: Interp, node: Node, scope: Scope): Generator<Step, Signal, unknown> {
  tick(interp);
  switch (node.type) {
    case 'VariableDeclaration': {
      for (const decl of node.declarations) {
        const value = decl.init ? yield* evalExpr(interp, decl.init, scope) : undefined;
        yield* bindPattern(interp, decl.id, value, scope, true);
      }
      yield makeStep(interp, node, scope);
      return null;
    }
    case 'ExpressionStatement':
      yield* evalExpr(interp, node.expression, scope);
      yield makeStep(interp, node, scope);
      return null;
    case 'FunctionDeclaration':
      scope.declare(node.id.name, makeFunction(node, scope));
      return null;
    case 'BlockStatement':
      return yield* execBlock(interp, node.body, new Scope(scope));
    case 'IfStatement': {
      const test = yield* evalExpr(interp, node.test, scope);
      yield makeStep(interp, node, scope, truthy(test) ? 'condition true' : 'condition false');
      if (truthy(test)) return yield* execStatement(interp, node.consequent, scope);
      if (node.alternate) return yield* execStatement(interp, node.alternate, scope);
      return null;
    }
    case 'ForStatement': {
      let loopScope = new Scope(scope);
      if (node.init) {
        if (node.init.type === 'VariableDeclaration') yield* execStatement(interp, node.init, loopScope);
        else yield* evalExpr(interp, node.init, loopScope);
      }

      // `let`/`const` loop variables get a fresh binding each iteration, so a
      // closure created in the body captures that iteration's value rather than
      // the final one. `var` (and a bare expression init) keeps one binding.
      const perIteration =
        node.init && node.init.type === 'VariableDeclaration' && node.init.kind !== 'var'
          ? [...loopScope.vars.keys()]
          : [];

      const copyLoopScope = (from: Scope): Scope => {
        const next = new Scope(scope);
        for (const name of perIteration) next.declare(name, from.get(name));
        return next;
      };

      while (!node.test || truthy(yield* evalExpr(interp, node.test, loopScope))) {
        const signal = yield* execStatement(interp, node.body, new Scope(loopScope));
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ReturnSignal) return signal;
        if (perIteration.length) loopScope = copyLoopScope(loopScope);
        if (node.update) yield* evalExpr(interp, node.update, loopScope);
      }
      return null;
    }
    case 'WhileStatement':
      while (truthy(yield* evalExpr(interp, node.test, scope))) {
        const signal = yield* execStatement(interp, node.body, new Scope(scope));
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ReturnSignal) return signal;
      }
      return null;
    case 'DoWhileStatement':
      do {
        const signal = yield* execStatement(interp, node.body, new Scope(scope));
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ReturnSignal) return signal;
      } while (truthy(yield* evalExpr(interp, node.test, scope)));
      return null;
    case 'ForOfStatement':
    case 'ForInStatement': {
      const iterable = yield* evalExpr(interp, node.right, scope);
      const items: any[] =
        node.type === 'ForInStatement'
          ? Object.keys(iterable)
          : Array.isArray(iterable)
            ? iterable
            : typeof iterable === 'string'
              ? iterable.split('')
              : iterable instanceof Map
                ? [...iterable.entries()]
                : iterable instanceof Set
                  ? [...iterable.values()]
                  : [];
      for (const item of items) {
        const bodyScope = new Scope(scope);
        if (node.left.type === 'VariableDeclaration') yield* bindPattern(interp, node.left.declarations[0].id, item, bodyScope, true);
        else yield* bindPattern(interp, node.left, item, scope, false);
        const signal = yield* execStatement(interp, node.body, bodyScope);
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ContinueSignal) continue;
        if (signal instanceof ReturnSignal) return signal;
      }
      return null;
    }
    case 'ReturnStatement': {
      const value = node.argument ? yield* evalExpr(interp, node.argument, scope) : undefined;
      yield makeStep(interp, node, scope, 'return');
      return new ReturnSignal(value);
    }
    case 'BreakStatement':
      return new BreakSignal();
    case 'ContinueStatement':
      return new ContinueSignal();
    case 'EmptyStatement':
      return null;
    case 'ClassDeclaration':
      throw new InterpreterError('Classes are not supported yet — define plain objects/functions instead');
    case 'TryStatement':
      throw new InterpreterError('try/catch is not supported yet');
    default:
      throw new InterpreterError(`Unsupported statement type: ${node.type}`);
  }
}

export interface JsRunOptions {
  /** Guards against runaway loops; execution stops once exceeded. */
  maxSteps?: number;
  /**
   * When false, steps are executed but not retained. Judging runs many test
   * cases and only needs the return value, so keeping every snapshot would
   * waste time and memory for no benefit.
   */
  collectSteps?: boolean;
}

/**
 * Runs `request` to completion. Returns the collected steps (when requested),
 * the return value, stdout, and any error; a run that fails partway still
 * returns the steps up to the failure so the user can see how far it got.
 */
export function runJavaScript(request: RunRequest, options: JsRunOptions = {}): RunResult {
  const { maxSteps = 20000, collectSteps = true } = options;
  const { code, entryFunction, argsJson } = request;
  let ast: Node;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script', locations: true });
  } catch (err: any) {
    return { steps: [], stdout: '', error: `Syntax error: ${err.message}` };
  }

  let args: any[];
  try {
    args = JSON.parse(argsJson || '[]');
    if (!Array.isArray(args)) throw new Error('Arguments must be a JSON array');
  } catch (err: any) {
    return { steps: [], stdout: '', error: `Could not parse arguments: ${err.message}` };
  }

  // Operations are much cheaper than steps, so the budget is a multiple of the
  // step limit: enough headroom for legitimate work, low enough that a runaway
  // loop is caught in well under a second.
  const interp: Interp = { output: '', callStack: [], callDepth: 0, ops: 0, maxOps: maxSteps * 50 };
  const steps: Step[] = [];

  function collect(gen: Generator<Step, any, unknown>): { value: any; error?: string } {
    let executed = 0;
    let res = gen.next();
    while (!res.done) {
      if (collectSteps) steps.push(res.value);
      executed++;
      if (executed > maxSteps) {
        return { value: undefined, error: `Stopped after ${maxSteps} steps (possible infinite loop).` };
      }
      res = gen.next();
    }
    return { value: res.value };
  }

  const globalScope = new Scope(null);
  try {
    const top = collect(execBlock(interp, ast.body, globalScope));
    if (top.error) return { steps, stdout: interp.output, error: top.error };

    // No entry function means "just run what's here" — a plain script, where
    // the top-level statements are the program. Requiring a function used to
    // reject that outright even though the trace had already been captured.
    const entry = entryFunction.trim();
    if (!entry) {
      return { steps, stdout: interp.output, returnValue: toViz(top.value) };
    }

    if (!globalScope.has(entry)) {
      return {
        steps,
        stdout: interp.output,
        error: `Function "${entry}" was not found. Leave "Run function" blank to run the code as a script.`,
      };
    }
    // callFunction pushes the entry frame itself; no manual push needed.
    const run = collect(callFunction(interp, globalScope.get(entry), args));
    if (run.error) return { steps, stdout: interp.output, error: run.error };

    return { steps, stdout: interp.output, returnValue: toViz(run.value) };
  } catch (err: any) {
    const message = err instanceof InterpreterError ? err.message : `Runtime error: ${err.message}`;
    return { steps, stdout: interp.output, error: message };
  }
}
