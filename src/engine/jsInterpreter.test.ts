// Differential tests for the JavaScript interpreter.
//
// The interpreter is a hand-written re-implementation of a JS subset, so the
// only trustworthy oracle is the real engine: every snippet below is executed
// twice — once through the interpreter, once natively — and the results must
// agree. Any divergence is an interpreter bug.
//
// (`new Function` here is test-only. The shipped interpreter never evals.)

import { describe, expect, it } from 'vitest';
import { runJavaScript } from './jsInterpreter';
import { toPlain } from '../judge/compare';

function viaInterpreter(code: string, entryFunction: string, args: unknown[]) {
  const result = runJavaScript(
    { code, language: 'javascript', entryFunction, argsJson: JSON.stringify(args) },
    { collectSteps: false },
  );
  if (result.error) throw new Error(result.error);
  return toPlain(result.returnValue);
}

function viaNative(code: string, entryFunction: string, args: unknown[]) {
  const factory = new Function(`${code}; return ${entryFunction};`);
  return JSON.parse(JSON.stringify(factory()(...args) ?? null));
}

function expectSame(code: string, entryFunction: string, args: unknown[]) {
  expect(viaInterpreter(code, entryFunction, args)).toEqual(viaNative(code, entryFunction, args));
}

describe('control flow', () => {
  it('for loops and accumulation', () => {
    expectSame('function f(n){let s=0;for(let i=0;i<n;i++){s+=i;}return s;}', 'f', [10]);
  });

  it('while and do-while', () => {
    expectSame('function f(n){let s=0;while(n>0){s+=n;n--;}return s;}', 'f', [5]);
    expectSame('function f(n){let s=0;do{s+=n;n--;}while(n>0);return s;}', 'f', [5]);
  });

  it('break and continue', () => {
    expectSame('function f(a){let s=0;for(const x of a){if(x<0)continue;if(x>100)break;s+=x;}return s;}', 'f', [
      [1, -2, 3, 200, 4],
    ]);
  });

  it('nested loops', () => {
    expectSame('function f(n){let c=0;for(let i=0;i<n;i++){for(let j=0;j<n;j++){if(i!==j)c++;}}return c;}', 'f', [5]);
  });

  it('if / else if / else', () => {
    for (const n of [-5, 0, 5]) {
      expectSame('function f(n){if(n<0)return "neg";else if(n===0)return "zero";else return "pos";}', 'f', [n]);
    }
  });

  it('for-in over object keys', () => {
    expectSame('function f(o){const out=[];for(const k in o){out.push(k);}return out;}', 'f', [{ a: 1, b: 2, c: 3 }]);
  });
});

describe('functions', () => {
  it('recursion', () => {
    expectSame('function f(n){if(n<=1)return 1;return n*f(n-1);}', 'f', [8]);
  });

  it('mutual recursion', () => {
    expectSame(
      'function isEven(n){if(n===0)return true;return isOdd(n-1);} function isOdd(n){if(n===0)return false;return isEven(n-1);} function f(n){return isEven(n);}',
      'f',
      [10],
    );
  });

  it('closures over loop variables', () => {
    expectSame('function f(n){const fns=[];for(let i=0;i<n;i++){fns.push(()=>i);}return fns.map(g=>g());}', 'f', [4]);
  });

  it('arrow functions and higher-order methods', () => {
    expectSame('function f(a){return a.map(x=>x*2).filter(x=>x>4).reduce((s,x)=>s+x,0);}', 'f', [[1, 2, 3, 4, 5]]);
  });

  it('rest parameters and spread', () => {
    expectSame('function g(...xs){return xs.length;} function f(a){return g(...a);}', 'f', [[1, 2, 3]]);
  });
});

