(() => {  
'use strict';
  const $ = id => document.getElementById(id);
  const OPS = ['sa', 'sb', 'ss', 'pa', 'pb', 'ra', 'rb', 'rr', 'rra', 'rrb', 'rrr'];
  const D = { sa: ['Intercambiar A', 'Intercambia los dos elementos superiores de A.'], sb: ['Intercambiar B', 'Intercambia los dos elementos superiores de B.'], ss: ['Intercambiar A y B', 'Intercambia los dos primeros de ambas pilas.'], pa: ['Pasar a A', 'Mueve el primer elemento de B al principio de A.'], pb: ['Pasar a B', 'Mueve el primer elemento de A al principio de B.'], ra: ['Rotar A', 'Pasa el primer elemento de A al final.'], rb: ['Rotar B', 'Pasa el primer elemento de B al final.'], rr: ['Rotar A y B', 'Rota las dos pilas hacia arriba.'], rra: ['Rotar A al revés', 'Mueve el último elemento de A al principio.'], rrb: ['Rotar B al revés', 'Mueve el último elemento de B al principio.'], rrr: ['Rotar A y B al revés', 'Rota las dos pilas hacia abajo.'] };
  const LIM = 500, MANUAL_LIM = 30, VISIBLE_LABEL_LIMIT = 30, MAX_OPS = 100000, MAX_TEXT_BYTES = 1024 * 1024, CHECK = 64, MIN = -2147483648, MAX = 2147483647;
  const SPEEDS = [{ label: '0,5×', factor: .5, description: 'medio ritmo' }, { label: '1×', factor: 1, description: 'normal' }, { label: '2×', factor: 2, description: 'doble' }, { label: '5×', factor: 5, description: 'cinco veces' }, { label: '10×', factor: 10, description: 'diez veces' }, { label: '20×', factor: 20, description: 'veinte veces' }, { label: '50×', factor: 50, description: 'cincuenta veces' }, { label: '100×', factor: 100, description: 'cien veces' }, { label: '250×', factor: 250, description: 'doscientas cincuenta veces' }, { label: '500×', factor: 500, description: 'quinientas veces' }, { label: '1000×', factor: 1000, description: 'mil veces' }];
  const S = { bMirrored: false, mode: 'manual', saved: {}, initial: [4, 1, 5, 2, 3], a: [4, 1, 5, 2, 3], b: [], ops: [], noops: [], cursor: 0, check: new Map(), ranks: new Map(), timer: null, playing: false, delay: 500, playLastAt: 0, playCarry: 0, sketch: null, view: 'value' };
  let toastTimer = null; const animations = [];
  function alertUser(msg, bad = false) { const e = $('toast'); e.textContent = msg; e.classList.toggle('error', bad); e.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove('show'), 3000) }
  function showError(id, msg) { const e = $(id); e.textContent = msg; e.classList.toggle('visible', !!msg) }
  function integer(raw, label) { const t = String(raw).trim(); if (!/^[+-]?\d+$/.test(t)) throw Error(`${label}: ingresá un número entero válido.`); const n = Number(t); if (!Number.isSafeInteger(n) || n < MIN || n > MAX) throw Error(`${label}: fuera del rango de enteros de 32 bits.`); return n }
  function parseNumbers(raw) { const a = raw.trim().split(/[\s,;]+/).filter(Boolean); if (!a.length) throw Error('Ingresá al menos un número.'); if (a.length > LIM) throw Error(`La visualización admite hasta ${LIM} números.`); const v = a.map((x, i) => integer(x, `Número ${i + 1}`)); if (new Set(v).size !== v.length) throw Error('Los números no pueden repetirse.'); return v }
  function parseOps(raw) { let output = []; const lines = raw.split(/\r?\n/); for (let ln = 0; ln < lines.length; ln++) { const content = lines[ln].split('#')[0].trim(); if (!content) continue; for (const token of content.split(/[\s,;]+/).filter(Boolean)) { if (!OPS.includes(token)) throw Error(`Línea ${ln + 1}: «${token}» no es una operación válida.`); output.push(token); if (output.length > MAX_OPS) throw Error(`Máximo ${MAX_OPS.toLocaleString("es-ES")} instrucciones.`) } } return output }
  function seeded(seed) { if (!seed) return Math.random; let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296 } }
  function sample(n, min, max, seed) { const span = max - min + 1; if (n > span) throw Error('No hay suficientes enteros distintos en el intervalo elegido.'); let rand = seeded(seed); const map = new Map(), out = []; for (let i = 0; i < n; i++) { const j = i + Math.floor(rand() * (span - i)); const a = map.has(i) ? map.get(i) : i, b = map.has(j) ? map.get(j) : j; map.set(j, a); out.push(b + min) } for (let i = n - 1; i > 0; i--) { let j = Math.floor(rand() * (i + 1));[out[i], out[j]] = [out[j], out[i]] } return out }
  // Distance to a sorted stack, measured as inverted pairs (0–100%).
  function inversionCount(values) { let total = 0; for (let i = 0; i < values.length; i++)for (let j = i + 1; j < values.length; j++)if (values[i] > values[j]) total++; return total }
  function disorderPercent(values) { const max = values.length * (values.length - 1) / 2; return max ? 100 * inversionCount(values) / max : 0 }
  // Build a random permutation with an exact (rounded) inversion target.
  // Choosing the k-th remaining value adds precisely k inversions.
  function withDisorder(values, percent, seed) {
    const available = values.slice().sort((a, b) => a - b), out = [], n = values.length;
    let remaining = Math.round((percent / 100) * (n * (n - 1) / 2));
    const rand = seeded(seed ? seed + ':inversions' : '');
    for (let m = n; m > 0; m--) {
      const future = (m - 1) * (m - 2) / 2;
      const low = Math.max(0, remaining - future), high = Math.min(m - 1, remaining);
      const pick = low + Math.floor(rand() * (high - low + 1));
      out.push(available.splice(pick, 1)[0]); remaining -= pick;
    }
    return out;
  }
  function updateDisorder() {
    const n = disorderPercent(S.initial);
    $('disorderReadout').textContent = `${Number(n.toFixed(1)).toLocaleString('es-ES')} %`;
  }
  function bitWidth() { return Math.max(1, Math.ceil(Math.log2(S.initial.length))) }
  function syncViewControls() {
    // The compact stack layout intentionally hides value/index labels from 31 on.
    // Don't offer an index mode that looks identical to Values in this layout.
    const compact = S.initial.length > VISIBLE_LABEL_LIMIT;
    if (compact) S.view = 'value';
    $('viewControls').hidden = compact;
    document.querySelectorAll('[data-view]').forEach(button => {
      const selected = button.dataset.view === S.view;
      button.disabled = compact && button.dataset.view !== 'value';
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  // Presentation preference only: never change order, operations, or playback cursor.
  function toggleBAlignment() {
    if (pointerDrag) return; // A live drag keeps its original coordinates.
    cancelAnimations();
    S.bMirrored = !S.bMirrored;
    $('boxB').classList.toggle('align-left', !S.bMirrored);
    $('mirrorBBtn').setAttribute('aria-pressed', String(S.bMirrored));
    $('mirrorBLabel').textContent = S.bMirrored ? 'Espejado' : 'Alineado';
    const description = S.bMirrored
      ? 'Pila B: Espejado. Pulsar para mostrar barras alineadas a la izquierda'
      : 'Pila B: Alineado. Pulsar para mostrar barras espejadas';
    $('mirrorBBtn').setAttribute('aria-label', description);
    $('mirrorBBtn').title = description;
  }
  function switchView(next) {
    if (!['value', 'index', 'binary'].includes(next)) return;
    if (S.initial.length > VISIBLE_LABEL_LIMIT && next !== 'value') return;
    S.view = next;
    syncViewControls();
    draw(false);
  }
  function snapshot(a, b) { return { a: a.slice(), b: b.slice() } }
  function same(x, y) { return x.length === y.length && x.every((v, i) => v === y[i]) }
  function mutate(a, b, op) { const swap = x => { if (x.length > 1) [x[0], x[1]] = [x[1], x[0]] }; const rot = x => { if (x.length > 1) x.push(x.shift()) }; const rev = x => { if (x.length > 1) x.unshift(x.pop()) }; switch (op) { case 'sa': swap(a); break; case 'sb': swap(b); break; case 'ss': swap(a); swap(b); break; case 'pa': if (b.length) a.unshift(b.shift()); break; case 'pb': if (a.length) b.unshift(a.shift()); break; case 'ra': rot(a); break; case 'rb': rot(b); break; case 'rr': rot(a); rot(b); break; case 'rra': rev(a); break; case 'rrb': rev(b); break; case 'rrr': rev(a); rev(b); break; default: throw Error('Operación inválida') } }
  function isSorted(a) { return a.every((v, i) => i === 0 || a[i - 1] < v) }
  function solved(a = S.a, b = S.b) { return b.length === 0 && isSorted(a) }
  function stop() { if (S.timer !== null) clearTimeout(S.timer); S.timer = null; S.playing = false; S.playLastAt = 0; S.playCarry = 0 }
  function cancelAnimations() { while (animations.length) { try { animations.pop().cancel() } catch (e) { } } document.querySelectorAll('.ghost').forEach(x => x.remove()) }
  function reset(numbers) { stop(); cancelAnimations(); S.sketch = null; syncSketchUI(); S.saved = {}; S.initial = numbers.slice(); S.a = numbers.slice(); S.b = []; S.ops = []; S.noops = []; S.cursor = 0; S.check = new Map([[0, snapshot(S.a, S.b)]]); S.ranks = new Map(numbers.slice().sort((a, b) => a - b).map((v, i) => [v, i])); $('numbersInput').value = numbers.join(' '); $('operationsInput').value = ''; updateDisorder(); hideQuickActions(); showError('numberError', ''); showError('operationsError', ''); draw(false) }
  function buildCheckpoints() { const a = S.initial.slice(), b = []; S.check = new Map([[0, snapshot(a, b)]]); S.noops = []; for (let i = 0; i < S.ops.length; i++) { const prev = snapshot(a, b); mutate(a, b, S.ops[i]); S.noops.push(same(prev.a, a) && same(prev.b, b)); if ((i + 1) % CHECK === 0) S.check.set(i + 1, snapshot(a, b)) } return solved(a, b) }
  function stateAt(pos) { let k = Math.floor(pos / CHECK) * CHECK; while (k > 0 && !S.check.has(k)) k -= CHECK; const base = S.check.get(k) || snapshot(S.initial, []), { a, b } = snapshot(base.a, base.b); for (let i = k; i < pos; i++)mutate(a, b, S.ops[i]); return { a, b } }
  function jump(pos, animate = false) { if (S.sketch) return; hideQuickActions(); stop(); const previous = S.cursor; pos = Math.max(0, Math.min(S.ops.length, Math.floor(pos))); if (pos === previous) { draw(false); return } const obj = stateAt(pos); S.a = obj.a; S.b = obj.b; S.cursor = pos; draw(animate && Math.abs(pos - previous) === 1) }
  function manually(op, dropFrom = null) { if (S.mode !== 'manual' || S.sketch) return; hideQuickActions(); stop(); if (S.cursor < S.ops.length) { alertUser(`Nueva rama desde el paso ${S.cursor}: se descartan los movimientos posteriores.`); S.ops.splice(S.cursor); S.noops.splice(S.cursor); for (const k of [...S.check.keys()]) if (k > S.cursor) S.check.delete(k) } if (S.cursor >= MAX_OPS) { alertUser(`Límite de ${MAX_OPS.toLocaleString("es-ES")} operaciones alcanzado.`, true); return } const was = snapshot(S.a, S.b); mutate(S.a, S.b, op); S.ops.push(op); S.noops.push(same(was.a, S.a) && same(was.b, S.b)); S.cursor++; if (S.cursor % CHECK === 0) S.check.set(S.cursor, snapshot(S.a, S.b)); draw(!S.noops[S.cursor - 1], dropFrom) }
  function loadManualNumbers() { try { const nums = parseNumbers($('numbersInput').value); S.largeReplay = null; reset(nums); if (nums.length > MANUAL_LIM) { setMode('replay'); alertUser(`${nums.length} números cargados en Reproducir (práctica manual: hasta ${MANUAL_LIM}).`) } else alertUser('Números cargados. Ya podés practicar.') } catch (err) { showError('numberError', err.message) } }
  function generate() {    
try {
      const n = integer($('countInput').value, 'Cantidad'), min = integer($('minInput').value, 'Mínimo'), max = integer($('maxInput').value, 'Máximo');
      if (n < 1 || n > LIM) throw Error('La cantidad debe estar entre 1 y 500.');
      if (min > max) throw Error('El mínimo no puede superar al máximo.');
      const raw = $('disorderInput').value.trim(), disorder = raw === '' ? null : integer(raw, 'Desorden');
      if (disorder !== null && (disorder < 0 || disorder > 100)) throw Error('El desorden debe estar entre 0 % y 100 %.');
      const seed = $('seedInput').value.trim(), values = sample(n, min, max, seed);
      S.largeReplay = null; reset(disorder === null ? values : withDisorder(values, disorder, seed));
      if (n > MANUAL_LIM) setMode('replay');
      showError('numberError', ''); alertUser(`${n} números únicos · ${$('disorderReadout').textContent} de desorden${n > MANUAL_LIM ? ' · modo Reproducir' : ''}.`);
    } catch (err) { showError('numberError', err.message) }  
}
  function validateSequenceText(raw) {
    // Keep enormous pasted input from exhausting memory before parsing.
    if (raw.length > MAX_TEXT_BYTES) throw Error('El texto supera el límite de 1 MiB.');
    const commands = parseOps(raw);
    if (!commands.length && !isSorted(S.initial)) throw Error('La secuencia está vacía, pero los números aún no están ordenados.');
    return commands;
  }
  function applySequence(commands) {
    if (S.sketch) leaveSketch();
    stop(); S.ops = commands; S.cursor = 0; S.a = S.initial.slice(); S.b = [];
    const valid = buildCheckpoints(); draw(false); showError('operationsError', '');
    alertUser(commands.length ? `Cargadas ${S.ops.length} instrucciones. ${valid ? 'La secuencia ordena las pilas.' : 'La secuencia no termina ordenada.'}` : 'Sin movimientos: los números ya están ordenados.');
  }
  function loadSequence() {
    try { applySequence(validateSequenceText($('operationsInput').value)); }
    catch (err) { showError('operationsError', err.message); }
  }
  // File contents are plain data; do not interpret them as HTML or executable code.
  let importRequest = 0;
  async function importOperationsFile(file) {
    const request = ++importRequest;
    try {
      if (!file) return;
      if (!/\.txt$/i.test(file.name)) throw Error('Elegí un archivo con extensión .txt.');
      if (file.size > MAX_TEXT_BYTES) throw Error('El archivo supera el límite de 1 MiB.');
      const content = await file.text();
      if (request !== importRequest) return;
      // Validate the entire file before touching the previous editor and sequence.
      const commands = validateSequenceText(content);
      $('operationsInput').value = content;
      applySequence(commands);
    } catch (err) {
      if (request === importRequest) {
        const msg = err instanceof Error ? err.message : 'No se pudo leer el archivo.';
        showError('operationsError', msg);
        alertUser(msg, true);
      }
    }
  }
  function installTxtImporter() {
    const zone = $('operationsDropzone'), picker = $('operationsFile');
    const filesBeingDragged = e => Array.from(e.dataTransfer?.types || []).includes('Files');
    const highlight = on => zone.classList.toggle('dragging', on);
    $('importTxtBtn').addEventListener('click', () => { picker.value = ''; picker.click(); });
    picker.addEventListener('change', () => { if (picker.files?.length) void importOperationsFile(picker.files[0]); });
    zone.addEventListener('dragenter', e => { if (!filesBeingDragged(e)) return; e.preventDefault(); highlight(true); });
    zone.addEventListener('dragover', e => { if (!filesBeingDragged(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; highlight(true); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) highlight(false); });
    zone.addEventListener('drop', e => {
      if (!filesBeingDragged(e)) return;
      e.preventDefault(); highlight(false);
      const files = e.dataTransfer?.files;
      if (files?.length !== 1) { showError('operationsError', 'Soltá un único archivo .txt.'); return; }
      void importOperationsFile(files[0]);
    });
    // Dropping on the rest of the page must not navigate away and erase the workspace.
    document.addEventListener('dragover', e => { if (filesBeingDragged(e)) e.preventDefault(); });
    document.addEventListener('drop', e => { if (filesBeingDragged(e)) { e.preventDefault(); highlight(false); } });
    document.addEventListener('dragend', () => highlight(false));
  }

  function setMode(mode) {
    if (mode === 'manual' && S.initial.length > MANUAL_LIM) {
      // Start a fresh, manageable exercise on demand, without rejecting the tab.
      // Preserve the replay workspace so the user can return without losing its sequence.
      S.largeReplay = { initial: S.initial.slice(), ops: S.ops.slice(), cursor: S.cursor, view: S.view, rawOps: $('operationsInput').value };
      const min = Number($('minInput').value), max = Number($('maxInput').value);
      const start = Number.isSafeInteger(min) && Number.isSafeInteger(max) && max - min + 1 >= 10 && min >= MIN && max <= MAX && min <= max ? sample(10, min, max, '') : sample(10, -999, 999, '');
      reset(start); $('countInput').value = '10'; $('disorderInput').value = ''; syncPreset();
      S.mode = 'replay'; // Ensure the regular switch creates a fresh manual workspace.
      setMode('manual');
      alertUser('Nuevo ejercicio de 10 números. Podés volver a Reproducir para recuperar tu secuencia.');
      return;
    }
    if (mode === 'replay' && S.largeReplay && S.mode === 'manual') {
      const previous = S.largeReplay; S.largeReplay = null;
      reset(previous.initial); S.mode = 'manual';
      setMode('replay'); S.ops = previous.ops.slice(); $('operationsInput').value = previous.rawOps; buildCheckpoints();
      S.cursor = Math.min(previous.cursor, S.ops.length);
      const stack = stateAt(S.cursor); S.a = stack.a; S.b = stack.b;
      // Restore the previously selected view; the user can still change it freely.
      switchView(previous.view); draw(false);
      $('countInput').value = String(S.initial.length); syncPreset();
      alertUser('Secuencia de Reproducir recuperada.');
      return;
    }
    hideQuickActions(); stop(); if (S.mode === mode) return; if (S.sketch) leaveSketch(); S.saved[S.mode] = { ops: S.ops.slice(), cursor: S.cursor }; S.mode = mode; const stored = S.saved[mode]; S.ops = stored ? stored.ops.slice() : []; S.a = S.initial.slice(); S.b = []; S.cursor = 0; S.check = new Map([[0, snapshot(S.a, S.b)]]); if (S.ops.length) buildCheckpoints(); else S.noops = []; if (stored) { S.cursor = Math.min(stored.cursor, S.ops.length); const now = stateAt(S.cursor); S.a = now.a; S.b = now.b } $('app').classList.toggle('replay', mode === 'replay'); document.body.classList.toggle('replay-mode', mode === 'replay'); $('tabManual').classList.toggle('active', mode === 'manual'); $('tabReplay').classList.toggle('active', mode === 'replay'); $('tabManual').setAttribute('aria-pressed', String(mode === 'manual')); $('tabReplay').setAttribute('aria-pressed', String(mode === 'replay')); draw(false)  
}
  function rectMap() {
    const m = new Map();
    document.querySelectorAll('.stack-viewport .stack-row[data-value]').forEach(el => {
      const style = getComputedStyle(el), fill = el.querySelector('.row-fill');
      m.set(el.dataset.value, {
        rect: el.getBoundingClientRect(), el, stack: el.closest('.stack-box').id,
        grid: style.gridTemplateColumns, gap: style.columnGap, dir: style.direction,
        fillColor: fill ? getComputedStyle(fill).backgroundColor : ''
      });
    });
    return m;
  }
  function makeRow(val, i, n, changed) {
    const rank = S.ranks.get(val), row = document.createElement('div');
    row.className = 'stack-row' + (changed ? ' changed' : '') + (S.view === 'binary' ? ' row-binary' : S.view === 'index' ? ' row-indices' : '');
    row.dataset.value = String(val); row.dataset.index = String(i);
    const interactive = S.mode === 'manual' && S.initial.length <= MANUAL_LIM && (!!S.sketch || i === 0 || i === ((S.sketch ? (S.sketch.a.includes(val) ? S.sketch.a : S.sketch.b) : (S.a.includes(val) ? S.a : S.b)).length - 1));
    const code = rank.toString(2).padStart(bitWidth(), '0');
    row.title = `${i === 0 ? 'Tope · ' : ''}Valor ${val} · índice normalizado ${rank} · binario ${code} · posición ${i + 1}`;
    if (interactive) { row.classList.add('drag-allowed'); row.setAttribute('aria-label', `Ficha ${val}, índice ${rank}, binario ${code}. Pulsá Enter para ver movimientos posibles o arrastrá.`); row.setAttribute('role', 'button'); row.tabIndex = 0; }
    const idx = document.createElement('span'); idx.className = 'row-index'; idx.textContent = String(i + 1).padStart(2, '0');
    const num = document.createElement('span'); num.className = 'row-num'; num.textContent = S.view === 'value' ? String(val) : S.view === 'index' ? String(rank) : code;
    const track = document.createElement('div'); track.className = 'row-track'; const fill = document.createElement('div'); fill.className = 'row-fill'; fill.style.width = (15 + 85 * (n > 1 ? rank / (n - 1) : .5)) + '%'; track.append(fill);
    row.append(idx, num, track);
    if (S.view === 'index' && S.initial.length <= 20) { const original = document.createElement('span'); original.className = 'original-value'; original.textContent = `valor ${val}`; track.append(original) }
    return row;
  }
  function paintPile(which, arr, changed) {
    const box = $('box' + which), target = $('stack' + which);
    box.classList.toggle('fit-bars', true);
    box.classList.toggle('micro-bars', S.initial.length > VISIBLE_LABEL_LIMIT);
    box.classList.toggle('small-bars', S.initial.length > 20 && S.initial.length <= VISIBLE_LABEL_LIMIT);
    box.classList.toggle('show-binary', S.view === 'binary');
    box.classList.toggle('show-index', S.view === 'index');
    target.style.setProperty('--total-rows', String(S.initial.length));
    target.style.setProperty('--preferred-height', Math.max(190, Math.min(560, S.initial.length * 35 + 28)) + 'px');
    target.replaceChildren(); const frag = document.createDocumentFragment();
    if (arr.length === 0) { const empty = document.createElement('div'); empty.className = 'empty-stack'; empty.innerHTML = '<span class="empty-mark" aria-hidden="true"></span><span>Pila vacía</span>'; frag.appendChild(empty) }
    else { for (let i = 0; i < arr.length; i++)frag.appendChild(makeRow(arr[i], i, S.initial.length, changed.has(arr[i]))) }
    target.append(frag); $('count' + which).textContent = arr.length;
  }
  // Animate the rows in place (FLIP), but draw cross-stack transfers above BOTH
  // scroll-clipped stacks. Reuse the actual dragged tile for a seamless release.
  function doFlip(before, after, dropFrom = null) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || S.initial.length > MANUAL_LIM) { dropFrom?.ghost?.remove(); return }
    const mobile = window.matchMedia('(max-width:590px)').matches;
    const duration = S.playing ? Math.max(80, Math.min(mobile ? 240 : 310, S.delay * .72)) : (mobile ? 260 : 310);
    const easing = 'cubic-bezier(.2,.72,.25,1)';
    function track(anim, onDone) {
      animations.push(anim);
      let cleaned = false;
      const done = () => {
        if (cleaned) return;
        cleaned = true;
        const i = animations.indexOf(anim);
        if (i >= 0) animations.splice(i, 1);
        onDone?.();
      };
      anim.addEventListener('finish', done, { once: true });
      anim.addEventListener('cancel', done, { once: true });
    }
    let usedDragGhost = false;
    for (const [value, end] of after) {
      const origin = before.get(value);
      if (!origin) continue;
      const isDrop = dropFrom?.value === Number(value);
      const from = isDrop ? dropFrom.rect : origin.rect;
      const across = origin.stack !== end.stack;
      const dx = from.left - end.rect.left, dy = from.top - end.rect.top;
      if (!across && !isDrop && Math.abs(dx) < .8 && Math.abs(dy) < .8) continue;
      if (!across && !isDrop) {
        track(end.el.animate([
          { transform: `translate3d(${dx}px,${dy}px,0)` },
          { transform: 'translate3d(0,0,0)' }
        ], { duration, easing }));
        continue;
      }
      const ghost = (isDrop && dropFrom.ghost) || origin.el.cloneNode(true);
      if (isDrop && dropFrom.ghost) usedDragGhost = true;
      ghost.className = 'stack-row ghost';
      ghost.removeAttribute('role'); ghost.removeAttribute('tabindex');
      // A detached row has lost its parent grid styles. Reproduce its ORIGINAL
      // geometry and direction so the transfer does not change shape mid-flight.
      Object.assign(ghost.style, {
        position: 'fixed', left: from.left + 'px', top: from.top + 'px',
        width: from.width + 'px', height: from.height + 'px',
        boxSizing: 'border-box', display: 'grid', gridTemplateColumns: origin.grid,
        columnGap: origin.gap, direction: origin.dir,
        transform: 'none', transformOrigin: 'top left', margin: '0', padding: '0',
        border: '0', borderRadius: '4px', background: 'transparent',
        pointerEvents: 'none', zIndex: '10000', willChange: 'transform, opacity', opacity: '1'
      });
      const ghostFill = ghost.querySelector('.row-fill');
      if (ghostFill) {
        ghostFill.style.backgroundColor = origin.fillColor;
        const endColor = end.fillColor;
        if (endColor && endColor !== origin.fillColor) {
          track(ghostFill.animate([
            { backgroundColor: origin.fillColor }, { backgroundColor: endColor }
          ], { duration, easing, fill: 'forwards' }));
        }
      }
      document.body.append(ghost);
      // The real destination is already laid out. Keep it hidden only while
      // the flying tile approaches, then crossfade the two in the final frames.
      end.el.style.opacity = '0';
      const moveX = end.rect.left - from.left, moveY = end.rect.top - from.top;
      const scaleX = from.width ? end.rect.width / from.width : 1;
      const scaleY = from.height ? end.rect.height / from.height : 1;
      track(end.el.animate([
        { opacity: 0, offset: 0 }, { opacity: 0, offset: .72 }, { opacity: 1, offset: 1 }
      ], { duration, easing }), () => { end.el.style.opacity = '' });
      track(ghost.animate([
        { transform: 'translate3d(0,0,0) scale(1,1)', opacity: 1, offset: 0 },
        { transform: `translate3d(${moveX * .72}px,${moveY * .72}px,0) scale(${1 + (scaleX - 1) * .72},${1 + (scaleY - 1) * .72})`, opacity: 1, offset: .72 },
        { transform: `translate3d(${moveX}px,${moveY}px,0) scale(${scaleX},${scaleY})`, opacity: 0, offset: 1 }
      ], { duration, easing }), () => ghost.remove());
    }
    if (dropFrom?.ghost && !usedDragGhost) dropFrom.ghost.remove();
  }
  function changedValues() { if (S.cursor === 0 || S.noops[S.cursor - 1]) return new Set(); const op = S.ops[S.cursor - 1]; const previous = stateAt(S.cursor - 1); let changed = []; if (['pa', 'pb'].includes(op)) { changed = [...(op === 'pa' ? previous.b.slice(0, 1) : previous.a.slice(0, 1))] } else if (['sa', 'ss', 'ra', 'rr', 'rra', 'rrr'].includes(op)) { if (op === 'sa' || op === 'ss') changed.push(...previous.a.slice(0, 2)); else if (op === 'ra' || op === 'rr') changed.push(...previous.a.slice(0, 1)); else if (op === 'rra' || op === 'rrr') changed.push(...previous.a.slice(-1)) } if (['sb', 'ss', 'rb', 'rr', 'rrb', 'rrr'].includes(op)) { if (op === 'sb' || op === 'ss') changed.push(...previous.b.slice(0, 2)); else if (op === 'rb' || op === 'rr') changed.push(...previous.b.slice(0, 1)); else changed.push(...previous.b.slice(-1)) } return new Set(changed) }
  function renderHistory() { const root = $('history'); root.replaceChildren(); $('historyCount').textContent = `(${S.ops.length.toLocaleString('es-ES')})`; if (!S.ops.length) { const el = document.createElement('div'); el.className = 'hist-empty'; el.textContent = S.mode === 'manual' ? 'Cuando uses una operación, aparecerá acá. Podrás volver a cualquier paso.' : 'Cargá las instrucciones para ver y recorrer su secuencia.'; root.append(el); return } const origin = document.createElement('button'); origin.type = 'button'; origin.className = 'hist-start' + (S.cursor === 0 ? ' active' : ''); origin.textContent = '00  ·  Estado inicial'; origin.title = 'Regresar a los números originales'; origin.addEventListener('click', () => jump(0)); root.append(origin); const total = S.ops.length; let start = 0, end = total; if (total > 60) { start = Math.max(0, S.cursor - 16); end = Math.min(total, start + 37); start = Math.max(0, end - 37) } if (start > 0) { const x = document.createElement('div'); x.className = 'hist-gap'; x.textContent = `··· ${start} movimientos anteriores`; root.append(x) } const frag = document.createDocumentFragment(); for (let i = start; i < end; i++) { const x = document.createElement('button'); x.type = 'button'; x.className = 'hist-row' + (i === S.cursor - 1 ? ' active' : ''); x.setAttribute('aria-label', `Ir al paso ${i + 1}: ${S.ops[i]}`); const idx = document.createElement('span'); idx.className = 'hist-index'; idx.textContent = String(i + 1).padStart(3, '0'); const value = document.createElement('span'); value.textContent = S.ops[i]; x.append(idx, value); if (S.noops[i]) { const msg = document.createElement('span'); msg.className = 'hist-note'; msg.textContent = 'sin efecto'; x.append(msg) } x.addEventListener('click', () => jump(i + 1)); frag.append(x) } root.append(frag); if (end < total) { const x = document.createElement('div'); x.className = 'hist-gap'; x.textContent = `··· ${total - end} movimientos siguientes`; root.append(x) } }
  function draw(animate, dropFrom = null) {    
syncViewControls(); const old = animate ? rectMap() : null; cancelAnimations(); if (!animate) dropFrom?.ghost?.remove(); const change = S.sketch ? new Set() : changedValues(); paintPile('A', S.sketch ? S.sketch.a : S.a, change); paintPile('B', S.sketch ? S.sketch.b : S.b, change); if (old) doFlip(old, rectMap(), dropFrom); const st = $('solutionState'); st.className = 'state'; if (solved()) { st.textContent = S.cursor ? '✓ Ordenado' : '✓ Ya está ordenado'; st.classList.add('good') } else if (S.mode === 'replay' && S.ops.length && S.cursor === S.ops.length) { st.textContent = 'No ordenado'; st.classList.add('warning') } else st.textContent = 'En progreso'; if (S.sketch) { st.textContent = 'Borrador libre'; st.className = 'state'; $('lastOp').textContent = '✎'; $('actionName').textContent = 'Borrador sin instrucciones'; $('actionDetail').textContent = 'Arrastrá cualquier ficha. Al cerrar, recuperás exactamente tus pilas e historial reales.'; } const last = S.ops[S.cursor - 1]; $('lastOp').textContent = S.sketch ? '✎' : last || '—'; $('lastOp').classList.toggle('idle', !last && !S.sketch); if (!S.sketch) { $('actionName').textContent = last ? D[last][0] : 'Listo para empezar'; $('actionDetail').textContent = last ? D[last][1] + (S.noops[S.cursor - 1] ? ' Esta operación no tuvo efecto.' : '') : 'Arrastrá los números o usá los botones para ejecutar movimientos.'; }
    $('statMoves').textContent = S.cursor.toLocaleString('es-ES'); $('statA').textContent = S.sketch ? S.sketch.a.length : S.a.length; $('statB').textContent = S.sketch ? S.sketch.b.length : S.b.length;
    $('undoAction').disabled = !!S.sketch || S.cursor === 0; $('seek').max = S.ops.length; $('seek').value = S.cursor; $('stepsLabel').textContent = `${S.cursor.toLocaleString('es-ES')} / ${S.ops.length.toLocaleString('es-ES')}`; $('firstBtn').disabled = S.cursor === 0; $('prevBtn').disabled = S.cursor === 0; $('nextBtn').disabled = S.cursor === S.ops.length; $('endBtn').disabled = S.cursor === S.ops.length; const atEnd = !S.playing && S.ops.length > 0 && S.cursor === S.ops.length; $('playBtn').disabled = S.ops.length === 0; $('playBtn').textContent = S.playing ? 'Ⅱ' : atEnd ? '↻' : '▶'; $('playBtn').setAttribute('aria-label', S.playing ? 'Pausar' : atEnd ? 'Reproducir desde el inicio' : 'Reproducir'); $('playBtn').title = S.playing ? 'Pausar (Espacio)' : atEnd ? 'Reproducir de nuevo desde el principio (Espacio)' : 'Reproducir (Espacio)'; renderHistory(); const locked = !!S.sketch; for (const b of document.querySelectorAll('[data-op]')) b.disabled = locked; for (const id of ['firstBtn', 'prevBtn', 'nextBtn', 'endBtn', 'playBtn', 'seek', 'speed', 'clearBtn', 'copyBtn']) $(id).disabled = locked; syncSketchUI()  
}
  // A clock-based player keeps the chosen speed consistent when rendering many bars.
  // Fast rates apply every instruction but batch DOM paints: no logical steps are skipped.
  function schedulePlayback() { if (!S.playing) return; const wait = S.delay < 80 ? 60 : Math.max(8, S.delay - S.playCarry); S.timer = setTimeout(playLoop, wait) }
  function playLoop() {
    if (!S.playing) return;
    const now = performance.now(); S.playCarry += Math.max(0, now - S.playLastAt); S.playLastAt = now;
    const available = Math.floor(S.playCarry / S.delay);
    if (available > 0) {
      const steps = Math.min(available, 500, S.ops.length - S.cursor);
      S.playCarry -= steps * S.delay;
      for (let k = 0; k < steps; k++) { mutate(S.a, S.b, S.ops[S.cursor]); S.cursor++ }
      if (S.cursor === S.ops.length) { stop(); draw(false); return }
      // Animations are useful at teaching speeds, but obscure the result at high rates.
      draw(steps === 1 && S.delay >= 200);
    }
    schedulePlayback();
  }
  function togglePlayback() {
    if (S.sketch) return;
    if (S.playing) { stop(); draw(false); return }
    if (!S.ops.length) return;
    if (S.cursor === S.ops.length) jump(0); // At the end, Play means replay from step zero.
    S.playing = true; S.playLastAt = performance.now(); S.playCarry = 0;
    draw(false); schedulePlayback();
  }
  function setSpeed(index) {
    const i = Math.max(0, Math.min(SPEEDS.length - 1, Math.round(Number(index) || 0)));
    const oldDelay = S.delay, chosen = SPEEDS[i];
    S.delay = 500 / chosen.factor; // 1× = 2 operations/second; all labels are proportional.
    $('speed').value = String(i); $('speedReadout').textContent = chosen.label;
    $('speed').setAttribute('aria-valuetext', `${chosen.label}, ${chosen.description}`);
    $('speed').style.setProperty('--speed-fill', `${i * 100 / (SPEEDS.length - 1)}%`);
    if (S.playing) {
      // Preserve the fraction already elapsed and apply changes without pause/restart.
      const now = performance.now(); S.playCarry += Math.max(0, now - S.playLastAt); S.playCarry = S.playCarry * S.delay / oldDelay;
      S.playLastAt = now; if (S.timer !== null) clearTimeout(S.timer); schedulePlayback();
    }
  }
  async function writeClipboard(content) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try { await navigator.clipboard.writeText(content); return true } catch (e) {/* file:// or clipboard permission denied: try the local fallback. */ }
    }
    const area = document.createElement('textarea');
    area.value = content; area.setAttribute('readonly', '');
    Object.assign(area.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0' });
    const focused = document.activeElement;
    document.body.append(area); area.focus(); area.select();
    let copied = false;
    try { copied = document.execCommand('copy') } catch (e) { copied = false }
    area.remove(); if (focused && typeof focused.focus === 'function') focused.focus({ preventScroll: true });
    return copied;
  }
  async function copyNumbers() {
    let matches = false;
    try { matches = same(parseNumbers($('numbersInput').value), S.initial) } catch (_) {/* Invalid edits must be loaded and corrected first. */ }
    if (!matches) {
      alertUser('Cargá los números modificados antes de copiarlos.', true); return;
    }
    const ok = await writeClipboard(S.initial.join(' '));
    alertUser(ok ? `${S.initial.length} números iniciales copiados, separados por espacios.` : 'No se pudieron copiar los números.', !ok);
  }
  async function copyOps() {
    if (!S.ops.length) { alertUser('Todavía no hay operaciones para copiar.', true); return }
    const ok = await writeClipboard(S.ops.join('\n') + '\n');
    alertUser(ok ? `${S.ops.length} operaciones copiadas.` : 'No se pudieron copiar las operaciones.', !ok);
  }
  function clearOps() { hideQuickActions(); if (S.sketch) leaveSketch(); stop(); S.a = S.initial.slice(); S.b = []; S.ops = []; S.noops = []; S.cursor = 0; S.check = new Map([[0, snapshot(S.a, S.b)]]); $('operationsInput').value = ''; showError('operationsError', ''); draw(false) }

  /* Direct manipulation: real operations versus a disposable, unconstrained visual sketch. */

  /* A tap/click alternative to dragging: small, contextual, keyboard accessible. */
  function hideQuickActions() { const bar = $('quickActions'); if (!bar) return; bar.hidden = true; bar.replaceChildren() }
  function showQuickActions(which, index, value) {
    if (S.mode !== 'manual' || S.sketch || S.initial.length > MANUAL_LIM) return;
    const bar = $('quickActions'); bar.replaceChildren();
    const a = which === 'A' ? S.a : S.b; if (a[index] !== value) return;
    const title = document.createElement('span'); title.className = 'quick-title'; title.textContent = `Ficha ${value} · pila ${which}`; bar.append(title);
    const actions = []; const one = which === 'A', n = a.length;
    if (index === 0) { actions.push([one ? 'pb' : 'pa', one ? 'Pasar a B →' : '← Pasar a A']); if (n >= 2) { actions.push([one ? 'sa' : 'sb', 'Intercambiar']); actions.push([one ? 'ra' : 'rb', 'Al final ↓']) } }
    if (index === n - 1 && n >= 2) actions.push([one ? 'rra' : 'rrb', 'Al principio ↑']);
    for (const [op, label] of actions) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = op; b.addEventListener('click', () => manually(op)); bar.append(b) }
    const close = document.createElement('button'); close.type = 'button'; close.className = 'quick-close'; close.textContent = '✕'; close.setAttribute('aria-label', 'Cerrar menú de ficha'); close.addEventListener('click', hideQuickActions); bar.append(close);
    bar.hidden = false;
  }

  let pointerDrag = null;
  function syncSketchUI() { const on = !!S.sketch; $('sketchBtn').classList.toggle('active', on); $('sketchBtn').setAttribute('aria-pressed', String(on)); $('sketchBtn').textContent = on ? '✓ Borrador activo' : '✎ Borrador libre'; $('sketchNote').hidden = !on }
  function enterSketch() { if (S.mode !== 'manual') return; hideQuickActions(); stop(); S.sketch = snapshot(S.a, S.b); draw(false); alertUser('Borrador activado: podés mover cualquier ficha, sin registrar operaciones.') }
  function leaveSketch() { if (!S.sketch) return; hideQuickActions(); S.sketch = null; hideDragPreview(); draw(false) }
  function sourceState() { return S.sketch || S }
  function pileOf(s, which) { return which === 'A' ? s.a : s.b }
  function formatPile(a) { return a.length === 0 ? '∅' : a.slice(0, 12).join(' ') + (a.length > 12 ? ` … (+${a.length - 12})` : '') }
  function clearDragTargets() { document.querySelectorAll('.drop-choice').forEach(el => { el.classList.remove('drop-choice'); el.removeAttribute('data-op-hint') }); document.querySelectorAll('.drop-allowed').forEach(el => { el.classList.remove('drop-allowed'); el.removeAttribute('data-op-hint') }) }
  function showDragTargets(d) {    
clearDragTargets();
    if (S.sketch) { for (const row of document.querySelectorAll('.stack-row')) row.classList.add('drop-choice'); for (const which of ['A', 'B']) $('box' + which).classList.add('drop-allowed'); return }
    const which = d.which, own = $('stack' + which), other = $('box' + (which === 'A' ? 'B' : 'A')), n = pileOf(S, which).length;
    if (d.index === 0) {      
other.classList.add('drop-allowed'); other.dataset.opHint = which === 'A' ? 'pb' : 'pa';
      if (n >= 2) { const second = own.querySelector('[data-index="1"]'); if (second) { second.classList.add('drop-choice'); second.dataset.opHint = which === 'A' ? 'sa' : 'sb' } const last = own.querySelector(`[data-index="${n - 1}"]`); if (n > 2 && last) { last.classList.add('drop-choice'); last.dataset.opHint = which === 'A' ? 'ra' : 'rb' } }
    } else if (n >= 2 && d.index === n - 1) { const first = own.querySelector('[data-index="0"]'); if (first) { first.classList.add('drop-choice'); first.dataset.opHint = which === 'A' ? 'rra' : 'rrb' } }
  }
  function hideDragPreview() { clearDragTargets(); const ui = $('dragPreview'); ui.classList.remove('visible', 'invalid'); for (const which of ['A', 'B']) { const el = $('box' + which); el.classList.remove('drag-over'); el.removeAttribute('data-drop-good'); el.removeAttribute('data-drop-label') } }
  function evaluateDrop(d, x, y) {    
const el = document.elementFromPoint(x, y); const box = el?.closest('.stack-box'); if (!box) return null; const dest = box.id === 'boxA' ? 'A' : 'B'; const targetPile = pileOf(sourceState(), dest); const row = el.closest('.stack-row'); let insert = 0;
    if (row) { const r = row.getBoundingClientRect(); insert = Number(row.dataset.index) + (y > r.top + r.height / 2 ? 1 : 0) } else if (el.closest('.stack-viewport')) insert = targetPile.length;
    if (S.sketch) { const trial = snapshot(S.sketch.a, S.sketch.b); const sourceArr = pileOf(trial, d.which), targetArr = pileOf(trial, dest); const [value] = sourceArr.splice(d.index, 1); if (d.which === dest && d.index < insert) insert--; insert = Math.max(0, Math.min(targetArr.length, insert)); targetArr.splice(insert, 0, value); return { dest, valid: true, op: 'libre', detail: `A: ${formatPile(trial.a)}  ·  B: ${formatPile(trial.b)}`, trial }; }
    const n = pileOf(S, d.which).length; const rowIndex = row ? Number(row.dataset.index) : -1; let op = null;
    if (dest !== d.which) { if (d.index === 0) op = d.which === 'A' ? 'pb' : 'pa' }
    else if (n >= 2) {
      if (d.index === 0) { if (n > 2 && (rowIndex === n - 1 || (!row && insert === n))) op = d.which === 'A' ? 'ra' : 'rb'; else if (rowIndex === 1) op = d.which === 'A' ? 'sa' : 'sb'; else if (n === 2 && (!row && insert === n)) op = d.which === 'A' ? 'sa' : 'sb' }
      else if (d.index === n - 1 && (rowIndex === 0 || (!row && insert === 0))) op = d.which === 'A' ? 'rra' : 'rrb';
    }
    if (!op) return { dest, valid: false, op: '—', detail: 'Soltá en un destino permitido: el tope de la otra pila, el segundo o el final.' };
    const trial = snapshot(S.a, S.b); mutate(trial.a, trial.b, op);
    return { dest, valid: true, op, detail: `A: ${formatPile(trial.a)}  ·  B: ${formatPile(trial.b)}`, trial };
  }
  function showDragPreview(candidate) {    
const ui = $('dragPreview'); ui.classList.remove('visible', 'invalid'); for (const which of ['A', 'B']) { const el = $('box' + which); el.classList.remove('drag-over'); el.removeAttribute('data-drop-good'); el.removeAttribute('data-drop-label') } ui.classList.add('visible'); const valid = !!candidate?.valid; if (!valid) ui.classList.add('invalid'); $('dragPreviewCode').textContent = candidate?.op || '—'; $('dragPreviewTitle').textContent = valid ? (S.sketch ? 'Ensayo visual · sin operaciones' : `Al soltar ejecutarás ${candidate.op}`) : 'Soltá sobre una zona válida'; $('dragPreviewDetail').textContent = candidate?.detail || 'Podés cancelar soltando fuera de las pilas.';
    if (candidate?.dest) { const b = $('box' + candidate.dest); b.classList.add('drag-over'); b.dataset.dropGood = String(valid); b.dataset.dropLabel = valid ? (S.sketch ? 'Mover libre' : candidate.op) : 'No válido' }
  }
  function onDragStart(e) {    
if (S.mode !== 'manual' || S.playing || S.initial.length > MANUAL_LIM || e.button !== 0) return; const row = e.target.closest('.stack-row'); const viewport = row?.closest('.stack-viewport'); if (!row || !viewport || !row.classList.contains('drag-allowed')) return;
    const which = viewport.id === 'stackA' ? 'A' : 'B', index = Number(row.dataset.index), value = Number(row.dataset.value), base = pileOf(sourceState(), which); if (base[index] !== value) return;
    // Native text-selection/drag must never compete with manipulating a tile.
    if (e.cancelable) e.preventDefault();
    window.getSelection()?.removeAllRanges();
    pointerDrag = { id: e.pointerId, which, index, value, node: row, rect: row.getBoundingClientRect(), x: e.clientX, y: e.clientY, moving: false, ghost: null, candidate: null };
  }
  function onDragMove(e) {    
const d = pointerDrag; if (!d || d.id !== e.pointerId) return; const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moving && Math.hypot(dx, dy) < 7) return;
    if (!d.moving) { hideQuickActions(); d.moving = true; stop(); document.body.classList.add('is-dragging'); const clone = d.node.cloneNode(true); clone.classList.add('drag-ghost'); clone.classList.remove('drag-allowed'); clone.style.width = d.rect.width + 'px'; clone.style.height = d.rect.height + 'px'; clone.style.left = d.rect.left + 'px'; clone.style.top = d.rect.top + 'px'; document.body.append(clone); d.ghost = clone; d.node.style.opacity = '.30'; showDragTargets(d) }
    if (e.cancelable) e.preventDefault(); d.ghost.style.transform = `translate(${dx}px,${dy}px)`;
    const candidate = evaluateDrop(d, e.clientX, e.clientY); d.candidate = candidate;
    const key = candidate ? `${candidate.dest}-${candidate.valid}-${candidate.op}-${S.sketch ? candidate.detail : ''}` : 'none'; if (d.previewKey !== key) { d.previewKey = key; showDragPreview(candidate) }
  }
  function endDrag(e, canceled = false) {
    const d = pointerDrag; if (!d || d.id !== e.pointerId) return;
    // Capture release geometry before removing the floating tile.
    const release = d.ghost?.getBoundingClientRect();
    const candidate = (!canceled && d.moving) ? evaluateDrop(d, e.clientX, e.clientY) : null;
    pointerDrag = null;
    if (d.node?.isConnected) d.node.style.opacity = '';
    document.body.classList.remove('is-dragging'); hideDragPreview();
    if (!d.moving) { d.ghost?.remove(); if (!canceled && !S.sketch) showQuickActions(d.which, d.index, d.value); return }
    if (!candidate?.valid) { d.ghost?.remove(); return }
    if (S.sketch) { d.ghost?.remove(); S.sketch = candidate.trial; draw(false) }
    else manually(candidate.op, release ? { value: d.value, rect: release, ghost: d.ghost } : null);
  }
  for (const which of ['A', 'B']) {
    const stack = $('stack' + which), box = $('box' + which);
    stack.addEventListener('pointerdown', onDragStart);
    // Apply to the whole stack box: headings, count badges and directional
    // guidance are not selectable when the user drags through them.
    box.addEventListener('dragstart', e => e.preventDefault());
    box.addEventListener('selectstart', e => e.preventDefault());
  }
  document.addEventListener('pointermove', onDragMove, { passive: false }); document.addEventListener('pointerup', e => endDrag(e)); document.addEventListener('pointercancel', e => endDrag(e, true)); window.addEventListener('blur', () => { if (pointerDrag) { const d = pointerDrag; endDrag({ pointerId: d.id, clientX: d.x, clientY: d.y }, true) } });
  window.addEventListener('resize', () => { cancelAnimations(); if (pointerDrag) endDrag({ pointerId: pointerDrag.id, clientX: pointerDrag.x, clientY: pointerDrag.y }, true) }, { passive: true });
  for (const which of ['A', 'B']) $('stack' + which).addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const row = e.target.closest('.stack-row.drag-allowed'); if (!row) return; e.preventDefault(); showQuickActions(which, Number(row.dataset.index), Number(row.dataset.value)) });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pointerDrag) { const d = pointerDrag; endDrag({ pointerId: d.id, clientX: d.x, clientY: d.y }, true) } });
  document.querySelectorAll('.dock-ops [data-op]').forEach(btn => { btn.title = D[btn.dataset.op][0]; btn.setAttribute('aria-label', D[btn.dataset.op][0]); });
  $('dockToggle').addEventListener('click', () => { const hidden = document.body.classList.toggle('dock-collapsed'); $('dockToggle').setAttribute('aria-expanded', String(!hidden)); $('dockToggle').textContent = hidden ? 'Mostrar ↓' : 'Ocultar ↑'; });
  $('sketchBtn').addEventListener('click', () => { if (S.sketch) leaveSketch(); else enterSketch() }); $('discardSketch').addEventListener('click', leaveSketch);

  $('undoAction').addEventListener('click', () => jump(S.cursor - 1, true));
  document.querySelectorAll('.size-preset').forEach(btn => btn.addEventListener('click', () => { $('countInput').value = btn.dataset.size; syncPreset(); }));
  function syncPreset() { const value = $('countInput').value; document.querySelectorAll('.size-preset').forEach(b => { const on = b.dataset.size === value; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)) }) }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('mirrorBBtn').addEventListener('click', toggleBAlignment);
  $('copyNumbers').addEventListener('click', copyNumbers); $('loadNumbers').addEventListener('click', loadManualNumbers); $('numbersInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); loadManualNumbers() } }); $('generateBtn').addEventListener('click', generate); $('countInput').addEventListener('input', syncPreset);
  $('tabManual').addEventListener('click', () => setMode('manual')); $('tabReplay').addEventListener('click', () => setMode('replay')); document.querySelectorAll('[data-op]').forEach(btn => btn.addEventListener('click', () => manually(btn.dataset.op)));
  $('loadOperations').addEventListener('click', loadSequence); installTxtImporter();
  const EXAMPLE5 = { numbers: [5, 2, 4, 3, 1], moves: ['pb', 'sa', 'rra', 'sa', 'ra', 'pa', 'ra'] };
  // Ten numbers, 23 operations: keep a circularly sorted subsequence in A,
  // push the other values to B and reinsert using combined rotations.
  const EXAMPLE10 = {    
numbers: [8, 3, 10, 1, 6, 2, 9, 5, 7, 4], moves: [
      'pb', 'ra', 'pb', 'pb', 'ra', 'pb', 'ra', 'pb', 'pb', 'pb',
      'rrr', 'pa', 'rb', 'pa', 'rra', 'pa', 'rrb', 'pa', 'rra', 'pa', 'pa', 'pa', 'ra'
    ]  
};
  function loadExample(example) {
    S.largeReplay = null;
    reset(example.numbers);
    $('countInput').value = String(example.numbers.length);
    $('disorderInput').value = '';
    syncPreset();
    if (S.mode !== 'replay') setMode('replay');
    $('operationsInput').value = example.moves.join('\n');
    loadSequence();
  }
  $('example5Btn').addEventListener('click', () => loadExample(EXAMPLE5));
  $('example10Btn').addEventListener('click', () => loadExample(EXAMPLE10));
  $('firstBtn').addEventListener('click', () => jump(0)); $('prevBtn').addEventListener('click', () => jump(S.cursor - 1, true)); $('nextBtn').addEventListener('click', () => jump(S.cursor + 1, true)); $('endBtn').addEventListener('click', () => jump(S.ops.length)); $('playBtn').addEventListener('click', togglePlayback); $('seek').addEventListener('input', e => jump(Number(e.target.value))); $('speed').addEventListener('input', e => setSpeed(e.target.value)); $('copyBtn').addEventListener('click', copyOps); $('clearBtn').addEventListener('click', clearOps);
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.playing) { stop(); draw(false) } });
  document.addEventListener('keydown', e => { const a = document.activeElement; const tag = a?.tagName; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || a?.isContentEditable || e.altKey || e.ctrlKey || e.metaKey) return; if (e.key === 'ArrowRight') { e.preventDefault(); jump(S.cursor + 1, true) } else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(S.cursor - 1, true) } else if (e.code === 'Space') { e.preventDefault(); togglePlayback() } });
  syncPreset(); setSpeed(1); updateDisorder(); S.check.set(0, snapshot(S.a, S.b)); S.ranks = new Map(S.initial.slice().sort((a, b) => a - b).map((v, i) => [v, i])); draw(false);


})();
