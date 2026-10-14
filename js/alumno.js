/**
 * Portal del Estudiante - Examen de Ingreso 2027
 * El estudiante ingresa con su DNI y ve solo su resultado publicado por Dirección
 * (colección 'student_results'): respuestas, si están bien o mal, nota final y condición.
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

  // Cronogramas de la próxima instancia: se muestran solo a quienes pasan.
  // Dirección asigna el cronograma 'alternativo' a algunos estudiantes (campo 'cronograma' del resultado publicado).
  const ACREDITACION_ITEMS = `
          <li>⏰ <strong>Acreditación:</strong> 13:45 hs</li>
          <li>✍️ <strong>Horario del examen:</strong> 14:15 a 16:15 hs</li>
          <li>🎒 <strong>Materiales:</strong> Hojas para escribir (rayadas o cuadriculadas) y cartuchera básica. 📝</li>`;
  const MISMOS_HORARIOS_ITEM = `
          <li>⏰ <strong>Modalidad y horarios:</strong> Mismos horarios de acreditación (13:45 hs) y examen (14:15 a 16:15 hs).</li>`;

  const scheduleItem = (title, fecha, items) => `
      <div class="schedule-item">
        <div class="schedule-title">${title}</div>
        <ul>
          <li>📅 <strong>Fecha correcta:</strong> ${fecha}</li>${items}
        </ul>
      </div>`;

  const SCHEDULES = {
    general: {
      title: 'El cronograma a seguir es el siguiente:',
      items: scheduleItem('📖 Examen de Prácticas del Lenguaje', 'Viernes 16 de octubre', ACREDITACION_ITEMS) +
        scheduleItem('📐 Examen de Matemática', 'Viernes 23 de octubre', MISMOS_HORARIOS_ITEM)
    },
    alternativo: {
      title: 'El cronograma es diferente, es el siguiente:',
      items: scheduleItem('📐 Examen de Matemática', 'Viernes 23 de octubre', ACREDITACION_ITEMS) +
        scheduleItem('📖 Examen de Prácticas del Lenguaje', 'Viernes 30 de octubre', MISMOS_HORARIOS_ITEM)
    }
  };

  function renderSchedule(cronograma) {
    const sched = SCHEDULES[cronograma] || SCHEDULES.general;
    return `
    <div class="schedule-card">
      <h2 class="section-title">${sched.title}</h2>${sched.items}
    </div>`;
  }

  function renderCondition(pasa, cronograma) {
    if (pasa === true) return '<div class="condition-banner condition-pasa">✅ PASA a la próxima instancia</div>' + renderSchedule(cronograma);
    if (pasa === false) return '<div class="condition-banner condition-no-pasa">❌ NO PASA a la próxima instancia</div>';
    return '<div class="condition-banner condition-pendiente">⏳ Condición pendiente</div>';
  }

  function renderResult(r) {
    $('resName').textContent = `${r.apellido}, ${r.nombre}`;
    $('resMeta').textContent = `DNI ${r.dni} • Aula ${r.aula}${r.tema ? ` • Tema ${r.tema}` : ''}`;

    let summary = '';
    if (r.estado === 'evaluado') {
      summary = `
        <div class="score-grid">
          <div class="score-box"><div class="lbl">Matemática</div><div class="val">${fmt(r.notaMatematica)} <small style="font-size: 0.9rem; color: var(--text-muted);">/ 5</small></div></div>
          <div class="score-box"><div class="lbl">Prácticas del Lenguaje</div><div class="val">${fmt(r.notaLengua)} <small style="font-size: 0.9rem; color: var(--text-muted);">/ 5</small></div></div>
          <div class="score-box"><div class="lbl">Nota final</div><div class="val">${fmt(r.notaFinal)} <small style="font-size: 0.9rem; color: var(--text-muted);">/ 10</small></div></div>
        </div>`;
    } else if (r.estado === 'ausente') {
      summary = '<p class="result-meta" style="margin-top: 1rem;">No hay un examen registrado para este estudiante (ausente).</p>';
    } else {
      summary = '<p class="result-meta" style="margin-top: 1rem;">El examen todavía está en corrección. Volvé a consultar más adelante.</p>';
    }
    $('resSummary').innerHTML = summary + renderCondition(r.pasa, r.cronograma);

    const preguntas = Array.isArray(r.preguntas) ? r.preguntas : [];
    if (r.estado === 'evaluado' && preguntas.length > 0) {
      $('resAnswersBody').innerHTML = preguntas.map(p => `
        <tr>
          <td class="c"><strong>${escapeHtml(p.n)}</strong></td>
          <td class="hide-sm">${escapeHtml(p.materia)}</td>
          <td>${escapeHtml(p.contenido)}</td>
          <td class="c"><strong>${escapeHtml(p.respuesta || '-')}</strong></td>
          <td class="c">${p.correcta ? '<span class="ok">✔ Bien</span>' : '<span class="bad">✘ Mal</span>'}</td>
        </tr>`).join('');
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
    $('resultView').style.display = 'none';
    $('dniLoginCard').style.display = '';
    $('dniInput').focus();
  }

  $('dniLoginForm').addEventListener('submit', handleSubmit);
  $('btnLogout').addEventListener('click', logout);
})();
