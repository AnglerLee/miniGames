// 감독: 아이 화면 전체를 지휘한다.
// 진행 상태(리듀서), 단계 장면, HUD, 소리, 저장을 하나로 묶고 화면 흐름을 관리한다.
//
//   참가 -> 브리핑 -> 교신 점검 -> [단계 진입 -> 진행 -> 통과] 반복 -> 금고 개방
//                                     진행 중 발각 -> 같은 단계를 새 주파수로

import { h, showModal, createDigitEntry } from '../shared/dom.js';
import { load, save, remove } from '../shared/store.js';
import { decodeMission, formatCode, TIME_PRESETS_MIN, DIFFICULTIES } from '../shared/mission.js';
import { reduce, initialRun, rulesFor, bonusUnlocked, RUN_VERSION } from '../shared/run.js';
import { STAGES, deviceFor, manualFor, frequencyFor } from '../shared/stages.js';
import { encodeOpen, supportCode, tokenNumber } from '../shared/synccode.js';
import { createRenderer, disposeTree } from './engine/renderer.js';
import { createRig } from './engine/camera-rig.js';
import { createInteraction } from './engine/interaction.js';
import { createHud } from './hud/hud.js';
import { createAudio } from './audio/engine.js';
import { vibrate, requestFullscreen, keepAwake, blockBrowserGestures } from './platform.js';
import { createGateStage } from './stages/gate.js';
import { createDuctStage } from './stages/duct.js';
import { createPowerStage } from './stages/power.js';
import { createTokenStage } from './stages/token.js';
import { createVaultStage } from './stages/vault.js';

// 단계 번호 -> 장면 만드는 함수 (0 번 교신 점검은 3D 장면이 없다)
const FACTORIES = [null, createGateStage, createDuctStage, createPowerStage, createTokenStage, createVaultStage];

const STORY =
  '요원, 긴급 임무다.\n\n' +
  "악당 '닥터 슈가'가 온 동네 간식을 훔쳐 비밀 금고에 가둬 버렸다. " +
  '경비대가 돌아오기 전에 보안 구역을 차례로 뚫고 금고를 열어라.\n\n' +
  '너는 현장에서 보고, 본부는 매뉴얼을 본다. 본 것을 정확히 말해야 산다.';

const CLEAR_LINES = ['', '정문 게이트 돌파!', '환기 덕트 통과!', '전력 차단 성공!', '토큰 인증 완료!', ''];

