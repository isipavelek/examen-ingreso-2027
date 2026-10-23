/**
 * Portal del Estudiante - Examen de Ingreso 2027
 * La familia ingresa con el DNI y ve solo lo publicado por Dirección (colección 'student_results'),
 * en pestañas: Resumen (estado actual y condición final), Examen multiple choice y Exámenes de desarrollo
 * (esta última solo para quienes pasaron el multiple choice). Los mensajes están en data/mensajesFamilias.js.
 */

(function () {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCwfFNfxr_r0oow9pEBwWfA2VzBiFEB7U0",
    authDomain: "exingutn2027.firebaseapp.com",
    projectId: "exingutn2027",
    storageBucket: "exingutn2027.firebasestorage.app",
    messagingSenderId: "605495690912",
    appId: "1:605495690912:web:8fe29d22ed6f90e30f6bc5"
  };

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();

  const $ = id => document.getElementById(id);

  const escapeHtml = str => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmt = n => (typeof n === 'number') ? n.toFixed(1).replace('.', ',') : '-';

  function showError(msg) {
    $('dniError').textContent = msg;
  }

  const MENSAJES = window.MENSAJES_FAMILIAS || {};
  const mensaje = (clave, r) => escapeHtml(MENSAJES[clave] || '').replace(/\{nombre\}/g, `<strong>${escapeHtml(r.nombre)}</strong>`);

  // Resultado del examen multiple choice: si pasó o no a la siguiente instancia
  function renderCondition(pasa) {
    if (pasa === true) return '<div class="condition-banner condition-pasa">✅ PASÓ a la siguiente instancia (exámenes de desarrollo)</div>';
    if (pasa === false) return '<div class="condition-banner condition-no-pasa">❌ NO PASÓ a la siguiente instancia</div>';
    return '<div class="condition-banner condition-pendiente">⏳ Condición pendiente</div>';
  }

  // --- SEGUNDA INSTANCIA: PdL (16/10 o 30/10) y Matemática (23/10) ---
  // Quien pasó a la 2da instancia ve las dos tarjetas. Mientras Dirección no publique la nota, solo dice
  // "Aún sin corregir" (sin temas ni puntos). Publicada: la nota y, en cada punto, el tema evaluado y cómo
  // le fue. Nunca se muestran las consignas ni las respuestas.
  const fmt2 = n => (typeof n === 'number') ? n.toFixed(2).replace('.', ',') : '-';
  // Puntaje exacto de cada punto (B⁻ de 0,5 = 0,375)
  const fmtPts = n => (typeof n === 'number') ? String(Number(n.toFixed(4))).replace('.', ',') : '-';
  const resultClass = (pts, max) => (pts >= max ? 'ok' : (pts > 0 ? 'mid' : 'bad'));

  function examCard(card, { titulo, fechaTexto, exam, cuerpo }) {
    let body;
    if (!exam) {
      body = `
        <div class="pending-exam">
          <div class="pending-exam-title">⏳ Aún sin corregir</div>
          <div class="result-meta">Cuando el examen esté corregido y publicado vas a ver acá la nota y cómo le fue en cada tema evaluado.</div>
        </div>`;
    } else if (exam.estado !== 'evaluado') {
      body = '<p class="result-meta" style="margin-top: 0.5rem;">No hay un examen registrado para este estudiante (ausente).</p>';
    } else {
      body = cuerpo(exam);
    }
    card.innerHTML = `
      <h2 class="section-title">${titulo}</h2>
      <div class="answers-summary">${escapeHtml((exam && exam.fechaTexto) || fechaTexto || '')}</div>
      ${body}`;
    card.style.display = '';
  }

  function hideCard(card) {
    card.innerHTML = '';
    card.style.display = 'none';
  }

  function renderPdl(pdl, enSegundaInstancia, cronograma) {
    const card = $('resPdlCard');
    if (!pdl && !enSegundaInstancia) return hideCard(card);
    examCard(card, {
      titulo: '📖 Examen de Prácticas del Lenguaje',
      fechaTexto: cronograma === 'alternativo' ? 'Viernes 30 de octubre' : 'Viernes 16 de octubre',
      exam: pdl,
      cuerpo: e => {
        const secciones = Array.isArray(e.secciones) ? e.secciones : [];
        const items = Array.isArray(e.items) ? e.items : [];
        return `
          <div class="pdl-score-grid">
            <div class="score-box final"><div class="lbl">Nota de Prácticas del Lenguaje</div><div class="val">${fmt2(e.nota)} <span class="of">/ 10</span></div></div>
            ${secciones.map(s => `<div class="score-box"><div class="lbl">${escapeHtml(s.titulo)}</div><div class="val" style="font-size: 1.2rem;">${fmt2(s.nota)} <span class="of">/ ${fmt2(s.max)}</span></div></div>`).join('')}
          </div>
          <div class="answers-summary" style="margin-top: 0.75rem;">Tema evaluado en cada punto y puntaje obtenido sobre el máximo.</div>
          ${secciones.map(s => `
            <div class="subject-title">${escapeHtml(s.titulo)}</div>
            ${items.filter(it => it.seccion === s.id).map(it => `
              <div class="answer-row">
                <div class="answer-n">${escapeHtml(it.id)}</div>
                <div class="answer-topic">${escapeHtml(it.criterio)}</div>
                <span class="answer-result ${resultClass(it.puntaje, it.max)}">${fmtPts(it.puntaje)} / ${fmtPts(it.max)}</span>
              </div>`).join('')}`).join('')}`;
      }
    });
  }

  function renderMat(mat, enSegundaInstancia) {
    const card = $('resMatCard');
    if (!mat && !enSegundaInstancia) return hideCard(card);
    examCard(card, {
      titulo: '📐 Examen de Matemática',
      fechaTexto: 'Viernes 23 de octubre',
      exam: mat,
      cuerpo: e => {
        const items = Array.isArray(e.items) ? e.items : [];
        return `
          <div class="pdl-score-grid">
            <div class="score-box final"><div class="lbl">Nota de Matemática</div><div class="val">${fmt2(e.nota)} <span class="of">/ 10</span></div></div>
          </div>
          <div class="answers-summary" style="margin-top: 0.75rem;">Tema evaluado en cada ejercicio y cómo le fue: B (Bien), B⁻ (Bien menos), R (Regular), M (Mal), NR (No resuelve).</div>
          <div class="subject-title">Ejercicios</div>
          ${items.map(it => `
            <div class="answer-row">
              <div class="answer-n">${escapeHtml(it.id)}</div>
              <div class="answer-topic">${escapeHtml(it.tema || `Ejercicio ${it.id}`)}
                <span class="answer-given">Calificación: <strong>${escapeHtml(it.calificacion)}</strong>${it.nombre ? ` (${escapeHtml(it.nombre)})` : ''}</span>
              </div>
              <span class="answer-result ${resultClass(it.puntaje, it.max)}">${fmtPts(it.puntaje)} / ${fmtPts(it.max)}</span>
            </div>`).join('')}`;
      }
    });
  }

  // Nota de un examen de desarrollo para el Resumen: nota publicada, ausente o aún sin corregir
  function notaResumen(exam) {
    if (!exam) return '<div class="resumen-nota pendiente">⏳ Aún sin corregir</div>';
    if (exam.estado !== 'evaluado') return '<div class="resumen-nota pendiente">Ausente</div>';
    return `<div class="resumen-nota">${fmt2(exam.nota)} <span class="of">/ 10</span></div>`;
  }

  // Pestaña Resumen: estado actual de cada instancia y, al final, la condición final
  function renderResumen(r) {
    const pasa = r.pasa === true;
    const mcNota = r.estado === 'evaluado' ? `${fmt(r.notaFinal)} <span class="of">/ 10</span>` : (r.estado === 'ausente' ? 'Ausente' : '⏳ En corrección');
    const mcMarca = pasa
      ? '<div class="resumen-mark ok">✔ Pasó a la siguiente instancia</div>'
      : (r.pasa === false ? '<div class="resumen-mark bad">✘ No pasó a la siguiente instancia</div>' : '<div class="resumen-mark">⏳ Condición pendiente</div>');
    let html = `
      <h2 class="section-title">Estado actual</h2>
      <div class="resumen-row">
        <div><div class="resumen-exam">📝 Examen multiple choice</div><div class="resumen-fecha">Viernes 2 de octubre</div></div>
        <div><div class="resumen-nota">${mcNota}</div>${mcMarca}</div>
      </div>`;

    if (r.pasa === false) {
      html += `<div class="final-condition no-pasa"><h3>Condición final</h3>${mensaje('noPasa', r)}</div>`;
    } else if (pasa) {
      const fechaPdl = r.cronograma === 'alternativo' ? 'Viernes 30 de octubre' : 'Viernes 16 de octubre';
      html += `
        <div class="resumen-row">
          <div><div class="resumen-exam">📖 Examen de desarrollo de Prácticas del Lenguaje</div><div class="resumen-fecha">${escapeHtml((r.pdl && r.pdl.fechaTexto) || fechaPdl)}</div></div>
          ${notaResumen(r.pdl)}
        </div>
        <div class="resumen-row">
          <div><div class="resumen-exam">📐 Examen de desarrollo de Matemática</div><div class="resumen-fecha">${escapeHtml((r.mat && r.mat.fechaTexto) || 'Viernes 23 de octubre')}</div></div>
          ${notaResumen(r.mat)}
        </div>`;
      if (r.ingreso && typeof r.ingreso.ingresa === 'boolean') {
        html += r.ingreso.ingresa
          ? `<div class="final-condition ingresa"><h3>🎓 Condición final: INGRESA</h3>${mensaje('ingresa', r)}</div>`
          : `<div class="final-condition no-ingresa"><h3>Condición final</h3>${mensaje('noIngresa', r)}</div>`;
      } else {
        html += `<div class="final-condition pendiente"><h3>⏳ Condición final: pendiente</h3>${mensaje('pendiente', r)}</div>`;
      }
    }
    $('resResumen').innerHTML = html;
  }

  // Pestañas: la de exámenes de desarrollo solo existe para quienes pasaron el multiple choice
  function showTab(tab) {
    document.querySelectorAll('.result-tab').forEach(b => {
      const on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.result-panel').forEach(p => {
      p.style.display = p.getAttribute('data-panel') === tab ? '' : 'none';
    });
  }

  function renderResult(r) {
    const enSegundaInstancia = r.pasa === true;
    renderPdl(r.pdl, enSegundaInstancia, r.cronograma);
    renderMat(r.mat, enSegundaInstancia);
    renderResumen(r);
    $('tabBtnDesarrollo').style.display = enSegundaInstancia ? '' : 'none';
    showTab('resumen');
    $('resName').textContent = `${r.apellido}, ${r.nombre}`;
    $('resMeta').textContent = `DNI ${r.dni}`;

    let summary = '';
    if (r.estado === 'evaluado') {
      summary = `
        <div class="score-grid">
          <div class="score-box final"><div class="lbl">Nota final</div><div class="val">${fmt(r.notaFinal)} <span class="of">/ 10</span></div></div>
          <div class="score-box"><div class="lbl">Matemática</div><div class="val">${fmt(r.notaMatematica)} <span class="of">/ 5</span></div></div>
          <div class="score-box"><div class="lbl">Prácticas del Lenguaje</div><div class="val">${fmt(r.notaLengua)} <span class="of">/ 5</span></div></div>
        </div>`;
    } else if (r.estado === 'ausente') {
      summary = '<p class="result-meta" style="margin-top: 1rem;">No hay un examen registrado para este estudiante (ausente).</p>';
    } else {
      summary = '<p class="result-meta" style="margin-top: 1rem;">El examen todavía está en corrección. Volvé a consultar más adelante.</p>';
    }
    $('resSummary').innerHTML = (r.tema ? `<div class="answers-summary">Tema ${escapeHtml(r.tema)}</div>` : '') + summary + renderCondition(r.pasa);

    const preguntas = Array.isArray(r.preguntas) ? r.preguntas : [];
    if (r.estado === 'evaluado' && preguntas.length > 0) {
      // Agrupadas por materia, en filas compactas que se leen bien en el celular
      const materias = [];
      preguntas.forEach(p => { if (!materias.includes(p.materia)) materias.push(p.materia); });
      $('resAnswersBody').innerHTML = materias.map(materia => `
        <div class="subject-title">${escapeHtml(materia)}</div>
        ${preguntas.filter(p => p.materia === materia).map(p => `
          <div class="answer-row">
            <div class="answer-n">${escapeHtml(p.n)}</div>
            <div class="answer-topic">${escapeHtml(p.contenido)}
              <span class="answer-given">Tu respuesta: <strong>${escapeHtml(p.respuesta || '-')}</strong></span>
            </div>
            ${p.correcta ? '<span class="answer-result ok">✔ Bien</span>' : '<span class="answer-result bad">✘ Mal</span>'}
          </div>`).join('')}`).join('');
      const bien = preguntas.filter(p => p.correcta).length;
      $('resAnswersSummary').textContent = `${bien} de ${preguntas.length} respuestas bien`;
      $('resAnswersCard').style.display = '';
    } else {
      $('resAnswersBody').innerHTML = '';
      $('resAnswersCard').style.display = 'none';
    }

    $('dniLoginCard').style.display = 'none';
    $('resultView').style.display = '';
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    showError('');
    const dni = $('dniInput').value.replace(/\D/g, '');
    if (dni.length < 7 || dni.length > 9) {
      showError('Ingresá un DNI válido (7 a 9 números, sin puntos).');
      return;
    }

    const btn = $('btnDniSubmit');
    btn.disabled = true;
    btn.textContent = 'Buscando...';
    try {
      const snap = await db.collection('student_results').doc(dni).get();
      if (!snap.exists) {
        showError('No encontramos resultados para ese DNI. Verificá el número o consultá en la escuela.');
        return;
      }
      renderResult(snap.data());
    } catch (err) {
      console.error('Error consultando resultado:', err);
      showError('No se pudo consultar el resultado en este momento. Intentá de nuevo más tarde.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ver mi resultado';
    }
  }

  function logout() {
    $('dniInput').value = '';
    $('resAnswersBody').innerHTML = '';
    $('resSummary').innerHTML = '';
    $('resResumen').innerHTML = '';
    renderPdl(null);
    renderMat(null);
    $('resultView').style.display = 'none';
    $('dniLoginCard').style.display = '';
    $('dniInput').focus();
  }

  $('dniLoginForm').addEventListener('submit', handleSubmit);
  $('btnLogout').addEventListener('click', logout);
  document.querySelectorAll('.result-tab').forEach(b => b.addEventListener('click', () => showTab(b.getAttribute('data-tab'))));
})();
