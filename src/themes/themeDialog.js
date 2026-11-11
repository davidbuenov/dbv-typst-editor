// =============================================================================
// DBV Typst Editor — Selector y personalización de temas (RF-122)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import {
  ALL_THEME_IDS,
  CURATED_THEMES,
  contrastRatio,
  getCustomTheme,
  getTheme,
  getThemeDescriptor,
  getThemeSlots,
  resetCustomTheme,
  setCustomTheme,
  setTheme,
  setThemeSlot,
} from './theme.js';

const EDITABLE_TOKENS = [
  ['--bg-primary', 'theme.varBgPrimary'],
  ['--bg-secondary', 'theme.varBgSecondary'],
  ['--text-primary', 'theme.varTextPrimary'],
  ['--text-secondary', 'theme.varTextSecondary'],
  ['--accent', 'theme.varAccent'],
  ['--border', 'theme.varBorder'],
  ['--code-keyword', 'theme.varCodeKeyword'],
  ['--code-string', 'theme.varCodeString'],
  ['--code-comment', 'theme.varCodeComment'],
  ['--code-function', 'theme.varCodeFunction'],
  ['--code-number', 'theme.varCodeNumber'],
  ['--code-tag', 'theme.varCodeTag'],
  ['--code-class', 'theme.varCodeClass'],
  ['--code-operator', 'theme.varCodeOperator'],
];

/**
 * Construye el contenido interactivo del diálogo de temas: galería de los 10
 * temas curados + personalizado, asignación de los 3 botones rápidos de la
 * cabecera y editor de colores del tema personalizado con aviso de contraste.
 */
export function createThemeDialog({ bodyEl, t, onThemeApplied }) {
  function applyAndNotify(themeId) {
    setTheme(themeId);
    onThemeApplied?.(themeId);
    render();
  }

  function renderThemeCard(descriptor, activeId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-card';
    btn.classList.toggle('theme-card--active', descriptor.id === activeId);
    btn.dataset.themeId = descriptor.id;
    btn.setAttribute('aria-pressed', String(descriptor.id === activeId));

    const swatches = document.createElement('span');
    swatches.className = 'theme-card__swatches';
    swatches.style.backgroundColor = descriptor.tokens['--bg-primary'];
    swatches.style.borderColor = descriptor.tokens['--border'];
    for (const colorKey of ['--text-primary', '--accent', '--code-keyword', '--code-string']) {
      const dot = document.createElement('span');
      dot.className = 'theme-card__dot';
      dot.style.backgroundColor = descriptor.tokens[colorKey];
      swatches.append(dot);
    }

    const label = document.createElement('span');
    label.className = 'theme-card__label';
    label.textContent = `${descriptor.icon} ${t(descriptor.labelKey)}`;

    btn.append(swatches, label);
    btn.addEventListener('click', () => applyAndNotify(descriptor.id));
    return btn;
  }

  function renderSlotsSection() {
    const section = document.createElement('section');
    section.className = 'theme-dialog__section';
    const heading = document.createElement('h3');
    heading.className = 'theme-dialog__subheading';
    heading.textContent = t('theme.slotsHeading');
    section.append(heading);

    const grid = document.createElement('div');
    grid.className = 'theme-slots';
    const slots = getThemeSlots();

    slots.forEach((selectedId, index) => {
      const row = document.createElement('label');
      row.className = 'theme-slots__row';
      const span = document.createElement('span');
      span.textContent = t('theme.slotLabel').replace('{n}', String(index + 1));
      const select = document.createElement('select');
      select.className = 'form-row__input theme-slots__select';
      select.dataset.slotIndex = String(index);

      for (const themeId of ALL_THEME_IDS) {
        const desc = getThemeDescriptor(themeId);
        const opt = document.createElement('option');
        opt.value = themeId;
        opt.textContent = `${desc.icon} ${t(desc.labelKey)}`;
        opt.selected = themeId === selectedId;
        select.append(opt);
      }
      select.addEventListener('change', () => setThemeSlot(index, select.value));
      row.append(span, select);
      grid.append(row);
    });

    section.append(grid);
    return section;
  }

  function renderCustomSection() {
    const section = document.createElement('section');
    section.className = 'theme-dialog__section';
    const heading = document.createElement('h3');
    heading.className = 'theme-dialog__subheading';
    heading.textContent = t('theme.customHeading');
    section.append(heading);

    const cloneBar = document.createElement('div');
    cloneBar.className = 'theme-custom__clone';
    const cloneLabel = document.createElement('label');
    cloneLabel.className = 'theme-custom__clone-label';
    cloneLabel.textContent = t('theme.cloneFrom');
    const baseSelect = document.createElement('select');
    baseSelect.className = 'form-row__input theme-custom__base';
    for (const curated of CURATED_THEMES) {
      const opt = document.createElement('option');
      opt.value = curated.id;
      opt.textContent = t(curated.labelKey);
      baseSelect.append(opt);
    }
    const cloneBtn = document.createElement('button');
    cloneBtn.type = 'button';
    cloneBtn.className = 'button button--compact';
    cloneBtn.dataset.action = 'clone-theme';
    cloneBtn.textContent = t('theme.applyClone');
    cloneBtn.addEventListener('click', () => {
      resetCustomTheme(baseSelect.value);
      applyAndNotify('custom');
    });
    cloneBar.append(cloneLabel, baseSelect, cloneBtn);
    section.append(cloneBar);

    const custom = getCustomTheme();
    const updateContrastNote = (noteEl) => {
      const current = getCustomTheme();
      const ratio = contrastRatio(current['--text-primary'], current['--bg-primary']);
      noteEl.className = ratio >= 4.5 ? 'theme-custom__contrast theme-custom__contrast--ok' : 'theme-custom__contrast theme-custom__contrast--warn';
      noteEl.textContent = t(ratio >= 4.5 ? 'theme.contrastOk' : 'theme.contrastLow').replace('{ratio}', ratio.toFixed(1));
    };

    const contrastNote = document.createElement('p');
    updateContrastNote(contrastNote);
    section.append(contrastNote);

    const grid = document.createElement('div');
    grid.className = 'theme-custom__grid';
    for (const [tokenKey, labelKey] of EDITABLE_TOKENS) {
      const item = document.createElement('label');
      item.className = 'theme-custom__field';
      const title = document.createElement('span');
      title.className = 'theme-custom__field-label';
      title.textContent = t(labelKey);
      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'theme-custom__color';
      input.dataset.token = tokenKey;
      input.value = custom[tokenKey];
      input.addEventListener('input', () => {
        setCustomTheme({ [tokenKey]: input.value });
        if (getTheme() !== 'custom') setTheme('custom');
        onThemeApplied?.('custom');
        updateContrastNote(contrastNote);
      });
      item.append(title, input);
      grid.append(item);
    }
    section.append(grid);
    return section;
  }

  function render() {
    const activeId = getTheme();
    const listSection = document.createElement('section');
    listSection.className = 'theme-dialog__section';
    const heading = document.createElement('h3');
    heading.className = 'theme-dialog__subheading';
    heading.textContent = t('theme.curatedHeading');
    listSection.append(heading);

    const grid = document.createElement('div');
    grid.className = 'theme-cards';
    for (const id of ALL_THEME_IDS) grid.append(renderThemeCard(getThemeDescriptor(id), activeId));
    listSection.append(grid);

    bodyEl.replaceChildren(listSection, renderSlotsSection(), renderCustomSection());
  }

  return { render };
}
