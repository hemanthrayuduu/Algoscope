// A minimal, sandboxed, step-by-step JavaScript interpreter.
//
// This intentionally does NOT use eval()/new Function() anywhere. Instead it
// walks an acorn AST and evaluates it node-by-node as a generator, yielding a
// serializable "step" after every statement. That gives us:
//   1. A working step-through visualizer under Manifest V3's CSP, which
//      forbids 'unsafe-eval' in extension contexts.
//   2. Natural pause points for play/step/rewind controls, since the
//      generator itself IS the execution timeline.
//
// Supported subset of JS: var/let/const (incl. array/object destructuring),
// if/else, for, while, do-while, for-of, for-in, function declarations,
// function expressions/arrow functions, recursion, break/continue/return,
// arrays, objects, Map, Set, template literals, and a curated set of
// built-in Array/String/Map/Set/Math methods commonly used in DSA solutions.
//
// Not supported (by design, to keep the engine auditable): async/await,
// classes, generators/yield in user code, try/catch, spread in call
// arguments, regular expressions. Attempting to use these throws a clear
// "Unsupported" error rather than failing silently.

import * as acorn from 'acorn';

class InterpreterError extends Error {}

class BreakSignal {}
class ContinueSignal {}
class ReturnSignal {
  constructor(value) {
    this.value = value;
  }
}

class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.vars = new Map();
  }

  declare(name, value) {
    this.vars.set(name, value);
  }

  has(name) {
    return this.vars.has(name) || (this.parent ? this.parent.has(name) : false);
  }

  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new InterpreterError(`"${name}" is not defined`);
  }

  set(name, value) {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new InterpreterError(`"${name}" is not defined`);
  }

  // Flattened view of every variable visible from this scope, closest wins.
  snapshot() {
    const chain = [];
    for (let s = this; s; s = s.parent) chain.unshift(s);
    const out = {};
    for (const scope of chain) {
      for (const [name, value] of scope.vars) {
        out[name] = cloneForDisplay(value);
      }
    }
    return out;
  }
}

function isUserFunction(value) {
  return value && typeof value === 'object' && value.__interpretedFunction === true;
}

function cloneForDisplay(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'undefined' ? undefined : value;
  }
  if (isUserFunction(value)) return `ƒ ${value.name || 'anonymous'}()`;
  if (value instanceof Map) {
    return { __type: 'Map', entries: Array.from(value.entries()).map(([k, v]) => [cloneForDisplay(k, seen), cloneForDisplay(v, seen)]) };
  }
  if (value instanceof Set) {
    return { __type: 'Set', values: Array.from(value.values()).map((v) => cloneForDisplay(v, seen)) };
  }
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (const item of value) out.push(cloneForDisplay(item, seen));
    return out;
  }
  const out = {};
  seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = cloneForDisplay(value[key], seen);
  return out;
}

function truthy(value) {
  return Boolean(value);
}

function makeStep(node, scope, extra = {}) {
  return {
    line: node.loc ? node.loc.start.line : null,
    nodeType: node.type,
    scope: scope.snapshot(),
    ...extra,
  };
}

// --- Destructuring / assignment targets ------------------------------------
//
// A single recursive walker handles both `let [a, b] = ...` (declaration,
// where every leaf must be a plain identifier/pattern) and
// `[arr[i], arr[j]] = ...` (plain assignment, where leaves can be arbitrary
// assignable expressions like MemberExpression). Declarations reject
// MemberExpression leaves; assignments allow them.

