import {
  SWITCH_KEYS,
  SWITCH_LABELS,
} from '../lib/switch-logic.js';
import { loadSwitches, saveSwitch } from '../lib/browser-storage.js';

const container = document.getElementById('switches');

/** @type {Record<string, HTMLInputElement>} */
const inputs = {};

for (let i = 0; i < SWITCH_KEYS.length; i += 1) {
  const key = SWITCH_KEYS[i];
  const labelText = SWITCH_LABELS[i];

  const label = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = key;
  input.addEventListener('change', () => {
    void saveSwitch(key, input.checked);
  });

  label.append(span, input);
  container.append(label);
  inputs[key] = input;
}

void loadSwitches().then((switches) => {
  for (const key of SWITCH_KEYS) {
    inputs[key].checked = switches[key];
  }
});
