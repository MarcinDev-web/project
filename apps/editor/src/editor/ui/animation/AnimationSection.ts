import type { Entity } from '@engine/world';
import type { AnimationComponent } from '@engine/stdlib/Animation';
import type {
  AnimationParameter,
  AnimationParameters,
  AnimationParameterType,
} from '@engine/stdlib/Animation/types';
import type { AnimationStateConfig, AnimationTransitionConfig } from '@engine/stdlib/Animation/AnimationStateMachine';
import type { AnimationController } from '@engine/stdlib/Animation/AnimationController';
import { createIcon } from '../../utils/icons';

interface AnimationSectionOptions {
  entity: Entity;
  component: AnimationComponent;
  abortSignal: AbortSignal;
  onRequestRefresh: () => void;
  setManagedTimeout: (fn: () => void, delayMs: number) => number;
}

interface EditableTransition {
  to: string;
  blendDuration: number;
  conditions: EditableCondition[];
  hasCodeCondition: boolean;
}

interface EditableCondition {
  parameter: string;
  operator: AnimationParameterType extends never ? never : string;
  value?: boolean | number;
}

interface EditableState {
  name: string;
  controller: AnimationController;
  transitions: EditableTransition[];
  preservedTransitions: AnimationTransitionConfig[];
}

export function createAnimationSection(options: AnimationSectionOptions): HTMLElement {
  const { component, abortSignal, onRequestRefresh, setManagedTimeout } = options;

  const container = document.createElement('div');
  container.className = 'property-content animation-properties';

  const states = component.getStates();
  const activeState = component.getActiveState();
  const controllers = Array.from(component.controllers.entries());

  container.appendChild(
    createStateControls({
      component,
      abortSignal,
      onRequestRefresh,
      states,
      activeState,
    })
  );

  container.appendChild(
    createClipsList({
      component,
      abortSignal,
      onRequestRefresh,
      controllers,
    })
  );

  const timeline = createTimeline({ component, states, abortSignal, onRequestRefresh });
  if (timeline) {
    container.appendChild(timeline);
  }

  container.appendChild(
    createParametersEditor({
      component,
      abortSignal,
      onRequestRefresh,
    })
  );

  container.appendChild(
    createStateMachineEditor({
      component,
      abortSignal,
      onRequestRefresh,
      setManagedTimeout,
    })
  );

  return container;
}

function createStateControls(args: {
  component: AnimationComponent;
  abortSignal: AbortSignal;
  onRequestRefresh: () => void;
  states: AnimationStateConfig[];
  activeState: string | null;
}): HTMLElement {
  const { component, abortSignal, onRequestRefresh, states } = args;
  const activeState = args.activeState ?? states[0]?.name ?? null;
  const container = document.createElement('div');
  container.className = 'animation-state-controls';

  const header = document.createElement('div');
  header.className = 'animation-section-header';

  const title = document.createElement('h3');
  title.className = 'animation-section-title';
  title.textContent = 'Playback';
  header.appendChild(title);

  const stateSelect = document.createElement('select');
  stateSelect.className = 'animation-state-select';

  for (const state of states) {
    const option = document.createElement('option');
    option.value = state.name;
    option.textContent = state.name;
    if (state.name === activeState) {
      option.selected = true;
    }
    stateSelect.appendChild(option);
  }

  if (states.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No states';
    option.selected = true;
    stateSelect.disabled = true;
    stateSelect.appendChild(option);
  }

  const player = document.createElement('div');
  player.className = 'animation-player-controls';

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'animation-play-btn';
  playButton.appendChild(createIcon('play', 14));

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'animation-pause-btn';
  pauseButton.appendChild(createIcon('pause', 14));

  const stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.className = 'animation-stop-btn';
  stopButton.appendChild(createIcon('square', 12));

  player.appendChild(playButton);
  player.appendChild(pauseButton);
  player.appendChild(stopButton);

  header.appendChild(stateSelect);
  header.appendChild(player);
  container.appendChild(header);

  const getControllerForState = (stateName: string | null) => {
    if (!stateName) return null;
    const state = states.find((item) => item.name === stateName);
    return state?.controller ?? null;
  };

  const updateActiveState = (stateName: string | null, autoPlay: boolean) => {
    if (!stateName) return;
    component.setActiveState(stateName);
    if (autoPlay) {
      getControllerForState(stateName)?.play();
    }
    onRequestRefresh();
  };

  if (abortSignal) {
    stateSelect.addEventListener(
      'change',
      () => {
        const value = stateSelect.value || null;
        updateActiveState(value, false);
      },
      { signal: abortSignal }
    );
    playButton.addEventListener(
      'click',
      () => {
        const controller = getControllerForState(stateSelect.value || null);
        controller?.play();
        onRequestRefresh();
      },
      { signal: abortSignal }
    );
    pauseButton.addEventListener(
      'click',
      () => {
        const controller = getControllerForState(stateSelect.value || null);
        controller?.pause();
        onRequestRefresh();
      },
      { signal: abortSignal }
    );
    stopButton.addEventListener(
      'click',
      () => {
        const controller = getControllerForState(stateSelect.value || null);
        controller?.stop();
        onRequestRefresh();
      },
      { signal: abortSignal }
    );
  }

  return container;
}

