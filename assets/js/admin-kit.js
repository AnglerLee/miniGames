// 관리자 페이지 공통 도구
// 난이도 슬라이더(쉬움·보통·어려움)와 설정 칸을 선언만으로 만들고, localStorage 에 저장한다.
// 사용법은 docs/arcade-guide.md 의 "관리자 페이지" 절을 본다.
(function () {
  'use strict';

  const LEVELS = ['🟢 쉬움', '🟡 보통', '🔴 어려움'];

  // 저장 키 접두사. 게임 쪽(arcade.js 의 Arcade.ns)과 같아야 게임이 이 설정을 읽는다.
  const NS = 'minigames:';
  const ns = (key) => NS + key;

  const CSS = `
    .ak-slider-box { margin: 0 0 1.5rem; }
    .ak-slider-box input[type=range] { width: 100%; accent-color: var(--primary-color); height: 28px; }
    .ak-levels { display: flex; justify-content: space-between; font-size: .9rem; color: var(--secondary-color); }
    .ak-levels .on { color: var(--primary-color); font-weight: 700; }
    .ak-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .ak-grid.one { grid-template-columns: 1fr; }
    .ak-grid small, .ak-help { display: block; margin-top: .3rem; font-size: .8rem; color: var(--secondary-color); line-height: 1.4; }
    .ak-check { display: flex; align-items: center; gap: .6rem; font-weight: 600; }
    .ak-check input { width: 22px; height: 22px; }
    .ak-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: .7rem 1.4rem;
      border-radius: 999px; background: #1e1b4b; color: #fff; font-weight: 600; box-shadow: var(--shadow-lg);
      opacity: 0; transition: opacity .2s; pointer-events: none; z-index: 100; }
    .ak-toast.on { opacity: 1; }
    .ak-note { margin: 0 0 1.5rem; padding: .9rem 1rem; border-radius: 12px; background: #eef2ff; color: #3730a3;
      font-size: .9rem; line-height: 1.5; }
    .ak-danger { margin-top: 1.5rem; text-align: center; }
    .ak-danger button { background: none; border: 0; color: var(--danger-color); font: inherit; font-size: .85rem;
      text-decoration: underline; cursor: pointer; }
    @media (max-width: 640px) { .ak-grid { grid-template-columns: 1fr; } }
  `;

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(children === undefined ? [] : children).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function load(key) {
    try {
      const v = JSON.parse(localStorage.getItem(ns(key)));
      return v && typeof v === 'object' ? v : {};
    } catch (e) {
      return {};
    }
  }

  let toastEl = null;
  let toastTimer = null;
  function toast(text) {
    if (!toastEl) {
      toastEl = h('div', { class: 'ak-toast' });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1800);
  }

  /**
   * 관리자 페이지를 만든다.
   * spec:
   *   title, subtitle, storageKey, gameUrl('index.html'), note(안내 문구 html)
   *   presets  [쉬움, 보통, 어려움] 각 난이도의 기본값 객체. 없으면 슬라이더를 만들지 않는다
   *   fields   난이도에 따라 기본값이 바뀌는 칸들
   *   extras   난이도와 무관한 칸들 (각 칸에 default 필요)
   *   recordId 주면 "이 게임의 기록 지우기"가 생긴다 (예: 'game12')
   *   onRender(card, api)  직접 만든 부분을 덧붙일 때. api: { values(), set(key, v), save(), toast(text) }
   * 칸: { key, label, type: 'number'|'text'|'select'|'checkbox'|'textarea', min, max, step, help, options:[[값,이름]], default }
   *      { section: '제목' } 을 넣으면 그 자리에서 묶음이 나뉜다
   */
  function page(spec) {
    document.head.appendChild(h('style', { text: CSS }));
    const saved = load(spec.storageKey);
    const hasPresets = Array.isArray(spec.presets) && spec.presets.length === 3;
    let level = Math.min(2, Math.max(0, parseInt(saved.difficulty, 10) || 0));
    const inputs = {};

    function defaultOf(field) {
      if (hasPresets && spec.presets[level][field.key] !== undefined) return spec.presets[level][field.key];
      return field.default;
    }

    function makeInput(field) {
      const id = 'f_' + field.key;
      let input;
      if (field.type === 'select') {
        input = h('select', { id, class: 'form-input' }, field.options.map(([v, name]) => h('option', { value: v, text: name })));
      } else if (field.type === 'textarea') {
        input = h('textarea', { id, class: 'form-input', rows: field.rows || 3, placeholder: field.placeholder });
      } else if (field.type === 'checkbox') {
        input = h('input', { id, type: 'checkbox' });
      } else {
        input = h('input', {
          id,
          class: 'form-input',
          type: field.type || 'number',
          min: field.min,
          max: field.max,
          step: field.step,
          placeholder: field.placeholder,
        });
      }
      inputs[field.key] = { input, field };
      if (field.type === 'checkbox') {
        return h('div', { class: 'form-group' }, [
          h('label', { class: 'ak-check', for: id }, [input, field.label]),
          field.help ? h('small', { class: 'ak-help', text: field.help }) : null,
        ]);
      }
      return h('div', { class: 'form-group' }, [
        h('label', { for: id, text: field.label }),
        input,
        field.help ? h('small', { class: 'ak-help', text: field.help }) : null,
      ]);
    }

    function write(key, value) {
      const { input, field } = inputs[key];
      if (field.type === 'checkbox') input.checked = !!value;
      else input.value = value === undefined || value === null ? '' : value;
    }

    function read(key) {
      const { input, field } = inputs[key];
      if (field.type === 'checkbox') return input.checked;
      if (field.type === 'number' || field.type === undefined) {
        let v = parseFloat(input.value);
        if (!Number.isFinite(v)) v = Number(defaultOf(field));
        if (field.min !== undefined) v = Math.max(Number(field.min), v);
        if (field.max !== undefined) v = Math.min(Number(field.max), v);
        return v;
      }
      return input.value;
    }

    function renderFields(list) {
      const out = [];
      let grid = null;
      (list || []).forEach((field) => {
        if (field.section) {
          grid = null;
          out.push(h('h2', { class: 'form-section-title', text: field.section }));
          return;
        }
        if (!grid) {
          grid = h('div', { class: 'ak-grid' + (field.wide ? ' one' : '') });
          out.push(grid);
        }
        if (field.wide && !grid.classList.contains('one')) {
          grid = h('div', { class: 'ak-grid one' });
          out.push(grid);
        }
        grid.appendChild(makeInput(field));
        if (field.wide) grid = null;
      });
      return out;
    }

    // 난이도 슬라이더
    let slider = null;
    let levelLabels = null;
    function paintLevel() {
      if (!levelLabels) return;
      Array.from(levelLabels.children).forEach((s, i) => s.classList.toggle('on', i === level));
    }
    const sliderBox = hasPresets
      ? h('div', { class: 'ak-slider-box' }, [
          h('h2', { class: 'form-section-title', text: '🎮 난이도' }),
          (slider = h('input', { type: 'range', id: 'difficultySlider', min: 0, max: 2, step: 1, value: level })),
          (levelLabels = h('div', { class: 'ak-levels' }, LEVELS.map((t) => h('span', { text: t })))),
        ])
      : null;

    const presetNodes = renderFields(spec.fields);
    const extraNodes = renderFields(spec.extras);

    const form = h('form', { id: 'settingsForm' }, [
      spec.note ? h('div', { class: 'ak-note', html: spec.note }) : null,
      sliderBox,
      hasPresets && presetNodes.length ? h('h2', { class: 'form-section-title', text: '⚙️ 세부 설정' }) : null,
      ...presetNodes,
      ...extraNodes,
    ]);
    const card = h('div', { class: 'admin-form-card' }, form);

    function fill(useSaved) {
      Object.keys(inputs).forEach((key) => {
        const { field } = inputs[key];
        const fromSaved = useSaved && saved[key] !== undefined ? saved[key] : undefined;
        write(key, fromSaved !== undefined ? fromSaved : defaultOf(field));
      });
      paintLevel();
    }

    function values() {
      const out = {};
      if (hasPresets) out.difficulty = level;
      Object.keys(inputs).forEach((key) => (out[key] = read(key)));
      return out;
    }

    function save() {
      // 이 도구가 모르는 값(직접 만든 부분이 저장한 값)은 그대로 둔다
      const next = Object.assign({}, load(spec.storageKey), values(), { lastUpdated: new Date().toISOString() });
      try {
        localStorage.setItem(ns(spec.storageKey), JSON.stringify(next));
        toast('저장했어요');
        return true;
      } catch (e) {
        toast('저장하지 못했어요: ' + e.message);
        return false;
      }
    }

    if (slider) {
      slider.addEventListener('input', () => {
        level = parseInt(slider.value, 10);
        // 난이도를 바꾸면 그 난이도의 기본값을 다시 채운다
        (spec.fields || []).forEach((f) => f.key && write(f.key, defaultOf(f)));
        paintLevel();
      });
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      save();
    });

    const api = {
      values,
      set: write,
      save,
      toast,
      level: () => level,
      stored: () => load(spec.storageKey),
    };

    const buttons = h('div', { class: 'btn-group' }, [
      h('button', {
        type: 'button',
        class: 'btn btn-home',
        text: '게임으로',
        onclick: () => (location.href = spec.gameUrl || 'index.html'),
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-reset',
        text: '초기화',
        onclick: (e) => {
          // 실수로 누르는 것을 막기 위해 두 번 눌러야 초기화된다
          const btn = e.currentTarget;
          if (!btn.dataset.armed) {
            btn.dataset.armed = '1';
            btn.textContent = '한 번 더 누르면 초기화';
            toast('정말 초기화할까요? 한 번 더 누르세요');
            setTimeout(() => {
              delete btn.dataset.armed;
              btn.textContent = '초기화';
            }, 3000);
            return;
          }
          delete btn.dataset.armed;
          btn.textContent = '초기화';
          try {
            localStorage.removeItem(ns(spec.storageKey));
          } catch (e) {
            /* 저장소를 쓸 수 없는 환경 */
          }
          Object.keys(saved).forEach((k) => delete saved[k]);
          level = 0;
          if (slider) slider.value = 0;
          fill(false);
          if (spec.onReset) spec.onReset(api);
          toast('기본값으로 되돌렸어요');
        },
      }),
      h('button', { type: 'submit', id: 'akSave', class: 'btn btn-save', text: '저장하기' }),
    ]);

    const container = h('div', { class: 'container' }, [
      h('a', { href: spec.listUrl || '../../admin.html', class: 'main-link', text: '← 전체 게임 목록' }),
      h('header', { class: 'admin-header' }, [
        h('h1', { text: spec.title }),
        h('div', { class: 'subtitle', text: spec.subtitle || '게임 설정 관리' }),
      ]),
      card,
    ]);
    document.body.appendChild(container);

    fill(true);
    if (spec.onRender) spec.onRender(form, api);
    form.appendChild(buttons);

    if (spec.recordId) {
      card.appendChild(
        h('div', { class: 'ak-danger' }, [
          h('button', {
            type: 'button',
            text: '이 게임의 별과 최고 기록 지우기',
            onclick: () => {
              const all = load('arcade_records');
              delete all[spec.recordId];
              localStorage.setItem(ns('arcade_records'), JSON.stringify(all));
              toast('기록을 지웠어요');
            },
          }),
        ])
      );
    }
    return api;
  }

  window.AdminKit = { page, toast, h, ns };
})();