describe('data structures', () => {
  it('array mutation methods', () => {
    expectSame('function f(a){a.push(9);a.unshift(0);a.splice(1,1);a.reverse();return a;}', 'f', [[1, 2, 3]]);
  });

  it('default sort matches engine ordering', () => {
    expectSame('function f(a){return a.slice().sort();}', 'f', [[10, 9, 80, 7]]);
  });

  it('sort with a custom comparator', () => {
    expectSame('function f(a){return a.slice().sort((x,y)=>x-y);}', 'f', [[5, 1, 4, 2, 8]]);
    expectSame('function f(a){return a.slice().sort((x,y)=>y-x);}', 'f', [[5, 1, 4, 2, 8]]);
  });

  it('sorts arrays of arrays by a key', () => {
    expectSame('function f(a){return a.slice().sort(function(x,y){return x[0]-y[0];});}', 'f', [
      [
        [3, 1],
        [1, 9],
        [2, 5],
      ],
    ]);
  });

  it('sort is stable', () => {
    expectSame('function f(a){return a.slice().sort((x,y)=>x.k-y.k).map(o=>o.id);}', 'f', [
      [
        { k: 1, id: 'a' },
        { k: 0, id: 'b' },
        { k: 1, id: 'c' },
        { k: 0, id: 'd' },
      ],
    ]);
  });

  it('Map and Set', () => {
    expectSame(
      'function f(a){const m=new Map();const s=new Set();for(const x of a){m.set(x,(m.get(x)||0)+1);s.add(x);}return [m.size,s.size,m.get(a[0])];}',
      'f',
      [[1, 2, 2, 3, 3, 3]],
    );
  });

  it('objects and nested access', () => {
    expectSame('function f(o){o.b.c=5;return [o.a,o.b.c,Object.keys(o).length];}', 'f', [{ a: 1, b: { c: 2 } }]);
  });

  it('string methods', () => {
    expectSame('function f(s){return s.split("").reverse().join("").toUpperCase().slice(1,4);}', 'f', ['abcdef']);
  });

  it('destructuring, including swaps', () => {
    expectSame('function f(a){const [x,y]=a;[a[0],a[1]]=[a[1],a[0]];const {p,q}={p:1,q:2};return [x,y,a,p,q];}', 'f', [
      [7, 8],
    ]);
  });

  it('template literals', () => {
    expectSame('function f(n){return `value is ${n*2} units`;}', 'f', [21]);
  });
});

describe('operators', () => {
  it('arithmetic, comparison, and bitwise', () => {
    expectSame(
      'function f(a,b){return [a+b,a-b,a*b,a/b,a%b,a**2,a>b,a<=b,a&b,a|b,a^b,a<<1,a>>1,-a,!a];}',
      'f',
      [7, 3],
    );
  });

  it('logical short-circuit and nullish coalescing', () => {
    expectSame('function f(a,b){return [a&&b,a||b,a??b];}', 'f', [0, 5]);
    expectSame('function f(a,b){return [a&&b,a||b,a??b];}', 'f', [null, 5]);
  });

  it('update expressions, prefix and postfix', () => {
    expectSame('function f(){let i=0;const a=i++;const b=++i;return [a,b,i];}', 'f', []);
  });

  it('ternary chains', () => {
    for (const n of [1, 50, 200]) {
      expectSame('function f(n){return n<10?"small":n<100?"medium":"large";}', 'f', [n]);
    }
  });
});

describe('classic algorithms', () => {
  it('two sum', () => {
    expectSame(
      'function f(nums,t){const m=new Map();for(let i=0;i<nums.length;i++){const c=t-nums[i];if(m.has(c))return [m.get(c),i];m.set(nums[i],i);}return [];}',
      'f',
      [[2, 7, 11, 15], 9],
    );
  });

  it('bubble sort', () => {
    expectSame(
      'function f(a){for(let i=0;i<a.length;i++){for(let j=0;j<a.length-i-1;j++){if(a[j]>a[j+1]){[a[j],a[j+1]]=[a[j+1],a[j]];}}}return a;}',
      'f',
      [[5, 2, 9, 1, 5, 6]],
    );
  });

  it('binary search', () => {
    expectSame(
      'function f(a,t){let lo=0,hi=a.length-1;while(lo<=hi){const m=Math.floor((lo+hi)/2);if(a[m]===t)return m;if(a[m]<t)lo=m+1;else hi=m-1;}return -1;}',
      'f',
      [[1, 3, 5, 7, 9], 7],
    );
  });

  it('memoized fibonacci', () => {
    expectSame(
      'function fib(n,memo){if(n<=1)return n;if(memo[n]!==undefined)return memo[n];memo[n]=fib(n-1,memo)+fib(n-2,memo);return memo[n];} function f(n){return fib(n,{});}',
      'f',
      [20],
    );
  });

  it('linked list reversal', () => {
    expectSame(
      'function f(vals){let head=null;for(let i=vals.length-1;i>=0;i--){head={val:vals[i],next:head};}let prev=null;while(head!==null){const n=head.next;head.next=prev;prev=head;head=n;}const out=[];let c=prev;while(c!==null){out.push(c.val);c=c.next;}return out;}',
      'f',
      [[1, 2, 3, 4]],
    );
  });

  it('merge intervals', () => {
    expectSame(
      'function f(iv){const s=iv.slice().sort(function(a,b){return a[0]-b[0];});const r=[];for(const i of s){if(r.length===0){r.push([i[0],i[1]]);}else{const l=r[r.length-1];if(i[0]<=l[1]){l[1]=Math.max(l[1],i[1]);}else{r.push([i[0],i[1]]);}}}return r;}',
      'f',
      [
        [
          [1, 3],
          [8, 10],
          [2, 6],
          [15, 18],
        ],
      ],
    );
  });
});