function createClipsList(args: {
  component: AnimationComponent;
  controllers: Array<[string, AnimationController]>;
  abortSignal: AbortSignal;
  onRequestRefresh: () => void;
}): HTMLElement {
  const { component, controllers, abortSignal, onRequestRefresh } = args;

  const container = document.createElement('div');
  container.className = 'animation-clip-list';

  const header = document.createElement('h3');
  header.className = 'animation-section-title';
  header.textContent = 'Clips';
  container.appendChild(header);

  const list = document.createElement('div');
  list.className = 'animation-clips-grid';

  const clips = component.clips;

  for (const [name, controller] of controllers) {
    const clip = clips.get(name) ?? controller.clip;
    const item = document.createElement('div');
    item.className = 'animation-clip-item';

    const titleRow = document.createElement('div');
    titleRow.className = 'animation-clip-header';

    const title = document.createElement('span');
    title.className = 'animation-clip-name';
    title.textContent = clip.name;

    const duration = document.createElement('span');
    duration.className = 'animation-clip-duration';
    duration.textContent = `${clip.duration.toFixed(2)}s`;

    titleRow.appendChild(title);
    titleRow.appendChild(duration);
    item.appendChild(titleRow);

    const controls = document.createElement('div');
    controls.className = 'animation-clip-controls';

    const activateButton = document.createElement('button');
    activateButton.type = 'button';
    activateButton.className = 'animation-activate-btn';
    activateButton.textContent = 'Activate';
    activateButton.dataset.state = name;

    const speedInput = document.createElement('input');
    speedInput.type = 'number';
    speedInput.className = 'property-number-input';
    speedInput.step = '0.1';
    speedInput.value = controller.speed.value.toString();
    speedInput.dataset.field = `animation-speed-${name}`;
    speedInput.title = 'Speed';

    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.className = 'property-number-input';
    weightInput.step = '0.1';
    weightInput.value = controller.weight.value.toString();
    weightInput.dataset.field = `animation-weight-${name}`;
    weightInput.title = 'Weight';

    const weightLabel = document.createElement('span');
    weightLabel.className = 'animation-input-label';
    weightLabel.textContent = 'W';

    const loopLabel = document.createElement('label');
    loopLabel.className = 'animation-loop-toggle toggle-switch';

    const loopInput = document.createElement('input');
    loopInput.type = 'checkbox';
    loopInput.checked = controller.loop.value;
    loopInput.dataset.field = `animation-loop-${name}`;

    const loopSlider = document.createElement('span');
    loopSlider.className = 'toggle-slider';
    loopLabel.title = 'Loop';
    loopLabel.appendChild(loopInput);
    loopLabel.appendChild(loopSlider);

    controls.appendChild(activateButton);
    controls.appendChild(speedInput);
    controls.appendChild(weightLabel);
    controls.appendChild(weightInput);
    controls.appendChild(loopLabel);

    item.appendChild(controls);
    list.appendChild(item);

    if (abortSignal) {
      activateButton.addEventListener(
        'click',
        () => {
          component.setActiveState(name);
          controller.play();
          onRequestRefresh();
        },
        { signal: abortSignal }
      );

      speedInput.addEventListener(
        'change',
        () => {
          const value = Number.parseFloat(speedInput.value);
          if (Number.isFinite(value)) {
            controller.speed.value = value;
          }
        },
        { signal: abortSignal }
      );

      weightInput.addEventListener(
        'change',
        () => {
          const value = Number.parseFloat(weightInput.value);
          if (Number.isFinite(value)) {
            controller.weight.value = Math.max(0, value);
          }
        },
        { signal: abortSignal }
      );

      loopInput.addEventListener(
        'change',
        () => {
          controller.loop.value = loopInput.checked;
        },
        { signal: abortSignal }
      );
    }
  }

  container.appendChild(list);
  return container;
}

