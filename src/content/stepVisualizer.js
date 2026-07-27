// Step-through solution visualizer.
//
// Lets a user paste their own JS solution for the problem they're looking
// at, then walks it line-by-line through the sandboxed interpreter
// (src/interpreter/interpreter.js), rendering the live variable state with
// D3 (stepRenderer.js) and driving play/pause/step/reset controls.
//
// Unlike the LLM-generated visualization (visualization.js), nothing here
// is sent to a third-party API: parsing and execution both happen locally
// in this content script.

import * as d3 from 'd3';
import './stepVisualizer.css';
import { interpret, InterpreterError } from '../interpreter/interpreter';
import { renderStep } from './stepRenderer';

const MAX_STEPS = 20000;

function guessEntryFunctionName(code) {
  const fnDecl = code.match(/function\s+([a-zA-Z_$][\w$]*)\s*\(/);
  if (fnDecl) return fnDecl[1];
  const constFn = code.match(/(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:function|\()/);
  if (constFn) return constFn[1];
  return '';
}

function titleToFunctionName(title) {
  if (!title) return 'solve';
  const words = title.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/);
  if (!words.length) return 'solve';
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

function starterSkeleton(problemData) {
  const fnName = titleToFunctionName(problemData && problemData.title);
  const provided = problemData && problemData.starterCode;
  if (provided && provided.trim().length > 10) return provided;
  return `function ${fnName}(input) {\n  // Paste or write your solution here, then set the arguments below\n  // and click Run to step through it.\n  let result = input;\n  return result;\n}`;
}

class StepVisualizerPanel {
  constructor() {
    this.el = null;
    this.steps = [];
    this.currentIndex = -1;
    this.playing = false;
    this.timer = null;
    this.sourceLines = [];
  }

  open(problemData) {
    if (this.el) {
      this.el.style.display = 'block';
      return;
    }
    this.problemData = problemData || {};
    this.build();
    document.body.appendChild(this.el);
  }

  close() {
    if (this.el) this.el.style.display = 'none';
    this.pause();
  }

  build() {
    const panel = document.createElement('div');
    panel.className = 'lv-panel';
    panel.innerHTML = `
      <div class="lv-panel-header">
        <h3>Step-Through Visualizer</h3>
        <button class="lv-close-btn" title="Close">&times;</button>
      </div>
      <div class="lv-panel-body">
        <div class="lv-field">
          <label>Your solution (JavaScript)</label>
          <textarea class="lv-code-input" spellcheck="false"></textarea>
        </div>
        <div class="lv-inline-fields">
          <div class="lv-field">
            <label>Function to run</label>
            <input type="text" class="lv-text-input lv-fn-name" />
          </div>
          <div class="lv-field" style="flex: 2;">
            <label>Arguments (JSON array)</label>
            <input type="text" class="lv-text-input lv-args-input" placeholder="[[2,7,11,15], 9]" />
          </div>
        </div>
        <div class="lv-run-row">
          <button class="lv-btn lv-run-btn">Run</button>
          <button class="lv-btn lv-btn-secondary lv-step-btn" disabled>Step</button>
          <button class="lv-btn lv-btn-secondary lv-play-btn" disabled>Play</button>
          <button class="lv-btn lv-btn-secondary lv-reset-btn" disabled>Reset</button>
        </div>
        <div class="lv-error-box" style="display:none;"></div>
        <div class="lv-source-view"></div>
        <div class="lv-status-row">
          <span class="lv-step-counter">No run yet</span>
          <span><input type="range" class="lv-speed" min="80" max="1200" value="400" /> speed</span>
        </div>
        <div class="lv-viz-container"></div>
        <div class="lv-field" style="margin-top:10px;">
          <label>Console / return value</label>
          <div class="lv-output-box">—</div>
        </div>
      </div>
    `;

    this.el = panel;
    this.codeInput = panel.querySelector('.lv-code-input');
    this.fnNameInput = panel.querySelector('.lv-fn-name');
    this.argsInput = panel.querySelector('.lv-args-input');
    this.errorBox = panel.querySelector('.lv-error-box');
    this.sourceView = panel.querySelector('.lv-source-view');
    this.stepCounter = panel.querySelector('.lv-step-counter');
    this.speedSlider = panel.querySelector('.lv-speed');
    this.vizContainer = d3.select(panel.querySelector('.lv-viz-container'));
    this.outputBox = panel.querySelector('.lv-output-box');

    this.runBtn = panel.querySelector('.lv-run-btn');
    this.stepBtn = panel.querySelector('.lv-step-btn');
    this.playBtn = panel.querySelector('.lv-play-btn');
    this.resetBtn = panel.querySelector('.lv-reset-btn');

    this.codeInput.value = starterSkeleton(this.problemData);
    this.fnNameInput.value = guessEntryFunctionName(this.codeInput.value) || titleToFunctionName(this.problemData.title);
    this.argsInput.value = this.problemData.suggestedArgs || '[]';

    panel.querySelector('.lv-close-btn').addEventListener('click', () => this.close());
    this.runBtn.addEventListener('click', () => this.run());
    this.stepBtn.addEventListener('click', () => this.step());
    this.playBtn.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    this.resetBtn.addEventListener('click', () => this.reset());

    this.makeDraggable(panel, panel.querySelector('.lv-panel-header'));
  }

  makeDraggable(panel, handle) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originRight = 0;
    let originTop = 0;

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      originRight = window.innerWidth - rect.right;
      originTop = rect.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.right = `${originRight - (e.clientX - startX)}px`;
      panel.style.top = `${originTop + (e.clientY - startY)}px`;
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  showError(message) {
    this.errorBox.style.display = 'block';
    this.errorBox.textContent = message;
  }

  clearError() {
    this.errorBox.style.display = 'none';
    this.errorBox.textContent = '';
  }

  renderSource(activeLine) {
    this.sourceView.innerHTML = '';
    this.sourceLines.forEach((line, i) => {
      const div = document.createElement('div');
      div.className = `lv-source-line${i + 1 === activeLine ? ' lv-active-line' : ''}`;
      div.textContent = `${i + 1}  ${line}`;
      this.sourceView.appendChild(div);
    });
  }

  run() {
    this.clearError();
    this.pause();
    this.steps = [];
    this.currentIndex = -1;
    this.sourceLines = this.codeInput.value.split('\n');
    this.renderSource(null);

    let args;
    try {
      args = JSON.parse(this.argsInput.value || '[]');
      if (!Array.isArray(args)) throw new Error('Arguments must be a JSON array, e.g. [[2,7,11,15], 9]');
    } catch (err) {
      this.showError(`Could not parse arguments: ${err.message}`);
      return;
    }

    const entryFunction = this.fnNameInput.value.trim();
    if (!entryFunction) {
      this.showError('Enter the name of the function to run.');
      return;
    }

    let generator;
    try {
      generator = interpret({ code: this.codeInput.value, entryFunction, args });
    } catch (err) {
      this.showError(err instanceof InterpreterError ? err.message : `Unexpected error: ${err.message}`);
      return;
    }

    try {
      let count = 0;
      let result = generator.next();
      while (!result.done) {
        this.steps.push(result.value);
        count++;
        if (count > MAX_STEPS) {
          throw new InterpreterError(`Stopped after ${MAX_STEPS} steps (possible infinite loop).`);
        }
        result = generator.next();
      }
      this.finalResult = result.value;
    } catch (err) {
      this.showError(err instanceof InterpreterError ? err.message : `Runtime error: ${err.message}`);
      if (!this.steps.length) return;
    }

    this.stepBtn.disabled = this.steps.length === 0;
    this.playBtn.disabled = this.steps.length === 0;
    this.resetBtn.disabled = false;
    this.currentIndex = -1;
    this.outputBox.textContent = '—';
    this.updateStatus();
    this.step();
  }

  step() {
    if (this.currentIndex >= this.steps.length - 1) {
      this.pause();
      if (this.finalResult) {
        const { result, output } = this.finalResult;
        this.outputBox.textContent = [
          output && output.length ? output.join('\n') : null,
          `return: ${JSON.stringify(result)}`,
        ].filter(Boolean).join('\n\n');
      }
      return;
    }
    this.currentIndex++;
    const snapshot = this.steps[this.currentIndex];
    renderStep(this.vizContainer, snapshot);
    this.renderSource(snapshot.line);
    this.updateStatus();
  }

  play() {
    if (!this.steps.length) return;
    this.playing = true;
    this.playBtn.textContent = 'Pause';
    const tick = () => {
      if (!this.playing) return;
      this.step();
      if (this.currentIndex >= this.steps.length - 1) {
        this.pause();
        return;
      }
      this.timer = setTimeout(tick, Number(this.speedSlider.value));
    };
    tick();
  }

  pause() {
    this.playing = false;
    if (this.playBtn) this.playBtn.textContent = 'Play';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  reset() {
    this.pause();
    this.currentIndex = -1;
    this.vizContainer.selectAll('*').remove();
    this.renderSource(null);
    this.outputBox.textContent = '—';
    this.updateStatus();
  }

  updateStatus() {
    if (!this.steps.length) {
      this.stepCounter.textContent = 'No run yet';
      return;
    }
    this.stepCounter.textContent = `Step ${this.currentIndex + 1} / ${this.steps.length}`;
  }
}

window.LeetVision = window.LeetVision || {};
window.LeetVision.stepVisualizer = new StepVisualizerPanel();