function* bindPattern(interp, pattern, value, scope, isDeclaration) {
  if (pattern.type === 'Identifier') {
    if (isDeclaration) scope.declare(pattern.name, value);
    else scope.set(pattern.name, value);
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    const arr = Array.isArray(value) ? value : [];
    for (let i = 0; i < pattern.elements.length; i++) {
      const el = pattern.elements[i];
      if (!el) continue;
      yield* bindPattern(interp, el, arr[i], scope, isDeclaration);
    }
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    const obj = value || {};
    for (const prop of pattern.properties) {
      const key = prop.computed
        ? yield* evalExpr(interp, prop.key, scope)
        : prop.key.name || prop.key.value;
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

function* assignTo(interp, targetNode, value, scope) {
  yield* bindPattern(interp, targetNode, value, scope, false);
}

// --- Functions ---------------------------------------------------------

function makeFunction(node, closureScope, name) {
  return {
    __interpretedFunction: true,
    name: name || (node.id && node.id.name) || '',
    params: node.params,
    body: node.body,
    isExpressionBody: node.body.type !== 'BlockStatement',
    closureScope,
  };
}

function* callFunction(interp, fn, args) {
  if (typeof fn === 'function') {
    // Native built-in passed around as a value (rare, e.g. Math.max reference).
    return fn(...args);
  }
  if (!isUserFunction(fn)) {
    throw new InterpreterError('Attempted to call a non-function value');
  }
  interp.callDepth++;
  if (interp.callDepth > 500) {
    throw new InterpreterError('Maximum call stack depth exceeded (possible infinite recursion)');
  }
  try {
    const fnScope = new Scope(fn.closureScope);
    fn.params.forEach((p, i) => {
      // Only simple identifier / destructuring params are supported (no defaults/rest).
      bindPatternSync(p, args[i], fnScope);
    });
    if (fn.isExpressionBody) {
      return yield* evalExpr(interp, fn.body, fnScope);
    }
    const signal = yield* execBlock(interp, fn.body.body, fnScope);
    if (signal instanceof ReturnSignal) return signal.value;
    return undefined;
  } finally {
    interp.callDepth--;
  }
}

// Synchronous helper for parameter binding (no defaults, so no evaluation needed).
function bindPatternSync(pattern, value, scope) {
  if (pattern.type === 'Identifier') {
    scope.declare(pattern.name, value);
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    const arr = Array.isArray(value) ? value : [];
    pattern.elements.forEach((el, i) => {
      if (el) bindPatternSync(el, arr[i], scope);
    });
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    const obj = value || {};
    for (const prop of pattern.properties) {
      const key = prop.key.name || prop.key.value;
      bindPatternSync(prop.value, obj[key], scope);
    }
    return;
  }
  throw new InterpreterError(`Unsupported parameter pattern: ${pattern.type}`);
}

// --- Built-in methods ----------------------------------------------------

function callArrayMethod(arr, method, args) {
  switch (method) {
    case 'push': arr.push(...args); return arr.length;
    case 'pop': return arr.pop();
    case 'shift': return arr.shift();
    case 'unshift': arr.unshift(...args); return arr.length;
    case 'slice': return arr.slice(...args);
    case 'splice': return arr.splice(...args);
    case 'indexOf': return arr.indexOf(...args);
    case 'includes': return arr.includes(...args);
    case 'join': return arr.join(...args);
    case 'concat': return arr.concat(...args);
    case 'reverse': return arr.reverse();
    case 'fill': return arr.fill(...args);
    case 'flat': return arr.flat(...args);
    case 'sort':
      if (args[0]) throw new InterpreterError('sort() with a custom comparator function is not supported yet; sort a copy natively instead');
      return arr.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    default:
      throw new InterpreterError(`Unsupported array method: .${method}()`);
  }
}

function callStringMethod(str, method, args) {
  switch (method) {
    case 'charAt': return str.charAt(...args);
    case 'slice': return str.slice(...args);
    case 'substring': return str.substring(...args);
    case 'split': return str.split(...args);
    case 'indexOf': return str.indexOf(...args);
    case 'includes': return str.includes(...args);
    case 'toUpperCase': return str.toUpperCase();
    case 'toLowerCase': return str.toLowerCase();
    case 'trim': return str.trim();
    case 'repeat': return str.repeat(...args);
    case 'padStart': return str.padStart(...args);
    case 'padEnd': return str.padEnd(...args);
    case 'replace': return str.replace(...args);
    case 'concat': return str.concat(...args);
    default:
      throw new InterpreterError(`Unsupported string method: .${method}()`);
  }
}

function callMapMethod(map, method, args) {
  switch (method) {
    case 'set': map.set(args[0], args[1]); return map;
    case 'get': return map.get(args[0]);
    case 'has': return map.has(args[0]);
    case 'delete': return map.delete(args[0]);
    case 'clear': map.clear(); return undefined;
    case 'keys': return Array.from(map.keys());
    case 'values': return Array.from(map.values());
    case 'entries': return Array.from(map.entries());
    default:
      throw new InterpreterError(`Unsupported Map method: .${method}()`);
  }
}

function callSetMethod(set, method, args) {
  switch (method) {
    case 'add': set.add(args[0]); return set;
    case 'has': return set.has(args[0]);
    case 'delete': return set.delete(args[0]);
    case 'clear': set.clear(); return undefined;
    case 'values': return Array.from(set.values());
    default:
      throw new InterpreterError(`Unsupported Set method: .${method}()`);
  }
}

const MATH_METHODS = new Set(['max', 'min', 'floor', 'ceil', 'round', 'abs', 'pow', 'sqrt', 'random', 'trunc', 'log2', 'log10', 'sign']);

// --- Expression evaluation ------------------------------------------------

function* evalExpr(interp, node, scope) {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      if (node.name === 'Infinity') return Infinity;
      if (node.name === 'NaN') return NaN;
      return scope.get(node.name);
    case 'ArrayExpression': {
      const arr = [];
      for (const el of node.elements) {
        if (el === null) {
          arr.push(undefined);
        } else if (el.type === 'SpreadElement') {
          const spread = yield* evalExpr(interp, el.argument, scope);
          arr.push(...spread);
        } else {
          arr.push(yield* evalExpr(interp, el, scope));
        }
      }
      return arr;
    }
    case 'ObjectExpression': {
      const obj = {};
      for (const prop of node.properties) {
        const key = prop.computed ? yield* evalExpr(interp, prop.key, scope) : (prop.key.name || prop.key.value);
        obj[key] = yield* evalExpr(interp, prop.value, scope);
      }
      return obj;
    }
    case 'TemplateLiteral': {
      let out = '';
      for (let i = 0; i < node.quasis.length; i++) {
        out += node.quasis[i].value.cooked;
        if (i < node.expressions.length) {
          out += String(yield* evalExpr(interp, node.expressions[i], scope));
        }
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
      if (node.operator === '??') return left !== null && left !== undefined ? left : yield* evalExpr(interp, node.right, scope);
      throw new InterpreterError(`Unsupported logical operator: ${node.operator}`);
    }
    case 'UnaryExpression': {
      const arg = yield* evalExpr(interp, node.argument, scope);
      switch (node.operator) {
        case '!': return !arg;
        case '-': return -arg;
        case '+': return +arg;
        case 'typeof': return typeof arg;
        default: throw new InterpreterError(`Unsupported unary operator: ${node.operator}`);
      }
    }
    case 'UpdateExpression': {
      const oldValue = yield* evalExpr(interp, node.argument, scope);
      const newValue = node.operator === '++' ? oldValue + 1 : oldValue - 1;
      yield* assignTo(interp, node.argument, newValue, scope);
      return node.prefix ? newValue : oldValue;
    }
    case 'AssignmentExpression': {
      let value;
      if (node.operator === '=') {
        value = yield* evalExpr(interp, node.right, scope);
      } else {
        const current = yield* evalExpr(interp, node.left, scope);
        const rhs = yield* evalExpr(interp, node.right, scope);
        const op = node.operator.slice(0, -1);
        value = evalBinary(op, current, rhs);
      }
      yield* assignTo(interp, node.left, value, scope);
      return value;
    }
    case 'ConditionalExpression': {
      const test = yield* evalExpr(interp, node.test, scope);
      return truthy(test)
        ? yield* evalExpr(interp, node.consequent, scope)
        : yield* evalExpr(interp, node.alternate, scope);
    }
    case 'SequenceExpression': {
      let result;
      for (const expr of node.expressions) result = yield* evalExpr(interp, expr, scope);
      return result;
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return makeFunction(node, scope);
    case 'MemberExpression': {
      const obj = yield* evalExpr(interp, node.object, scope);
      const key = node.computed ? yield* evalExpr(interp, node.property, scope) : node.property.name;
      if (obj === undefined || obj === null) {
        throw new InterpreterError(`Cannot read property "${key}" of ${obj}`);
      }
      if ((obj instanceof Map || obj instanceof Set) && key === 'size') return obj.size;
      if (Array.isArray(obj) && key === 'length') return obj.length;
      return obj[key];
    }
    case 'NewExpression': {
      const calleeName = node.callee.name;
      if (calleeName === 'Map') return new Map();
      if (calleeName === 'Set') {
        const initArgs = node.arguments.length ? yield* evalExpr(interp, node.arguments[0], scope) : [];
        return new Set(initArgs);
      }
      if (calleeName === 'Array') {
        const args = [];
        for (const a of node.arguments) args.push(yield* evalExpr(interp, a, scope));
        if (args.length === 1 && typeof args[0] === 'number') return new Array(args[0]).fill(undefined);
        return args;
      }
      throw new InterpreterError(`Unsupported constructor: new ${calleeName}()`);
    }
    case 'CallExpression': {
      const args = [];
      for (const a of node.arguments) {
        if (a.type === 'SpreadElement') {
          const spread = yield* evalExpr(interp, a.argument, scope);
          args.push(...spread);
        } else {
          args.push(yield* evalExpr(interp, a, scope));
        }
      }

      if (node.callee.type === 'MemberExpression') {
        const objNode = node.callee.object;
        const method = node.callee.property.name;

        if (objNode.type === 'Identifier' && objNode.name === 'Math' && MATH_METHODS.has(method)) {
          return Math[method](...args);
        }
        if (objNode.type === 'Identifier' && objNode.name === 'console') {
          interp.output.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(cloneForDisplay(a)) : String(a))).join(' '));
          return undefined;
        }
        if (objNode.type === 'Identifier' && objNode.name === 'Object') {
          const target = args[0];
          if (method === 'keys') return Object.keys(target);
          if (method === 'values') return Object.values(target);
          if (method === 'entries') return Object.entries(target);
          if (method === 'assign') return Object.assign({}, ...args);
        }
        if (objNode.type === 'Identifier' && objNode.name === 'Array') {
          if (method === 'isArray') return Array.isArray(args[0]);
          if (method === 'from') {
            const [source, mapFn] = args;
            let items;
            if (source instanceof Map) items = Array.from(source.entries());
            else if (source instanceof Set) items = Array.from(source.values());
            else if (Array.isArray(source)) items = source.slice();
            else if (source && typeof source.length === 'number') items = new Array(source.length).fill(undefined);
            else items = [];
            if (!mapFn) return items;
            const mapped = [];
            for (let i = 0; i < items.length; i++) mapped.push(yield* callFunction(interp, mapFn, [items[i], i]));
            return mapped;
          }
        }

        const obj = yield* evalExpr(interp, objNode, scope);
        if (Array.isArray(obj)) return callArrayMethod(obj, method, args);
        if (typeof obj === 'string') return callStringMethod(obj, method, args);
        if (obj instanceof Map) return callMapMethod(obj, method, args);
        if (obj instanceof Set) return callSetMethod(obj, method, args);
        if (isUserFunction(obj[method])) return yield* callFunction(interp, obj[method], args);
        throw new InterpreterError(`Unsupported method call: .${method}()`);
      }

      if (node.callee.type === 'Identifier') {
        if (node.callee.name === 'parseInt') return parseInt(args[0], args[1]);
        if (node.callee.name === 'parseFloat') return parseFloat(args[0]);
        if (node.callee.name === 'Number') return Number(args[0]);
        if (node.callee.name === 'String') return String(args[0]);
        if (node.callee.name === 'Boolean') return Boolean(args[0]);
        const fn = scope.get(node.callee.name);
        return yield* callFunction(interp, fn, args);
      }

      const fn = yield* evalExpr(interp, node.callee, scope);
      return yield* callFunction(interp, fn, args);
    }
    default:
      throw new InterpreterError(`Unsupported expression type: ${node.type}`);
  }
}

function evalBinary(operator, left, right) {
  switch (operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '**': return left ** right;
    case '==': return left == right; // eslint-disable-line eqeqeq
    case '!=': return left != right; // eslint-disable-line eqeqeq
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
    default:
      throw new InterpreterError(`Unsupported binary operator: ${operator}`);
  }
}

// --- Statement execution ---------------------------------------------------

function* execBlock(interp, statements, scope) {
  for (const stmt of statements) {
    const signal = yield* execStatement(interp, stmt, scope);
    if (signal) return signal;
  }
  return null;
}

function* execStatement(interp, node, scope) {
  switch (node.type) {
    case 'VariableDeclaration': {
      for (const decl of node.declarations) {
        const value = decl.init ? yield* evalExpr(interp, decl.init, scope) : undefined;
        yield* bindPattern(interp, decl.id, value, scope, true);
      }
      yield makeStep(node, scope);
      return null;
    }
    case 'ExpressionStatement': {
      yield* evalExpr(interp, node.expression, scope);
      yield makeStep(node, scope);
      return null;
    }
    case 'FunctionDeclaration': {
      scope.declare(node.id.name, makeFunction(node, scope));
      return null;
    }
    case 'BlockStatement':
      return yield* execBlock(interp, node.body, new Scope(scope));
    case 'IfStatement': {
      const test = yield* evalExpr(interp, node.test, scope);
      yield makeStep(node, scope, { branch: truthy(test) });
      if (truthy(test)) return yield* execStatement(interp, node.consequent, scope);
      if (node.alternate) return yield* execStatement(interp, node.alternate, scope);
      return null;
    }
    case 'ForStatement': {
      const loopScope = new Scope(scope);
      if (node.init) {
        if (node.init.type === 'VariableDeclaration') yield* execStatement(interp, node.init, loopScope);
        else yield* evalExpr(interp, node.init, loopScope);
      }
      while (!node.test || truthy(yield* evalExpr(interp, node.test, loopScope))) {
        const signal = yield* execStatement(interp, node.body, new Scope(loopScope));
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ReturnSignal) return signal;
        if (node.update) yield* evalExpr(interp, node.update, loopScope);
      }
      return null;
    }
    case 'WhileStatement': {
      while (truthy(yield* evalExpr(interp, node.test, scope))) {
        const signal = yield* execStatement(interp, node.body, new Scope(scope));
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ReturnSignal) return signal;
      }
      return null;
    }
    case 'DoWhileStatement': {
      do {
        const signal = yield* execStatement(interp, node.body, new Scope(scope));
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ReturnSignal) return signal;
      } while (truthy(yield* evalExpr(interp, node.test, scope)));
      return null;
    }
    case 'ForOfStatement':
    case 'ForInStatement': {
      const iterableValue = yield* evalExpr(interp, node.right, scope);
      const items = node.type === 'ForInStatement'
        ? Object.keys(iterableValue)
        : (Array.isArray(iterableValue) ? iterableValue
          : typeof iterableValue === 'string' ? iterableValue.split('')
            : iterableValue instanceof Map ? Array.from(iterableValue.entries())
              : iterableValue instanceof Set ? Array.from(iterableValue.values())
                : []);
      for (const item of items) {
        const bodyScope = new Scope(scope);
        if (node.left.type === 'VariableDeclaration') {
          yield* bindPattern(interp, node.left.declarations[0].id, item, bodyScope, true);
        } else {
          yield* assignTo(interp, node.left, item, scope);
        }
        const signal = yield* execStatement(interp, node.body, bodyScope);
        if (signal instanceof BreakSignal) break;
        if (signal instanceof ContinueSignal) continue;
        if (signal instanceof ReturnSignal) return signal;
      }
      return null;
    }
    case 'ReturnStatement': {
      const value = node.argument ? yield* evalExpr(interp, node.argument, scope) : undefined;
      yield makeStep(node, scope, { returning: true });
      return new ReturnSignal(value);
    }
    case 'BreakStatement':
      return new BreakSignal();
    case 'ContinueStatement':
      return new ContinueSignal();
    case 'EmptyStatement':
      return null;
    default:
      throw new InterpreterError(`Unsupported statement type: ${node.type}`);
  }
}

/**
 * Parses `code`, hoists top-level function declarations, then calls
 * `entryFunction` with `args`. Returns a generator; each `.next()` advances
 * one step and yields a serializable snapshot. The generator's final
 * `.next()` resolves with `{ done: true, value: <returnValue> }`.
 */
export function* interpret({ code, entryFunction, args }) {
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script', locations: true });
  } catch (err) {
    throw new InterpreterError(`Syntax error: ${err.message}`);
  }

  const globalScope = new Scope(null);
  const interp = { output: [], callDepth: 0 };

  yield* execBlock(interp, ast.body, globalScope);

  if (!globalScope.has(entryFunction)) {
    throw new InterpreterError(`Function "${entryFunction}" was not found in your code.`);
  }

  const fn = globalScope.get(entryFunction);
  const result = yield* callFunction(interp, fn, args);
  return { result, output: interp.output };
}

export { InterpreterError };