function createTimeline(args: {
  component: AnimationComponent;
  states: AnimationStateConfig[];
  abortSignal: AbortSignal;
  onRequestRefresh: () => void;
}): HTMLElement | null {
  const { component, states, abortSignal } = args;
  const activeStateName = component.getActiveState() ?? states[0]?.name ?? null;
  if (!activeStateName) return null;

  const state = states.find((item) => item.name === activeStateName);
  const controller = state?.controller;
  if (!controller) return null;

  const clip = controller.clip;

  const container = document.createElement('div');
  container.className = 'animation-timeline';

  const label = document.createElement('label');
  label.className = 'property-label-v2';
  label.textContent = 'Timeline';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = clip.duration.toString();
  slider.step = (clip.duration / 1000).toString();
  slider.value = controller.time.value.toString();
  slider.className = 'animation-timeline-slider';
  slider.dataset.field = 'animation-time';
  slider.dataset.state = activeStateName;
  slider.dataset.duration = clip.duration.toString();

  const display = document.createElement('span');
  display.className = 'animation-timeline-display';
  display.dataset.field = 'animation-time-display';
  display.textContent = `${controller.time.value.toFixed(2)} / ${clip.duration.toFixed(2)}s`;

  if (abortSignal) {
    slider.addEventListener(
      'input',
      () => {
        const value = Number.parseFloat(slider.value);
        if (Number.isFinite(value)) {
          controller.time.value = Math.min(Math.max(0, value), clip.duration);
          display.textContent = `${controller.time.value.toFixed(2)} / ${clip.duration.toFixed(2)}s`;
        }
      },
      { signal: abortSignal }
    );
  }

  container.appendChild(label);
  container.appendChild(slider);
  container.appendChild(display);
  return container;
}

function createParametersEditor(args: {
  component: AnimationComponent;
  abortSignal: AbortSignal;
  onRequestRefresh: () => void;
}): HTMLElement {
  const { component, abortSignal, onRequestRefresh } = args;
  const container = document.createElement('div');
  container.className = 'animation-parameters';

  const headerRow = document.createElement('div');
  headerRow.className = 'animation-parameters-header';

  const title = document.createElement('h3');
  title.className = 'animation-section-title';
  title.textContent = 'Parameters';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'animation-add-param-btn';
  addButton.appendChild(createIcon('plus', 12));
  addButton.appendChild(document.createTextNode('Add Parameter'));

  headerRow.appendChild(title);
  headerRow.appendChild(addButton);
  container.appendChild(headerRow);

  const table = document.createElement('div');
  table.className = 'animation-parameters-table';
  container.appendChild(table);

  const definitions = component.getParameterDefinitions().map((param) => ({ ...param }));
  const values = component.getParameters();

  const render = () => {
    table.innerHTML = '';
    for (let i = 0; i < definitions.length; i++) {
      const param = definitions[i]!;
      const value = values[param.name];
      table.appendChild(
        createParameterRow({
          param,
          value,
          definitions,
          values,
          index: i,
          abortSignal,
          onDefinitionsChange: () => applyChanges(),
          onValuesChange: () => applyChanges(false),
          onRequestRefresh,
        })
      );
    }
    if (definitions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = 'No parameters defined.';
      table.appendChild(empty);
    }
  };

  const applyChanges = (updateDefinitions = true) => {
    if (updateDefinitions) {
      component.setParameterDefinitions(definitions);
    }
    component.setParameters(values);
    onRequestRefresh();
  };

  if (abortSignal) {
    addButton.addEventListener(
      'click',
      () => {
        const baseName = 'Param';
        let suffix = 1;
        let candidate = `${baseName}${suffix}`;
        while (definitions.some((param) => param.name === candidate)) {
          suffix += 1;
          candidate = `${baseName}${suffix}`;
        }
        definitions.push({ name: candidate, type: 'bool', defaultValue: false });
        values[candidate] = false;
        applyChanges();
      },
      { signal: abortSignal }
    );
  }

  render();
  return container;
}