describe('error reporting', () => {
  it('reports a syntax error instead of throwing', () => {
    const result = runJavaScript({ code: 'function f({', language: 'javascript', entryFunction: 'f', argsJson: '[]' });
    expect(result.error).toMatch(/Syntax error/);
  });

  it('reports a missing entry function', () => {
    const result = runJavaScript({
      code: 'function g(){return 1;}',
      language: 'javascript',
      entryFunction: 'f',
      argsJson: '[]',
    });
    expect(result.error).toMatch(/was not found/);
  });

  // An empty loop body yields no steps, so only the operation budget can stop
  // it. Without that guard this test hangs forever instead of failing.
  it('stops an empty infinite loop instead of hanging', () => {
    const result = runJavaScript(
      { code: 'function f(){while(true){}}', language: 'javascript', entryFunction: 'f', argsJson: '[]' },
      { maxSteps: 500, collectSteps: false },
    );
    expect(result.error).toMatch(/possible infinite loop/i);
  });

  it('stops an infinite loop that does yield steps', () => {
    const result = runJavaScript(
      { code: 'function f(){let i=0;while(true){i++;}}', language: 'javascript', entryFunction: 'f', argsJson: '[]' },
      { maxSteps: 500, collectSteps: false },
    );
    expect(result.error).toMatch(/Stopped after 500 steps/);
  });

  it('does not flag legitimate long-running work as an infinite loop', () => {
    const result = runJavaScript(
      {
        code: 'function f(n){let s=0;for(let i=0;i<n;i++){s+=i;}return s;}',
        language: 'javascript',
        entryFunction: 'f',
        argsJson: '[2000]',
      },
      { maxSteps: 20000, collectSteps: false },
    );
    expect(result.error).toBeUndefined();
    expect(result.returnValue).toBe(1999000);
  });

  it('catches runaway recursion', () => {
    const result = runJavaScript({
      code: 'function f(n){return f(n+1);}',
      language: 'javascript',
      entryFunction: 'f',
      argsJson: '[0]',
    });
    expect(result.error).toMatch(/call stack/i);
  });

  it('names unsupported syntax clearly', () => {
    const result = runJavaScript({
      code: 'class A {} function f(){return new A();}',
      language: 'javascript',
      entryFunction: 'f',
      argsJson: '[]',
    });
    expect(result.error).toMatch(/Classes are not supported/);
  });

  it('captures console output', () => {
    const result = runJavaScript({
      code: 'function f(){console.log("a",1);console.log("b");return 0;}',
      language: 'javascript',
      entryFunction: 'f',
      argsJson: '[]',
    });
    expect(result.stdout).toBe('a 1\nb\n');
  });
});

describe('step tracing', () => {
  it('records a step per statement with variable state', () => {
    const result = runJavaScript({
      code: 'function f(){let a=1;let b=2;return a+b;}',
      language: 'javascript',
      entryFunction: 'f',
      argsJson: '[]',
    });
    expect(result.steps.length).toBeGreaterThan(0);
    const last = result.steps[result.steps.length - 1];
    expect(last.variables.a).toBe(1);
    expect(last.variables.b).toBe(2);
    expect(last.callStack[last.callStack.length - 1]?.fn).toBe('f');
  });

  it('omits steps when tracing is disabled', () => {
    const result = runJavaScript(
      { code: 'function f(){let s=0;for(let i=0;i<50;i++){s+=i;}return s;}', language: 'javascript', entryFunction: 'f', argsJson: '[]' },
      { collectSteps: false },
    );
    expect(result.steps).toHaveLength(0);
    expect(result.returnValue).toBe(1225);
  });
});
