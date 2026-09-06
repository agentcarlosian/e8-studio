// An opt-in guide. Scene changes and dismissal persistence belong to the caller.
export const QUICK_START_STEPS = Object.freeze([
  Object.freeze({
    id: 'e8-rings',
    title: 'Find the eight rings',
    description: 'E8 has 240 roots. This projection arranges them into eight rings of 30 points.',
    prompt: 'Follow one ring around the center. Look for the same pattern at different sizes.',
    nextLabel: 'Explore a solid',
  }),
  Object.freeze({
    id: 'platonic-geometry',
    title: 'Turn an icosahedron',
    description: 'Twenty triangular faces form this Platonic solid. Every face has the same shape.',
    prompt: 'Drag the canvas to turn it. Scroll or pinch to zoom. Take your time; motion is in your hands.',
    nextLabel: 'Choose a look',
  }),
  Object.freeze({
    id: 'visual-style',
    title: 'Make it your own',
    description: 'Try a palette in Visuals and see how color changes the geometry. On a phone, open the controls menu to find Visuals.',
    prompt: 'When you like the result, save your scene or share a link so someone else can explore it.',
    nextLabel: 'Finish exploring',
  }),
]);

/**
 * applyStep(step, index) synchronously applies a scene/workspace on Start, Back,
 * or Next. It must respect the user's motion preferences. Nothing runs on boot.
 * onDismiss({ completed, stepId }) runs after removal; restoreFocus(invoker),
 * when provided, then restores focus after any caller-owned panel rerender.
 */
export function createQuickStart({ applyStep, onDismiss = () => {}, restoreFocus, shouldYieldEscape = () => false } = {}) {
  if (typeof applyStep !== 'function') throw new TypeError('Quick start requires an applyStep callback.');

  let coach = null;
  let invoker = null;
  let stepIndex = 0;
  let failedStep = null;

  function close({ completed = false } = {}) {
    if (!coach) return false;
    const previousInvoker = invoker;
    const stepId = QUICK_START_STEPS[stepIndex].id;
    window.removeEventListener('keydown', onKeyDown, true);
    coach.remove();
    coach = null;
    invoker = null;
    try {
      onDismiss({ completed, stepId });
    } finally {
      if (restoreFocus) restoreFocus(previousInvoker);
      else if (previousInvoker?.isConnected) previousInvoker.focus({ preventScroll: true });
    }
    return true;
  }

  function onKeyDown(event) {
    if (!coach || event.key !== 'Escape' || event.defaultPrevented) return;
    // A modal opened while exploring owns its Escape key until it closes.
    if (event.target?.closest?.('[aria-modal="true"]') || shouldYieldEscape()) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  function render() {
    const step = QUICK_START_STEPS[stepIndex];
    coach.dataset.step = step.id;
    coach.innerHTML = `
      <div class="quick-start-topline">
        <p id="quick-start-progress" class="quick-start-progress" role="status" aria-live="polite" aria-atomic="true">Step ${stepIndex + 1} of ${QUICK_START_STEPS.length} · Start exploring</p>
        <button type="button" class="quick-start-close" data-quick-start="close" aria-label="Close exploration guide" title="Close guide (Escape)">×</button>
      </div>
      <div class="quick-start-track" aria-hidden="true">${QUICK_START_STEPS.map((_, index) => `<span class="${index <= stepIndex ? 'is-reached' : ''}"></span>`).join('')}</div>
      <h2 id="quick-start-heading" tabindex="-1" aria-describedby="quick-start-progress">${step.title}</h2>
      <p id="quick-start-description" class="quick-start-description">${step.description}</p>
      <p class="quick-start-prompt">${step.prompt}</p>
      ${failedStep !== null ? '<p class="quick-start-error" role="alert">This step could not load. Try again, or close the guide.</p>' : ''}
      <div class="quick-start-actions">
        <button type="button" class="quick-start-back" data-quick-start="back" ${stepIndex === 0 ? 'disabled' : ''}>Back</button>
        <button type="button" class="quick-start-next" data-quick-start="next">${failedStep !== null ? 'Try again' : step.nextLabel}</button>
      </div>`;
    coach.querySelector('#quick-start-heading').focus({ preventScroll: true });
  }

  function showStep(index) {
    try {
      applyStep(QUICK_START_STEPS[index], index);
      stepIndex = index;
      failedStep = null;
    } catch {
      failedStep = index;
    }
    render();
  }

  function onClick(event) {
    const button = event.target.closest('[data-quick-start]');
    if (!button || button.disabled) return;
    const action = button.dataset.quickStart;
    if (action === 'close') close();
    else if (action === 'back' && stepIndex > 0) showStep(stepIndex - 1);
    else if (action === 'next') {
      if (failedStep !== null) showStep(failedStep);
      else if (stepIndex < QUICK_START_STEPS.length - 1) showStep(stepIndex + 1);
      else close({ completed: true });
    }
  }

  function start() {
    if (coach) {
      coach.querySelector('#quick-start-heading').focus({ preventScroll: true });
      return false;
    }
    invoker = document.activeElement;
    stepIndex = 0;
    failedStep = null;
    coach = document.createElement('section');
    coach.id = 'quick-start-coach';
    coach.className = 'quick-start-coach';
    coach.setAttribute('role', 'region');
    coach.setAttribute('aria-labelledby', 'quick-start-heading');
    coach.setAttribute('aria-describedby', 'quick-start-description');
    coach.addEventListener('click', onClick);
    document.body.appendChild(coach);
    window.addEventListener('keydown', onKeyDown, true);
    showStep(0);
    return true;
  }

  return { start, close, get active() { return coach !== null; } };
}