function createParameterRow(args: {
  param: AnimationParameter;
  value: boolean | number | null;
  definitions: AnimationParameter[];
  values: AnimationParameters;
  index: number;
  abortSignal: AbortSignal;
  onDefinitionsChange: () => void;
  onValuesChange: () => void;
  onRequestRefresh: () => void;
}): HTMLElement {
  const {
    param,
    value,
    definitions,
    values,
    index,
    abortSignal,
    onDefinitionsChange,
    onValuesChange,
  } = args;

  const row = document.createElement('div');
  row.className = 'animation-parameter-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'animation-parameter-name';
  nameInput.value = param.name;

  const typeSelect = document.createElement('select');
  typeSelect.className = 'animation-parameter-type';
  const types: AnimationParameterType[] = ['bool', 'number', 'trigger'];
  for (const type of types) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    if (type === param.type) {
      option.selected = true;
    }
    typeSelect.appendChild(option);
  }

  const valueCell = document.createElement('div');
  valueCell.className = 'animation-parameter-value';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'animation-remove-btn';
  removeButton.appendChild(createIcon('trash', 12));

  const updateValueUI = () => {
    valueCell.innerHTML = '';
    switch (param.type) {
      case 'bool': {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(value);
        checkbox.dataset.field = `animation-param-${param.name}`;
        checkbox.addEventListener(
          'change',
          () => {
            values[param.name] = checkbox.checked;
            onValuesChange();
          },
          { signal: abortSignal }
        );
        valueCell.appendChild(checkbox);
        break;
      }
      case 'number': {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'property-number-input';
        input.value = typeof value === 'number' ? value.toString() : '0';
        input.dataset.field = `animation-param-${param.name}`;
        input.addEventListener(
          'change',
          () => {
            const parsed = Number.parseFloat(input.value);
            if (Number.isFinite(parsed)) {
              values[param.name] = parsed;
              onValuesChange();
            }
          },
          { signal: abortSignal }
        );
        valueCell.appendChild(input);
        break;
      }
      case 'trigger': {
        const triggerButton = document.createElement('button');
        triggerButton.type = 'button';
        triggerButton.className = 'animation-trigger-btn';
        triggerButton.textContent = 'Trigger';
        triggerButton.dataset.field = `animation-param-${param.name}`;
        triggerButton.addEventListener(
          'click',
          () => {
            values[param.name] = true;
            onValuesChange();
          },
          { signal: abortSignal }
        );
        valueCell.appendChild(triggerButton);
        break;
      }
    }
  };

  updateValueUI();

  nameInput.addEventListener(
    'change',
    () => {
      const newName = nameInput.value.trim();
      if (!newName || newName === param.name) {
        nameInput.value = param.name;
        return;
      }
      if (definitions.some((definition, idx) => idx !== index && definition.name === newName)) {
        nameInput.value = param.name;
        return;
      }
      const oldName = param.name;
      param.name = newName;
      values[newName] = values[oldName] ?? (param.type === 'number' ? 0 : param.type === 'bool' ? false : null);
      delete values[oldName];
      onDefinitionsChange();
    },
    { signal: abortSignal }
  );

  typeSelect.addEventListener(
    'change',
    () => {
      const type = typeSelect.value as AnimationParameterType;
      param.type = type;
      switch (type) {
        case 'bool':
          values[param.name] = Boolean(values[param.name]);
          break;
        case 'number':
          values[param.name] = Number.isFinite(Number(values[param.name])) ? Number(values[param.name]) : 0;
          break;
        case 'trigger':
          values[param.name] = null;
          break;
      }
      updateValueUI();
      onDefinitionsChange();
    },
    { signal: abortSignal }
  );

  removeButton.addEventListener(
    'click',
    () => {
      definitions.splice(index, 1);
      delete values[param.name];
      onDefinitionsChange();
    },
    { signal: abortSignal }
  );

  row.appendChild(nameInput);
  row.appendChild(typeSelect);
  row.appendChild(valueCell);
  row.appendChild(removeButton);
  return row;
}