export function boot() {
  blockBrowserGestures();
  const bootEl = document.getElementById('boot');
  const debug = new URLSearchParams(location.search).has('debug');

  const audio = createAudio();
  let gfx;
  try {
    gfx = createRenderer(document.getElementById('view'));
  } catch (err) {
    bootEl.textContent = '이 기기에서는 3D 화면을 쓸 수 없습니다. 다른 브라우저(크롬, 사파리)로 열어 보세요.';
    throw err;
  }
  const rig = createRig(gfx.camera);
  const interact = createInteraction(gfx.renderer.domElement, gfx.camera, rig);
  gfx.onResize(() => rig.refresh());

  let mission = null;
  let rules = rulesFor({ timePreset: 3, token: false });
  let hud = createHud(rules);
  let run = null;
  let stage = null;
  let paused = false; // 메뉴가 열려 있거나 화면이 가려진 동안
  let clockHold = false; // 단계를 푼 직후 연출이 끝날 때까지
  let reloading = false; // 장치를 다시 섞는 동안
  let timeScale = 1; // 검증용 시간 배속
  let entering = 0; // 단계 진입이 겹치지 않게 하는 번호표
  let persistAt = 0;
  let lostShown = false;

  hud.show(false);
  bootEl.remove();

  // ---------- 진행 상태 ----------

  function dispatch(event) {
    const out = reduce(run, event, rules);
    run = out.state;
    for (const effect of out.effects) handle(effect);
  }

  function handle(effect) {
    switch (effect.type) {
      case 'PERSIST':
        save('run', run);
        break;
      case 'ALARM':
        hud.setAlarm(effect.level);
        break;
      case 'TIME_HIT':
        hud.timeHit(effect.ms);
        hud.flash('#ff2a3c', 0.6);
        hud.shake();
        rig.shake(0.1, 450);
        audio.sfx('alarm');
        vibrate([120, 60, 120]);
        break;
      case 'REROLL':
        reloadDevice(effect.soft ? 'soft' : 'mistake');
        break;
      case 'CAUGHT':
        showCaught(effect.reason);
        break;
      case 'STAGE_CLEAR':
        showClear(effect);
        break;
      case 'FINISHED':
        showFinale();
        break;
    }
  }

  /** 단계 장면이 감독에게 알리는 통로 */
  const report = {
    mistake(reason) {
      dispatch({ type: 'MISTAKE', reason });
    },
    soft() {
      dispatch({ type: 'SOFT_REROLL' });
    },
    /** 풀었다. delayMs 동안 연출을 보여 준 뒤 다음으로 넘어간다. 그동안 시계는 멈춘다. */
    solved(delayMs = 0) {
      clockHold = true;
      interact.setLocked(true);
      setTimeout(() => {
        clockHold = false;
        dispatch({ type: 'STAGE_SOLVED' });
      }, delayMs / Math.max(1, timeScale));
    },
  };

  const env = { scene: gfx.scene, camera: gfx.camera, rig, interact, hud, audio, report };

  function loadDevice(reason) {
    const dev = deviceFor(mission, run.stage, run.channel, run.attempt);
    const sim = STAGES[run.stage].puzzle.createSim(dev);
    stage.load(dev, sim, reason);
  }

  /** 실수하거나 시간이 지나 장치를 다시 섞는다. 매뉴얼은 그대로라 본부는 할 일이 없다. */
  function reloadDevice(reason) {
    if (!stage) return;
    reloading = true;
    interact.setLocked(true);
    setTimeout(() => {
      reloading = false;
      if (run.phase !== 'ACTIVE') return; // 그사이 발각된 경우
      audio.sfx('reroll');
      hud.flash('#36e0ff', 0.3);
      loadDevice(reason);
      interact.setLocked(false);
    }, (reason === 'soft' ? 300 : 950) / Math.max(1, timeScale));
  }

  function dropStage() {
    if (!stage) return;
    stage.exit();
    interact.clear();
    disposeTree(stage.root);
    stage = null;
    hud.controls.replaceChildren();
    hud.setBack(null);
  }

  /** 단계에 진입한다: 장면을 짓고, 새 주파수를 알리고, 카메라가 자리를 잡으면 시계가 돈다. */
  async function enterStage() {
    const ticket = ++entering;
    paused = false;
    audio.resume();
    hud.screen(null);
    hud.show(true);
    await hud.fade(true, 250);
    if (ticket !== entering) return;
    dropStage();
    stage = FACTORIES[run.stage](env);
    gfx.scene.add(stage.root);
    loadDevice('enter');

    const frequency = frequencyFor(mission, run.stage, run.channel);
    hud.setFrequency(frequency);
    hud.setAlarm(run.alarm);
    hud.setClock(run.remainingMs, false);
    hud.caption(stage.intro);
    hud.announce(`${STAGES[run.stage].name} · 새 주파수`, frequency, '본부에 이 숫자를 불러 줘라!', 2800);
    audio.startMusic();
    audio.sfx('radio');
    interact.setLocked(true);
    // 새 주파수 알림이 떠 있는 동안은 시계를 돌리지 않는다
    const settled = Promise.all([stage.enter(), new Promise((r) => setTimeout(r, 2800 / Math.max(1, timeScale)))]);
    await hud.fade(false, 500);
    await settled;
    if (ticket !== entering) return;
    interact.setLocked(false);
    dispatch({ type: 'INTRO_DONE' });
  }

  // ---------- 화면들 ----------

  const panel = (...children) => h('div', { class: 'panel' }, ...children);

  /** 작전 코드 입력 화면 (QR 로 들어오지 않은 경우) */
  function showJoin(message) {
    const input = h('input', {
      type: 'text',
      id: 'join-code',
      maxlength: '14',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      placeholder: 'XXXX-XXXX-XXXX',
    });
    const error = h('p', { class: 'small', style: { color: 'var(--red)', minHeight: '1.5em' }, text: message || '' });
    const submit = () => {
      const found = decodeMission(input.value);
      if (!found) {
        error.textContent = '작전 코드가 맞지 않습니다. 본부 화면의 12자리를 다시 확인하세요.';
        return;
      }
      history.replaceState(null, '', '#m=' + found.code);
      startMission(found);
    };
    input.addEventListener('input', () => (input.value = formatCode(input.value).slice(0, 14)));
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', text: 'OPERATION SNACK VAULT' }),
        h('h1', { text: '현장 요원 참가' }),
        h('p', { class: 'dim', text: '본부(부모) 화면에 나온 작전 코드 12자리를 입력하세요. QR을 찍으면 자동으로 들어옵니다.' }),
        input,
        error,
        h('button', { type: 'button', class: 'btn primary block', id: 'join', text: '참가하기', onClick: submit }),
        h('a', { class: 'btn ghost block', href: 'index.html', text: '처음으로' })
      )
    );
  }

  function startMission(found) {
    mission = found;
    rules = rulesFor(mission);
    const saved = load('run');
    const usable =
      saved && saved.v === RUN_VERSION && saved.code === mission.code && saved.phase !== 'BRIEFING';
    if (!usable) {
      run = initialRun(mission, rules);
      showBriefing();
      return;
    }
    if (saved.phase === 'OPENED') {
      run = saved;
      showFinale();
      return;
    }
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', text: mission.code }),
        h('h1', { text: '진행 중인 작전이 있다' }),
        h('p', { class: 'dim', text: '이어서 하면 하던 단계의 처음부터 다시 시작한다. 남은 시간은 그대로다.' }),
        h('button', {
          type: 'button',
          class: 'btn primary block',
          id: 'resume',
          text: '이어하기',
          onClick: () => {
            startDevice();
            run = saved;
            dispatch({ type: 'RESUMED' });
            route();
          },
        }),
        h('button', {
          type: 'button',
          class: 'btn block',
          id: 'restart',
          text: '처음부터 다시',
          onClick: () => {
            remove('run');
            run = initialRun(mission, rules);
            showBriefing();
          },
        })
      )
    );
  }

  /** 저장된 단계에 맞는 화면으로 보낸다. */
  function route() {
    hud.setAlarm(run.alarm);
    hud.setClock(run.remainingMs, false);
    if (run.phase === 'COMMS') showComms();
    else if (run.phase === 'INTRO') enterStage();
    else if (run.phase === 'CLEAR') showClear({ stage: run.stage, skipped: false });
    else if (run.phase === 'CAUGHT') showCaught('time');
    else showBriefing();
  }

  /** 버튼을 누른 순간에만 할 수 있는 일: 소리 켜기, 전체 화면, 화면 꺼짐 방지 */
  function startDevice() {
    audio.unlock();
    requestFullscreen();
    keepAwake();
  }

  function showBriefing() {
    const story = h('div', { class: 'story', id: 'story' });
    let shown = 0;
    const timer = setInterval(() => {
      shown += 2;
      story.textContent = STORY.slice(0, shown);
      if (shown >= STORY.length) clearInterval(timer);
    }, 28);
    const skip = () => {
      clearInterval(timer);
      story.textContent = STORY;
    };
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', text: 'TOP SECRET' }),
        h('h1', { text: '작전명 스낵 볼트' }),
        h('div', { class: 'card', onClick: skip }, story),
        h(
          'div',
          { class: 'facts' },
          h('span', { text: `⏱ 제한 시간 ${TIME_PRESETS_MIN[mission.timePreset]}분` }),
          h('span', { text: `난이도 ${DIFFICULTIES[mission.difficulty].name}` }),
          h('span', { text: '🚨 실수하면 경보 +1, 30초 차감' }),
          h('span', { text: `경보 ${rules.alarmMax}단계면 발각` })
        ),
        h('button', {
          type: 'button',
          class: 'btn block',
          id: 'sound-test',
          text: '🔊 소리 시험',
          onClick: () => {
            audio.unlock();
            setTimeout(() => audio.sfx('granted'), 60);
          },
        }),
        h('button', {
          type: 'button',
          class: 'btn primary block',
          id: 'start',
          text: '작전 개시',
          onClick: () => {
            clearInterval(timer);
            startDevice();
            dispatch({ type: 'START' });
            showComms();
          },
        })
      )
    );
  }

  /** 0단계 교신 점검: 주파수 주고받기를 익히고 두 폰의 내용이 같은지 확인한다. */
  function showComms(attempt = 0) {
    const frequency = frequencyFor(mission, 0, run.channel);
    const dev = deviceFor(mission, 0, run.channel, attempt);
    const sim = STAGES[0].puzzle.createSim(dev);
    const message = h('p', { class: 'small', style: { minHeight: '1.5em', color: 'var(--red)' } });
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', text: '교신 점검' }),
        h('h1', { text: '본부와 연결하라' }),
        h('p', { class: 'dim', text: '아래 주파수를 본부에 불러 줘라.' }),
        h('div', { class: 'big-code', id: 'comms-frequency', text: frequency }),
        h('p', { class: 'dim', text: '본부가 말해 주는 암구호를 골라라.' }),
        h(
          'div',
          { class: 'word-grid' },
          dev.options.map((word, index) =>
            h('button', {
              type: 'button',
              class: 'btn',
              'data-word': word,
              text: word,
              onClick: () => {
                if (sim.act({ type: 'choose', index }).status === 'solved') {
                  audio.sfx('granted');
                  dispatch({ type: 'COMMS_OK' });
                  enterStage();
                } else {
                  audio.sfx('denied');
                  vibrate(120);
                  showComms(attempt + 1);
                  document.querySelector('#screen .small').textContent = '암구호가 틀렸다. 본부에 다시 물어봐라.';
                }
              },
            })
          )
        ),
        message,
        h('p', { class: 'small dim', text: '아직 시계는 돌지 않는다. 암구호를 맞히면 작전이 시작된다.' })
      )
    );
  }

  const clockText = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function showClear(effect) {
    // 메뉴가 열린 채로 넘어왔더라도 멈춤 상태가 남지 않게 한다
    paused = false;
    audio.resume();
    audio.sfx('clear');
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', text: effect.skipped ? '본부 우회 지원' : '구역 돌파' }),
        h('h1', { text: effect.skipped ? '우회로로 통과했다' : CLEAR_LINES[effect.stage] }),
        h(
          'div',
          { class: 'stats' },
          h('div', {}, h('b', { text: clockText(run.remainingMs) }), '남은 시간'),
          h('div', {}, h('b', { text: `${run.alarm} / ${rules.alarmMax}` }), '경보 단계'),
          h('div', {}, h('b', { text: String(run.mistakes) }), '실수')
        ),
        h('p', { class: 'dim', text: '다음 구역에서는 주파수가 바뀐다. 들어가자마자 본부에 새 숫자를 알려라.' }),
        h('button', {
          type: 'button',
          class: 'btn primary block',
          id: 'next',
          text: '다음 구역으로',
          onClick: () => {
            dispatch({ type: 'NEXT' });
            enterStage();
          },
        })
      ),
      'glass'
    );
  }

  function showCaught(reason) {
    paused = false;
    audio.resume();
    audio.sfx('siren');
    audio.sfx('caught');
    vibrate([300, 100, 300, 100, 300]);
    hud.flash('#ff2a3c', 0.8);
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', style: { color: 'var(--red)' }, text: 'ALERT' }),
        h('h1', { text: reason === 'time' ? '시간 초과! 경비대가 도착했다' : '경보 최고 단계! 발각됐다' }),
        h('p', {
          text: '간신히 몸을 숨겼다. 보안 시스템이 재설정되어 주파수와 매뉴얼이 모두 바뀐다.',
        }),
        h('p', { class: 'dim', text: '보너스 보상은 사라졌다. 그래도 금고는 아직 열 수 있다. 다시 침투하라!' }),
        h('button', {
          type: 'button',
          class: 'btn danger block',
          id: 'retry',
          text: '재침투',
          onClick: () => {
            dispatch({ type: 'CAUGHT_ACK' });
            enterStage();
          },
        })
      ),
      'alert'
    );
  }

  function showFinale() {
    audio.stopMusic();
    const rank = run.rank;
    const code = encodeOpen(mission, rank);
    const records = load('records', []);
    if (!records.some((r) => r.code === mission.code)) {
      records.unshift({
        code: mission.code,
        at: Date.now(),
        rank,
        remainingMs: run.remainingMs,
        mistakes: run.mistakes,
        captures: run.captures,
      });
      save('records', records.slice(0, 20));
    }
    hud.show(false);
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', style: { color: 'var(--gold)' }, text: 'MISSION COMPLETE' }),
        h('h1', { text: '금고 개방!' }),
        h(
          'div',
          { class: 'gold-card' },
          h('div', { class: 'small dim', text: '개봉 코드' }),
          h('div', { class: 'big-code', id: 'open-code', text: code }),
          h('p', { style: { fontWeight: '700', marginTop: '6px' }, text: '본부에 이 숫자를 외쳐라!' })
        ),
        h('div', {}, h('div', { class: 'small dim', text: '작전 등급' }), h('div', { class: 'rank-stamp', id: 'rank', text: rank })),
        h(
          'div',
          { class: 'stats' },
          h('div', {}, h('b', { text: clockText(run.remainingMs) }), '남은 시간'),
          h('div', {}, h('b', { text: String(run.mistakes) }), '실수'),
          h('div', {}, h('b', { text: String(run.captures) }), '발각')
        ),
        h('p', {
          class: 'dim small',
          text: bonusUnlocked(rank)
            ? '발각 없이 해냈다. 본부에 보너스 보상이 있는지 물어봐라!'
            : '다음에는 한 번도 발각되지 않고 A등급 이상을 노려 보자.',
        }),
        h('a', { class: 'btn ghost block', href: 'index.html', text: '처음 화면으로' })
      ),
      'gold'
    );
  }

  // ---------- 메뉴 (일시 정지) ----------

  function closeMenu() {
    hud.screen(null);
    paused = false;
    audio.resume();
  }

  function openMenu() {
    if (!run || hud.screenOpen()) return;
    paused = true;
    audio.suspend();
    const canSkip = run.phase === 'ACTIVE' && run.stage >= 1 && !clockHold;
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', text: '일시 정지' }),
        h('h1', { text: '잠시 멈춤' }),
        h('p', { class: 'dim', text: '멈춘 동안에는 시계가 가지 않는다.' }),
        h(
          'div',
          { class: 'menu-list' },
          h('button', { type: 'button', class: 'btn primary block', id: 'resume-play', text: '계속하기', onClick: closeMenu }),
          canSkip
            ? h('button', { type: 'button', class: 'btn block', id: 'support', text: '🆘 본부 지원 코드', onClick: showSupportEntry })
            : null,
          h('button', {
            type: 'button',
            class: 'btn block',
            text: audio.muted ? '🔈 소리 켜기' : '🔇 소리 끄기',
            onClick: (e) => {
              audio.setMuted(!audio.muted);
              e.target.textContent = audio.muted ? '🔈 소리 켜기' : '🔇 소리 끄기';
            },
          }),
          h('button', {
            type: 'button',
            class: 'btn ghost block',
            text: '작전 포기',
            onClick: async () => {
              const ok = await showModal({
                title: '작전을 포기할까?',
                text: '지금까지의 진행이 모두 사라진다.',
                actions: [
                  { label: '취소', value: false },
                  { label: '포기', value: true, kind: 'danger' },
                ],
              });
              if (!ok) return;
              remove('run');
              location.href = 'index.html';
            },
          })
        )
      ),
      'glass'
    );
  }

  /** 본부가 발급한 우회 코드를 입력받는다. 맞으면 현재 단계를 건너뛴다. */
  function showSupportEntry() {
    const message = h('p', { class: 'dim', text: '본부가 불러 주는 세 자리 숫자를 입력하라.' });
    const entry = createDigitEntry({
      length: 3,
      onComplete(code) {
        if (code !== supportCode(mission, 'skip', run.stage, run.channel)) {
          entry.reject();
          message.style.color = 'var(--red)';
          message.textContent = '코드가 맞지 않는다. 다시 확인하라.';
          return;
        }
        hud.screen(null);
        paused = false;
        audio.resume();
        dispatch({ type: 'SUPPORT' });
      },
    });
    hud.screen(
      panel(
        h('div', { class: 'eyebrow', text: '본부 지원' }),
        h('h1', { text: '우회 코드 입력' }),
        message,
        entry.el,
        h('button', { type: 'button', class: 'btn ghost block', text: '돌아가기', onClick: closeMenu })
      ),
      'glass'
    );
  }

  hud.onMenu(openMenu);

  // 화면이 가려지면 저장하고 멈춘다. 돌아오면 메뉴가 떠 있어 눌러야 이어진다.
  document.addEventListener('visibilitychange', () => {
    if (!run) return;
    if (document.hidden) {
      save('run', run);
      audio.suspend();
      if (run.phase === 'ACTIVE') openMenu();
    } else if (!paused) {
      audio.resume();
    }
  });
  window.addEventListener('pagehide', () => run && run.phase !== 'BRIEFING' && save('run', run));

  // ---------- 매 프레임 ----------

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, now - last);
    last = now;
    if (document.hidden) return;

    // WebGL 연결이 끊기면 멈추고 알린다. 진행은 저장되어 있어 새로고침해도 이어진다.
    if (gfx.lost !== lostShown) {
      lostShown = gfx.lost;
      if (gfx.lost) {
        paused = true;
        hud.screen(
          panel(
            h('h1', { text: '화면을 복구하는 중...' }),
            h('p', { class: 'dim', text: '잠시 기다려도 돌아오지 않으면 새로고침하세요. 진행은 저장되어 있습니다.' }),
            h('button', { type: 'button', class: 'btn primary block', text: '새로고침', onClick: () => location.reload() })
          ),
          'glass'
        );
      } else {
        closeMenu();
      }
    }

    const scaled = dt * timeScale;
    const ticking = !!run && run.phase === 'ACTIVE' && !paused && !clockHold;
    if (ticking) dispatch({ type: 'TICK', dt: scaled });

    if (run) {
      if (stage && !paused) stage.update(scaled / 1000, ticking && !reloading);
      rig.update(dt);
      hud.setClock(run.remainingMs, ticking);
      // 긴장도: 시간이 줄수록, 경보가 오를수록 높아진다. 마지막 1분은 최고조.
      const spent = 1 - run.remainingMs / rules.totalMs;
      const tension = run.remainingMs < 60000 ? 1 : 0.12 + spent * 0.55 + run.alarm * 0.1;
      audio.setTension(tension);
      audio.update();
      if (ticking && now - persistAt > 2000) {
        persistAt = now;
        save('run', run);
      }
    }
    gfx.render(dt);
  }
  requestAnimationFrame(frame);

  // ---------- 검증용 ----------
  if (debug) {
    window.__opVault = {
      state: () => (run ? { ...run } : null),
      mission: () => mission,
      frequency: () => frequencyFor(mission, run.stage, run.channel),
      view: () => (stage && stage.sim ? stage.sim.view() : null),
      act: (action) => stage.act(action),
      /** 매뉴얼과 화면에 보이는 것만으로 현재 단계를 푼다 */
      autoSolve() {
        const puzzle = STAGES[run.stage].puzzle;
        const manual = manualFor(mission, run.stage, run.channel);
        const proxy = { view: () => stage.sim.view(), act: (action) => stage.act(action) };
        return run.stage === 4 ? puzzle.solve(manual, proxy, tokenNumber(mission)) : puzzle.solve(manual, proxy);
      },
      forceMistake: () => dispatch({ type: 'MISTAKE', reason: 'debug' }),
      setTimeScale: (n) => (timeScale = n),
      renderInfo: () => gfx.info(),
      audio: () => audio.debug(),
      flags: () => ({ paused, clockHold, reloading, locked: interact.locked }),
      dialScreen: () => (stage && stage.dialScreen ? stage.dialScreen() : null),
      touchPoints: () => (stage && stage.touchPoints ? stage.touchPoints() : null),
      loseContext() {
        const ext = gfx.renderer.getContext().getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
        return ext;
      },
    };
  }

  // 코드 입력 화면에 머무는 동안 같은 탭에서 QR 링크가 열리면 바로 참가한다
  window.addEventListener('hashchange', () => {
    if (mission) return;
    const code = (location.hash.match(/m=([^&]+)/) || [])[1];
    const arrived = code ? decodeMission(decodeURIComponent(code)) : null;
    if (arrived) startMission(arrived);
  });

  // ---------- 시작 ----------
  const fromLink = (location.hash.match(/m=([^&]+)/) || [])[1];
  const found = fromLink ? decodeMission(decodeURIComponent(fromLink)) : null;
  if (found) {
    startMission(found);
  } else {
    const saved = load('run');
    const resumed = !fromLink && saved ? decodeMission(saved.code) : null;
    if (resumed) startMission(resumed);
    else showJoin(fromLink ? '링크의 작전 코드가 올바르지 않습니다. 코드를 직접 입력하세요.' : '');
  }
}