function createStateMachineEditor(args: {
  component: AnimationComponent;
  abortSignal: AbortSignal;
  onRequestRefresh: () => void;
  setManagedTimeout: (fn: () => void, delayMs: number) => number;
}): HTMLElement {
  const { component, abortSignal, onRequestRefresh } = args;

  const container = document.createElement('div');
  container.className = 'animation-state-machine';

  const headerRow = document.createElement('div');
  headerRow.className = 'animation-state-machine-header';

  const title = document.createElement('h3');
  title.className = 'animation-section-title';
  title.textContent = 'State Machine';
  headerRow.appendChild(title);

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'animation-add-transition-btn';
  addButton.appendChild(createIcon('plus', 12));
  addButton.appendChild(document.createTextNode('Add Transition'));
  headerRow.appendChild(addButton);

  container.appendChild(headerRow);

  const parameterOptions = component.getParameterDefinitions();
  const states = component.getStates();
  const editableStates = states.map((state) => buildEditableState(state));

  const transitionsList = document.createElement('div');
  transitionsList.className = 'animation-transitions';
  container.appendChild(transitionsList);

  const render = () => {
    transitionsList.innerHTML = '';
    for (const state of editableStates) {
      transitionsList.appendChild(
        createStateTransitionsPanel({
          state,
          editableStates,
          parameterOptions,
          abortSignal,
          onChange: () => applyStates(),
        })
      );
    }
    if (editableStates.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = 'No states configured.';
      transitionsList.appendChild(empty);
    }
  };

  const applyStates = () => {
    const newStates: AnimationStateConfig[] = [];
    for (let i = 0; i < editableStates.length; i++) {
      const editable = editableStates[i]!;
      const original = states[i];
      const preserved = editable.preservedTransitions;
      const serializable = editable.transitions
        .filter((transition) => !transition.hasCodeCondition)
        .map((transition) => ({
          to: transition.to,
          blendDuration: transition.blendDuration,
          conditions: transition.conditions
            .filter((condition) => Boolean(condition.parameter))
            .map((condition) => ({
              parameter: condition.parameter,
              operator: condition.operator as any,
              value: condition.value,
            })),
        }))
        .filter((transition) => transition.conditions.length > 0 || transition.blendDuration !== undefined);

      const mergedTransitions = [] as AnimationTransitionConfig[];
      mergedTransitions.push(...preserved.map((transition) => ({ ...transition })));
      mergedTransitions.push(...serializable);

      newStates.push({
        name: editable.name,
        controller: editable.controller,
        transitions: mergedTransitions.length > 0 ? mergedTransitions : undefined,
      });

      if (!original) {
        component.stateMachine.addState({
          name: editable.name,
          controller: editable.controller,
        });
      }
    }
    component.setStates(newStates);
    onRequestRefresh();
  };

  if (abortSignal) {
    addButton.addEventListener(
      'click',
      () => {
        if (editableStates.length === 0) return;
        const firstState = editableStates[0]!;
        firstState.transitions.push({
          to: firstState.name,
          blendDuration: 0,
          conditions: [],
          hasCodeCondition: false,
        });
        render();
      },
      { signal: abortSignal }
    );
  }

  render();
  return container;
}

function buildEditableState(state: AnimationStateConfig): EditableState {
  const transitions = state.transitions ?? [];
  const preserved: AnimationTransitionConfig[] = [];
  const editable: EditableTransition[] = [];

  for (const transition of transitions) {
    if (typeof transition.condition === 'function' && (!transition.conditions || transition.conditions.length === 0)) {
      preserved.push(transition);
    } else {
      editable.push({
        to: transition.to,
        blendDuration: transition.blendDuration ?? 0,
        conditions: (transition.conditions ?? []).map((condition) => ({
          parameter: condition.parameter,
          operator: condition.operator,
          value: condition.value,
        })),
        hasCodeCondition: typeof transition.condition === 'function',
      });
    }
  }

  return {
    name: state.name,
    controller: state.controller,
    transitions: editable,
    preservedTransitions: preserved,
  };
}

function createStateTransitionsPanel(args: {
  state: EditableState;
  editableStates: EditableState[];
  parameterOptions: AnimationParameter[];
  abortSignal: AbortSignal;
  onChange: () => void;
}): HTMLElement {
  const { state, editableStates, parameterOptions, abortSignal, onChange } = args;

  const wrapper = document.createElement('div');
  wrapper.className = 'animation-state-panel';

  const header = document.createElement('div');
  header.className = 'animation-state-panel-header';

  const name = document.createElement('h4');
  name.className = 'animation-state-name';
  name.textContent = state.name;

  header.appendChild(name);
  wrapper.appendChild(header);

  const addTransitionButton = document.createElement('button');
  addTransitionButton.type = 'button';
  addTransitionButton.className = 'animation-state-add-transition';
  addTransitionButton.appendChild(createIcon('plus', 12));
  addTransitionButton.title = 'Add transition';

  header.appendChild(addTransitionButton);

  const transitionsList = document.createElement('div');
  transitionsList.className = 'animation-state-transitions';
  wrapper.appendChild(transitionsList);

  const renderTransitions = () => {
    transitionsList.innerHTML = '';
    for (let i = 0; i < state.transitions.length; i++) {
      const transition = state.transitions[i]!;
      transitionsList.appendChild(
        createTransitionRow({
          transition,
          editableStates,
          parameterOptions,
          abortSignal,
          onRemove: () => {
            state.transitions.splice(i, 1);
            renderTransitions();
            onChange();
          },
          onChange,
        })
      );
    }
    if (state.transitions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = 'No editable transitions.';
      transitionsList.appendChild(empty);
    }
  };

  if (abortSignal) {
    addTransitionButton.addEventListener(
      'click',
      () => {
        state.transitions.push({
          to: state.name,
          blendDuration: 0,
          conditions: [],
          hasCodeCondition: false,
        });
        renderTransitions();
        onChange();
      },
      { signal: abortSignal }
    );
  }

  renderTransitions();
  return wrapper;
}

function createTransitionRow(args: {
  transition: EditableTransition;
  editableStates: EditableState[];
  parameterOptions: AnimationParameter[];
  abortSignal: AbortSignal;
  onRemove: () => void;
  onChange: () => void;
}): HTMLElement {
  const { transition, editableStates, parameterOptions, abortSignal, onRemove, onChange } = args;

  const row = document.createElement('div');
  row.className = 'animation-transition-row';

  const toSelect = document.createElement('select');
  toSelect.className = 'animation-transition-target';
  for (const state of editableStates) {
    const option = document.createElement('option');
    option.value = state.name;
    option.textContent = state.name;
    if (state.name === transition.to) {
      option.selected = true;
    }
    toSelect.appendChild(option);
  }

  const blendInput = document.createElement('input');
  blendInput.type = 'number';
  blendInput.className = 'property-number-input';
  blendInput.step = '0.1';
  blendInput.min = '0';
  blendInput.value = transition.blendDuration.toString();

  const conditionsList = document.createElement('div');
  conditionsList.className = 'animation-conditions-list';

  const addConditionButton = document.createElement('button');
  addConditionButton.type = 'button';
  addConditionButton.className = 'animation-add-condition-btn';
  addConditionButton.appendChild(createIcon('plus', 12));
  addConditionButton.title = 'Add condition';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'animation-remove-transition-btn';
  removeButton.appendChild(createIcon('trash', 12));

  const renderConditions = () => {
    conditionsList.innerHTML = '';
    for (let i = 0; i < transition.conditions.length; i++) {
      const condition = transition.conditions[i]!;
      conditionsList.appendChild(
        createConditionRow({
          condition,
          parameterOptions,
          abortSignal,
          onRemove: () => {
            transition.conditions.splice(i, 1);
            renderConditions();
            onChange();
          },
          onChange,
        })
      );
    }
    if (transition.conditions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = 'No conditions';
      conditionsList.appendChild(empty);
    }
  };

  toSelect.addEventListener(
    'change',
    () => {
      transition.to = toSelect.value;
      onChange();
    },
    { signal: abortSignal }
  );

  blendInput.addEventListener(
    'change',
    () => {
      const value = Number.parseFloat(blendInput.value);
      if (Number.isFinite(value) && value >= 0) {
        transition.blendDuration = value;
        onChange();
      }
    },
    { signal: abortSignal }
  );

  addConditionButton.addEventListener(
    'click',
    () => {
      transition.conditions.push({ parameter: parameterOptions[0]?.name ?? '', operator: '==' });
      renderConditions();
      onChange();
    },
    { signal: abortSignal }
  );

  removeButton.addEventListener('click', onRemove, { signal: abortSignal });

  renderConditions();

  row.appendChild(toSelect);
  row.appendChild(blendInput);
  row.appendChild(conditionsList);
  row.appendChild(addConditionButton);
  row.appendChild(removeButton);

  return row;
}

function createConditionRow(args: {
  condition: EditableCondition;
  parameterOptions: AnimationParameter[];
  abortSignal: AbortSignal;
  onRemove: () => void;
  onChange: () => void;
}): HTMLElement {
  const { condition, parameterOptions, abortSignal, onRemove, onChange } = args;

  const row = document.createElement('div');
  row.className = 'animation-condition-row';

  const parameterSelect = document.createElement('select');
  parameterSelect.className = 'animation-condition-parameter';
  for (const param of parameterOptions) {
    const option = document.createElement('option');
    option.value = param.name;
    option.textContent = param.name;
    if (param.name === condition.parameter) {
      option.selected = true;
    }
    parameterSelect.appendChild(option);
  }

  const operatorSelect = document.createElement('select');
  operatorSelect.className = 'animation-condition-operator';
  const operators: string[] = ['==', '!=', '>', '>=', '<', '<=', 'triggered'];
  for (const operator of operators) {
    const option = document.createElement('option');
    option.value = operator;
    option.textContent = operator;
    if (condition.operator === operator) {
      option.selected = true;
    }
    operatorSelect.appendChild(option);
  }

  const valueInput = document.createElement('input');
  valueInput.type = 'number';
  valueInput.className = 'property-number-input';
  valueInput.value = typeof condition.value === 'number' ? condition.value.toString() : '0';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'animation-remove-condition-btn';
  removeButton.appendChild(createIcon('trash', 12));

  const syncValueVisibility = () => {
    if (condition.operator === 'triggered') {
      valueInput.disabled = true;
      valueInput.classList.add('hidden');
    } else {
      valueInput.disabled = false;
      valueInput.classList.remove('hidden');
    }
  };

  syncValueVisibility();

  parameterSelect.addEventListener(
    'change',
    () => {
      condition.parameter = parameterSelect.value;
      onChange();
    },
    { signal: abortSignal }
  );

  operatorSelect.addEventListener(
    'change',
    () => {
      condition.operator = operatorSelect.value;
      syncValueVisibility();
      onChange();
    },
    { signal: abortSignal }
  );

  valueInput.addEventListener(
    'change',
    () => {
      const value = Number.parseFloat(valueInput.value);
      if (Number.isFinite(value)) {
        condition.value = value;
        onChange();
      }
    },
    { signal: abortSignal }
  );

  removeButton.addEventListener('click', onRemove, { signal: abortSignal });

  row.appendChild(parameterSelect);
  row.appendChild(operatorSelect);
  row.appendChild(valueInput);
  row.appendChild(removeButton);
  return row;
}

