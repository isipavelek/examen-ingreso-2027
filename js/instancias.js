/**
 * Instancias del Ingreso 2027: PdL 16/10, Matemática 23/10 y PdL 30/10
 * Escuela Secundaria Técnica – UTN – San Miguel
 *
 * - El inicio de sesión es único (EST/index.html). Acá entran Dirección (todas las fechas)
 *   y los profesores de cada materia (solo las fechas de su materia).
 * - Presentismo por fecha: la toma de lista de los encuentros ('instance_attendance'), la misma del sistema del personal.
 * - Corrección ítem por ítem con la rúbrica oficial de cada examen (InstanciasCore.getRubrica):
 *   PdL en 'pdl_grades', Matemática en 'mat_grades'. Resultados, estadísticas y publicación por fecha:
 *   Dirección libera de a partes las notas corregidas ('student_results/{dni}.pdl' o '.mat'); cada
 *   estudiante publicado queda cerrado para los profesores (pdl_config/publicacion.publicadas[fecha].alumnos).
 * - Respuestas esperadas de Matemática: 'mat_config/clave', las carga Dirección desde un archivo privado.
 * - El padrón lo envía Dirección desde Actas y Exportación ('pdl_config/padron').
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

  // Mantener en sincronía con firebase-sync.js y firestore.rules
  const DIRECCION = [
    { uid: "uNHF999HedgtuI5BQDpOOH1eBD03", name: "Director General" },
    { uid: "laVFIzdRPWPFUvPWBdGcZIlZPSA2", name: "Santiago Poggio (Vicedirección)" }
  ];

  const CFG = window.PDL_CONFIG;
  const Core = window.InstanciasCore;
  const PROFESORES = [
    ...CFG.profesores.map(p => ({ ...p, materia: 'pdl', rol: 'PROFESOR/A PdL' })),
    ...(CFG.profesoresMat || []).map(p => ({ ...p, materia: 'mat', rol: 'PROFESOR/A MATEMÁTICA' }))
  ];
  const FECHA_INICIAL = { pdl: '16-10', mat: '23-10' };
  const SAVE_DELAY_MS = 1200;

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();
  const auth = firebase.auth();

  const $ = id => document.getElementById(id);
  const escapeHtml = str => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fmt = (n, dec = 2) => (typeof n === 'number') ? n.toFixed(dec).replace('.', ',') : '-';
  // Puntaje exacto sin ceros de más (0,5625 · 0,375 · 0,75)
  const fmtPts = n => (typeof n === 'number') ? String(Number(n.toFixed(4))).replace('.', ',') : '-';
  const ESTADO_LABEL = { corregido: '✅ Corregido', en_progreso: '✍️ En progreso', pendiente: '⏳ Por corregir', ausente: '🚫 Ausente' };
  const PRESENCIA_LABEL = { presente: '✔ Presente', ausente: '✘ Ausente', sin_registrar: '— Sin registrar' };
  // Búsqueda sin tildes, mayúsculas ni comas ("Rodríguez" = "rodriguez"), en apellido y nombre en cualquier orden y DNI
  const normalizeText = v => String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/,/g, ' ').replace(/\s+/g, ' ')
    .toLowerCase().trim();
  const matchesSearch = (st, query) => {
    const words = normalizeText(query).split(' ').filter(Boolean);
    const hay = [st.apellido, st.nombre, st.dni].map(normalizeText).join(' | ');
    return words.every(w => hay.includes(w));
  };

  class InstanciasApp {
    constructor() {
      const params = new URLSearchParams(window.location.search);
      this.fecha = params.get('fecha') || '16-10';
      this.requestedTab = params.get('tab');
      this.profile = null;
      this.roster = [];
      this.rosterMeta = null;
      this.gradesByTipo = { pdl: new Map(), mat: new Map() };
      this.clave = null; // respuestas esperadas de Matemática ('mat_config/clave')
      this.asistencia = {}; // fecha -> { studentId: { asistio, por, en } }
      this.publicadas = {};
      this.unsubs = [];
      this.tab = null;
      this.selectedId = null;
      this.current = null; // corrección en edición del estudiante seleccionado
      this.dirty = false;
      this.saveTimer = null;
      this.focusedIdx = 0;
    }

    get inst() {
      return Core.getInstancia(this.fecha);
    }

    get rubrica() {
      return Core.getRubrica(this.inst.tipo);
    }

    get grades() {
      return this.gradesByTipo[this.inst.tipo] || new Map();
    }

    gradesFor(fecha) {
      const inst = Core.getInstancia(fecha);
      return (inst && this.gradesByTipo[inst.tipo]) || new Map();
    }

    scores(niveles) {
      return Core.computeScores(this.rubrica, niveles);
    }

    init() {
      $('pdlBtnLogout').addEventListener('click', () => this.logout());
      document.querySelectorAll('.nav-tab-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => this.switchTab(btn.getAttribute('data-tab')));
      });

      $('attBuscar').addEventListener('input', () => this.renderPresentismo());
      $('attFiltro').addEventListener('change', () => this.renderPresentismo());
      $('fEstado').addEventListener('change', () => this.renderList());
      $('fBuscar').addEventListener('input', () => this.renderList());
      $('resBuscar').addEventListener('input', () => this.renderResultados());
      $('resFiltro').addEventListener('change', () => this.renderResultados());
      $('btnExportXlsx').addEventListener('click', () => this.exportXlsx());
      $('btnClaveFile').addEventListener('click', () => $('claveFileInput').click());
      $('claveFileInput').addEventListener('change', e => this.uploadClave(e));

      document.querySelectorAll('#temaSelector .tema-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setTema(btn.getAttribute('data-tema')));
      });
      $('btnAusente').addEventListener('click', () => this.toggleAusente());
      $('btnFinish').addEventListener('click', () => this.finish());
      $('btnPrev').addEventListener('click', () => this.navigate(-1));
      $('btnNext').addEventListener('click', () => this.navigate(1));
      $('obsInput').addEventListener('input', e => {
        if (!this.current || !this.canEditCurrent()) return;
        this.current.observaciones = e.target.value;
        this.markDirty();
      });

      this.bindKeyboard();
      window.addEventListener('beforeunload', e => {
        if (this.dirty) {
          this.saveNow();
          e.preventDefault();
          e.returnValue = '';
        }
      });

      auth.onAuthStateChanged(user => this.onAuth(user));
    }

    // --- SESIÓN (el inicio de sesión es único, en EST/index.html) ---

    async logout() {
      await this.saveNow();
      await auth.signOut();
    }

    onAuth(user) {
      this.teardown();
      if (!user) {
        window.location.href = 'index.html';
        return;
      }
      const dir = DIRECCION.find(d => d.uid === user.uid);
      const prof = PROFESORES.find(p => p.uid === user.uid);
      if (!dir && !prof) {
        // Preceptores y demás personal trabajan en el sistema principal
        window.location.href = 'index.html';
        return;
      }
      this.profile = dir
        ? { uid: dir.uid, name: dir.name, isAdmin: true, materia: null, role: 'DIRECCIÓN' }
        : { uid: prof.uid, name: prof.name, isAdmin: false, materia: prof.materia, role: prof.rol };

      $('loadingScreen').style.display = 'none';
      $('pdlUserName').textContent = this.profile.name;
      $('pdlUserRole').textContent = this.profile.role;
      $('pdlUserAvatar').textContent = this.profile.name.charAt(0);

      const inst = this.inst;
      const allowed = inst && inst.tipo !== 'mc' && (this.profile.isAdmin || inst.tipo === this.profile.materia);
      this.setFecha(allowed ? this.fecha : FECHA_INICIAL[this.profile.materia || 'pdl'], this.requestedTab);
      this.listen();
    }

    // --- FECHA / INSTANCIA ACTIVA ---

    setFecha(fecha, tab) {
      this.saveNow();
      this.fecha = fecha;
      this.selectedId = null;
      this.current = null;
      const url = new URL(window.location.href);
      url.searchParams.set('fecha', fecha);
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', url.toString());

      const inst = this.inst;
      $('instIcon').textContent = inst.icono;
      $('instTitle').textContent = inst.titulo;
      $('instSubtitle').textContent = inst.fechaTexto;
      document.title = `${inst.titulo} | EST - UTN San Miguel`;

      Core.renderInstanceBar($('instanceBar'), {
        active: fecha,
        isAdmin: this.profile.isAdmin,
        materia: this.profile.materia,
        onSelect: id => {
          const target = Core.getInstancia(id);
          if (!target || target.tipo === 'mc') return false; // 2/10 y Resumen general: sistema del personal
          this.setFecha(id);
          return true;
        }
      });

      document.querySelectorAll('.nav-tab-btn[data-tab]').forEach(btn => {
        const tipoOk = !btn.dataset.tipo || btn.dataset.tipo.split(',').includes(inst.tipo);
        const adminOk = !btn.dataset.admin || this.profile.isAdmin;
        btn.style.display = (tipoOk && adminOk) ? 'flex' : 'none';
      });
      this.renderKbdHints();

      const def = this.profile.isAdmin ? 'resultados' : 'correccion';
      this.switchTab(this.isTabVisible(tab) ? tab : (this.isTabVisible(this.tab) ? this.tab : def));
    }

    isTabVisible(tab) {
      if (!tab) return false;
      const btn = document.querySelector(`.nav-tab-btn[data-tab="${tab}"]`);
      return !!btn && btn.style.display !== 'none';
    }

    // --- FIRESTORE ---

    teardown() {
      this.unsubs.forEach(fn => fn());
      this.unsubs = [];
    }

    listen() {
      const onError = ctx => err => {
        console.error(`Firestore (${ctx}):`, err);
        if (err && err.code === 'permission-denied') {
          this.toast('🔒 Sin permiso en Firebase: falta publicar las reglas actualizadas (firestore.rules).', 'danger');
        }
      };

      this.unsubs.push(db.collection('pdl_config').doc('padron').onSnapshot(snap => {
        const data = snap.exists ? snap.data() : null;
        this.roster = (data && Array.isArray(data.alumnos)) ? data.alumnos : [];
        this.rosterMeta = data ? { actualizadoEn: data.actualizadoEn, actualizadoPor: data.actualizadoPor } : null;
        this.renderAll();
      }, onError('padron')));

      this.unsubs.push(db.collection('pdl_config').doc('publicacion').onSnapshot(snap => {
        this.publicadas = (snap.exists && snap.data().publicadas) || {};
        this.renderAll();
      }, onError('publicacion')));

      // Presentismo: la misma toma de lista de los encuentros que usan los preceptores
      this.unsubs.push(db.collection('instance_attendance').onSnapshot(snap => {
        const docs = {};
        snap.forEach(doc => { docs[doc.id] = doc.data(); });
        this.asistencia = Core.asistenciaPorInstancia(docs);
        this.renderAll();
      }, onError('instance_attendance')));

      // Correcciones: Dirección lee las de las dos materias; cada profesor, las de la suya
      ['pdl', 'mat'].filter(tipo => this.profile.isAdmin || this.profile.materia === tipo).forEach(tipo => {
        const rub = Core.getRubrica(tipo);
        this.unsubs.push(db.collection(rub.coleccion).onSnapshot(snap => {
          const map = new Map();
          snap.forEach(doc => map.set(doc.id, doc.data()));
          this.gradesByTipo[tipo] = map;
          // Si otro docente cambió la corrección abierta y acá no hay cambios sin guardar, se actualiza
          if (this.inst.tipo === tipo && this.selectedId && !this.dirty && map.has(this.selectedId)) {
            this.current = this.loadCurrent(this.selectedId);
          }
          this.renderAll();
        }, onError(rub.coleccion)));
      });

      if (this.profile.isAdmin || this.profile.materia === 'mat') {
        this.unsubs.push(db.collection('mat_config').doc('clave').onSnapshot(snap => {
          this.clave = snap.exists ? snap.data() : null;
          this.renderAll();
        }, onError('mat_config')));
      }
    }

    // --- ESTADO DE CADA ESTUDIANTE EN LA FECHA ACTIVA ---

    getRoster() {
      return Core.rosterFor(this.roster, this.fecha);
    }

    getAsistencia(studentId, fecha = this.fecha) {
      return (this.asistencia[fecha] || {})[studentId] || null;
    }

    getGrade(studentId) {
      return this.grades.get(studentId) || null;
    }

    getPresencia(studentId) {
      return Core.presencia(this.fecha, this.getGrade(studentId), this.getAsistencia(studentId));
    }

    getEstado(studentId) {
      return Core.estadoGrade(this.getGrade(studentId), this.getAsistencia(studentId));
    }

    isPublished(fecha = this.fecha) {
      return !!(fecha && this.publicadas[fecha]);
    }

    // ¿La nota de este estudiante ya fue liberada? (las publicaciones viejas, sin lista, cerraban toda la fecha)
    isStudentPublished(studentId, fecha = this.fecha) {
      const pub = this.publicadas[fecha];
      if (!pub) return false;
      return Array.isArray(pub.alumnos) ? pub.alumnos.includes(studentId) : true;
    }

    canEditFecha() {
      if (!this.profile) return false;
      if (this.profile.isAdmin) return true;
      return this.inst.tipo === this.profile.materia;
    }

    // Los profesores no pueden modificar a un estudiante cuya nota Dirección ya liberó
    canEditCurrent() {
      if (!this.current || !this.canEditFecha()) return false;
      return this.profile.isAdmin || !this.isStudentPublished(this.current.studentId, this.current.fecha);
    }

    temaOk(tema) {
      return !this.rubrica.usaTema || tema === 'A' || tema === 'B';
    }

    // Estado de una corrección según el presentismo, si está completa y si el docente la terminó
    estadoDe({ ausente, finalizada, tema }, sc) {
      if (ausente) return 'ausente';
      return (finalizada && sc.completo && this.temaOk(tema)) ? 'corregido' : 'en_progreso';
    }

    // Respuesta esperada de un ítem (solo Matemática, desde 'mat_config/clave')
    claveDe(itemId) {
      return (this.inst.tipo === 'mat' && this.clave && this.clave.items && this.clave.items[itemId]) || null;
    }

    // Registra presentismo solo si cambió (evita escrituras de más)
    async writeAsistencia(studentId, asistio) {
      const prev = this.getAsistencia(studentId);
      if (prev && prev.asistio === asistio) return;
      const encuentroId = this.inst.encuentroId;
      const st = this.roster.find(s => s.id === studentId);
      const en = new Date().toISOString();
      if (!this.asistencia[this.fecha]) this.asistencia[this.fecha] = {};
      this.asistencia[this.fecha][studentId] = { asistio, por: this.profile.name, en };
      // Mismo formato que la toma de lista del sistema del personal (DataService.setEncuentroAttendance)
      await db.collection('instance_attendance').doc(`${encuentroId}_${studentId}`).set({
        encuentroId,
        studentId,
        dni: st ? st.dni : '',
        studentName: st ? `${st.apellido}, ${st.nombre}` : '',
        presente: asistio,
        updatedBy: this.profile.name,
        updatedByUid: this.profile.uid,
        updatedAt: en
      });
    }

    // --- RENDER GENERAL ---

    switchTab(tab) {
      if (!this.isTabVisible(tab)) return;
      if (tab !== 'correccion') this.saveNow();
      this.tab = tab;
      document.querySelectorAll('.nav-tab-btn[data-tab]').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
      document.querySelectorAll('.view-section').forEach(s => s.classList.toggle('active', s.id === `view-${tab}`));
      this.renderAll();
    }

    renderAll() {
      if (!this.profile || !this.tab) return;
      if (this.tab === 'presentismo') this.renderPresentismo();
      else if (this.tab === 'correccion') {
        this.renderList();
        this.renderGrading();
      } else if (this.tab === 'resultados') this.renderResultados();
      else if (this.tab === 'estadisticas') this.renderStats();
      else if (this.tab === 'publicacion') this.renderPublicacion();
    }

    noRosterHtml() {
      return `<div class="empty-state">Todavía no hay padrón de la segunda instancia.${this.profile && this.profile.isAdmin
        ? '<br><br>Envialo desde el sistema del personal: <strong>Actas y Exportación → 📖 Enviar padrón de la 2da instancia</strong>.'
        : '<br><br>Dirección tiene que enviarlo desde el sistema del personal.'}</div>`;
    }

    kpi(icon, value, label, color) {
      return `
        <div class="kpi-card">
          <div class="kpi-icon" style="background: rgba(59, 130, 246, 0.12);">${icon}</div>
          <div class="kpi-data"><span class="kpi-value" ${color ? `style="color: ${color};"` : ''}>${value}</span><span class="kpi-label">${label}</span></div>
        </div>`;
    }

    // --- PRESENTISMO (Dirección) ---

    renderPresentismo() {
      const roster = this.getRoster();
      $('attTitle').textContent = `🙋 Presentismo • ${this.inst.titulo}`;
      $('attSubtitle').textContent = `${this.inst.tipo === 'mat' ? 'Convocados: todos los estudiantes que pasan a la segunda instancia. ' : ''}Lo toman los preceptores en Asistencia Encuentros y Dirección acá. Un examen que los profesores empiezan a corregir cuenta como presente.`;

      const counts = { presente: 0, ausente: 0, sin_registrar: 0 };
      roster.forEach(st => { counts[this.getPresencia(st.id)]++; });
      $('attKpis').innerHTML =
        this.kpi('📋', roster.length, 'Convocados') +
        this.kpi('✔', counts.presente, 'Presentes', '#34d399') +
        this.kpi('✘', counts.ausente, 'Ausentes', '#f87171') +
        this.kpi('—', counts.sin_registrar, 'Sin registrar', counts.sin_registrar ? '#fbbf24' : null);

      const body = $('attBody');
      if (this.roster.length === 0) {
        body.innerHTML = `<tr><td colspan="5">${this.noRosterHtml()}</td></tr>`;
        return;
      }
      const q = $('attBuscar').value;
      const filtro = $('attFiltro').value;
      const editable = this.profile.isAdmin;
      const rows = roster.filter(st => matchesSearch(st, q) && (filtro === 'all' || this.getPresencia(st.id) === filtro));
      body.innerHTML = rows.length === 0
        ? '<tr><td colspan="5" class="empty-state">No hay estudiantes con esos filtros.</td></tr>'
        : rows.map((st, i) => {
          const p = this.getPresencia(st.id);
          return `
            <tr>
              <td class="num" style="color: var(--text-muted);">${i + 1}</td>
              <td><strong>${escapeHtml(st.apellido)}, ${escapeHtml(st.nombre)}</strong></td>
              <td>${escapeHtml(st.dni)}</td>
              <td class="num"><span class="pill-mini st-${p}">${PRESENCIA_LABEL[p]}</span></td>
              <td>
                <div class="att-actions">
                  <button type="button" class="att-btn ${p === 'presente' ? 'on-presente' : ''}" data-id="${escapeHtml(st.id)}" data-asistio="1" ${editable ? '' : 'disabled'}>✔ Presente</button>
                  <button type="button" class="att-btn ${p === 'ausente' ? 'on-ausente' : ''}" data-id="${escapeHtml(st.id)}" data-asistio="0" ${editable ? '' : 'disabled'}>✘ Ausente</button>
                </div>
              </td>
            </tr>`;
        }).join('');
      body.querySelectorAll('.att-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setPresencia(btn.getAttribute('data-id'), btn.getAttribute('data-asistio') === '1'));
      });
    }

    // El presentismo lo toman los preceptores y Dirección; los profesores solo corrigen
    async setPresencia(studentId, asistio) {
      if (!this.profile || !this.profile.isAdmin) return;
      try {
        await this.writeAsistencia(studentId, asistio);
        // Una corrección existente acompaña el presentismo marcado
        const g = this.getGrade(studentId);
        if (g && !!g.ausente === asistio) {
          if (this.selectedId === studentId) this.saveNow();
          const sc = this.scores(Core.nivelesDeGrade(this.rubrica, g));
          const updated = {
            ...g,
            ausente: !asistio,
            estado: this.estadoDe({ ausente: !asistio, finalizada: g.finalizada, tema: g.tema }, sc),
            nota: asistio ? sc.nota : null,
            correctorUid: this.profile.uid,
            correctorNombre: this.profile.name,
            actualizadoEn: new Date().toISOString()
          };
          this.grades.set(studentId, updated);
          await db.collection(this.rubrica.coleccion).doc(studentId).set(updated);
        }
        this.renderAll();
      } catch (err) {
        console.error('Error registrando presentismo:', err);
        this.toast(`No se pudo registrar el presentismo: ${err.message}`, 'danger');
      }
    }

    // --- CORRECCIÓN POR RÚBRICA ---

    getFilteredRoster() {
      const fEstado = $('fEstado').value;
      const q = $('fBuscar').value;
      return this.getRoster().filter(st => {
        const estado = this.getEstado(st.id);
        if (fEstado === 'por_corregir' && !(estado === 'pendiente' || estado === 'en_progreso')) return false;
        if (fEstado !== 'all' && fEstado !== 'por_corregir' && estado !== fEstado) return false;
        return matchesSearch(st, q);
      });
    }

    renderList() {
      const container = $('studentList');
      if (this.roster.length === 0) {
        container.innerHTML = this.noRosterHtml();
        $('listCount').textContent = '';
        return;
      }
      const list = this.getFilteredRoster();
      $('listCount').textContent = `${list.length} de ${this.getRoster().length} estudiantes • ${this.inst.titulo}`;
      if (list.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay estudiantes con esos filtros.</div>';
        return;
      }
      container.innerHTML = list.map(st => {
        const estado = this.getEstado(st.id);
        const g = this.getGrade(st.id);
        const nota = (g && estado !== 'ausente' && g.itemsCompletos > 0) ? ` • ${fmt(g.nota)}` : '';
        return `
          <div class="student-list-item ${st.id === this.selectedId ? 'selected' : ''}" data-id="${escapeHtml(st.id)}">
            <div class="li-row">
              <strong class="student-name">${escapeHtml(st.apellido)}, ${escapeHtml(st.nombre)}</strong>
            </div>
            <div class="li-row li-meta">
              <span>DNI ${escapeHtml(st.dni)}</span>
              <span class="pill-mini st-${estado}">${ESTADO_LABEL[estado]}${nota}</span>
            </div>
          </div>`;
      }).join('');
      container.querySelectorAll('.student-list-item').forEach(el => {
        el.addEventListener('click', () => this.selectStudent(el.getAttribute('data-id')));
      });
    }

    loadCurrent(studentId) {
      const st = this.roster.find(s => s.id === studentId);
      if (!st) return null;
      const g = this.getGrade(studentId);
      const att = this.getAsistencia(studentId);
      return {
        studentId,
        dni: st.dni,
        apellido: st.apellido,
        nombre: st.nombre,
        fecha: this.fecha,
        tema: (g && g.tema) || null,
        ausente: g ? !!g.ausente : !!(att && att.asistio === false),
        niveles: Core.nivelesDeGrade(this.rubrica, g),
        observaciones: (g && g.observaciones) || '',
        finalizada: !!(g && g.finalizada)
      };
    }

    selectStudent(studentId) {
      if (studentId === this.selectedId) return;
      this.saveNow();
      this.selectedId = studentId;
      this.current = this.loadCurrent(studentId);
      const firstEmpty = this.rubrica.items.findIndex(it => !(this.current && this.current.niveles[it.id]));
      this.focusedIdx = firstEmpty >= 0 ? firstEmpty : 0;
      this.renderList();
      this.renderGrading();
      const el = document.querySelector(`.student-list-item[data-id="${CSS.escape(studentId)}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    navigate(delta) {
      const list = this.getFilteredRoster();
      if (list.length === 0) return;
      const idx = list.findIndex(s => s.id === this.selectedId);
      const next = list[Math.max(0, Math.min(list.length - 1, idx + delta))];
      if (next) this.selectStudent(next.id);
    }

    // Siguiente estudiante sin terminar (en el orden de la lista visible)
    navigateNextPending() {
      const list = this.getFilteredRoster();
      const idx = list.findIndex(s => s.id === this.selectedId);
      const ordered = [...list.slice(idx + 1), ...list.slice(0, Math.max(0, idx))];
      const next = ordered.find(s => ['pendiente', 'en_progreso'].includes(this.getEstado(s.id)));
      if (next) this.selectStudent(next.id);
      else this.toast('🎉 No quedan exámenes por corregir en esta lista.', 'success');
    }

    setTema(tema) {
      if (!this.rubrica.usaTema || !this.current || !this.canEditCurrent() || this.current.ausente) return;
      this.current.tema = tema;
      this.markDirty();
      this.renderGrading();
    }

    toggleAusente() {
      if (!this.current || !this.canEditCurrent() || !this.profile.isAdmin) return;
      this.current.ausente = !this.current.ausente;
      this.markDirty();
      this.renderGrading();
      this.saveNow();
    }

    setLevel(itemIdx, key, toggle = true) {
      if (!this.current || !this.canEditCurrent() || this.current.ausente) return;
      const it = this.rubrica.items[itemIdx];
      if (!it) return;
      if (toggle && this.current.niveles[it.id] === key) {
        delete this.current.niveles[it.id]; // segundo clic sobre el mismo nivel lo borra
      } else {
        this.current.niveles[it.id] = key;
        this.focusedIdx = Math.min(this.rubrica.items.length - 1, itemIdx + 1);
      }
      this.markDirty();
      this.renderGrading();
    }

    async finish() {
      if (!this.current || !this.canEditCurrent()) return;
      if (!this.current.ausente) {
        if (!this.temaOk(this.current.tema)) {
          this.toast('Elegí Tema A o Tema B antes de terminar.', 'warning');
          const sel = $('temaSelector');
          sel.classList.remove('shake-highlight-tema');
          void sel.offsetWidth;
          sel.classList.add('shake-highlight-tema');
          return;
        }
        const faltan = this.rubrica.items.filter(it => !this.current.niveles[it.id]);
        if (faltan.length > 0) {
          this.toast(`Faltan ${faltan.length} ítem(s): ${faltan.map(f => f.id).join(', ')}`, 'warning');
          this.focusedIdx = this.rubrica.items.indexOf(faltan[0]);
          this.renderGrading();
          return;
        }
      }
      this.current.finalizada = true;
      this.dirty = true;
      const ok = await this.saveNow();
      if (ok) {
        const sc = this.scores(this.current.niveles);
        const nota = fmt(sc.nota);
        this.toast(this.current.ausente
          ? `🚫 ${this.current.apellido}: registrado como ausente`
          : `✅ ${this.current.apellido}, ${this.current.nombre}: ${nota} / 10`, 'success');
        this.navigateNextPending();
      }
    }

    markDirty() {
      this.dirty = true;
      $('saveState').textContent = '✏️ Cambios sin guardar...';
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), SAVE_DELAY_MS);
    }

    async saveNow() {
      clearTimeout(this.saveTimer);
      if (!this.dirty || !this.current || !this.profile) return true;
      const cur = this.current;
      const rub = this.rubrica;
      const sc = this.scores(cur.niveles);

      const record = {
        studentId: cur.studentId,
        dni: cur.dni,
        apellido: cur.apellido,
        nombre: cur.nombre,
        fecha: cur.fecha,
        tema: rub.usaTema ? (cur.tema || null) : null,
        ausente: cur.ausente,
        niveles: cur.niveles,
        puntajes: sc.puntajes,
        observaciones: cur.observaciones || '',
        suma: sc.suma,
        nota: cur.ausente ? null : sc.nota,
        itemsCompletos: sc.completos,
        finalizada: cur.finalizada,
        estado: this.estadoDe(cur, sc),
        correctorUid: this.profile.uid,
        correctorNombre: this.profile.name,
        actualizadoEn: new Date().toISOString()
      };
      // Puntaje por sección (PdL: notaA, notaB, notaC)
      rub.secciones.forEach(s => { record[`nota${s.id}`] = sc.secs[s.id]; });

      this.dirty = false;
      this.grades.set(cur.studentId, record);
      $('saveState').textContent = '☁️ Guardando...';
      try {
        await db.collection(rub.coleccion).doc(cur.studentId).set(record);
        // El presentismo lo registra Dirección; los profesores solo corrigen (corregir ya cuenta como presente)
        if (this.profile.isAdmin && (cur.ausente || cur.tema || sc.completos > 0)) await this.writeAsistencia(cur.studentId, !cur.ausente);
        if (this.current === cur) $('saveState').textContent = `💾 Guardado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
        if (this.tab === 'correccion') this.renderList();
        return true;
      } catch (err) {
        console.error('Error guardando corrección:', err);
        if (this.current === cur) this.dirty = true;
        $('saveState').textContent = '⚠️ No se pudo guardar';
        this.toast(err.code === 'permission-denied'
          ? '🔒 No se pudo guardar: la nota de este estudiante ya fue publicada o faltan las reglas de Firebase.'
          : `Error al guardar: ${err.message}`, 'danger');
        return false;
      }
    }

    renderKbdHints() {
      const rub = this.rubrica;
      const n = rub ? Math.max(...rub.items.map(it => it.niveles.length)) : 4;
      const levelHint = rub && rub.tipo === 'mat'
        ? `<span><span class="key-badge">1</span>–<span class="key-badge">${n}</span> ${rub.items[0].niveles.map(l => l.label).join(' · ')}</span>`
        : `<span><span class="key-badge">1</span>–<span class="key-badge">${n}</span> nivel</span><span><span class="key-badge">0</span> 0 pts</span>`;
      $('kbdHints').innerHTML = `
        <span><span class="key-badge">↑</span> <span class="key-badge">↓</span> ítem</span>
        ${levelHint}
        ${rub && rub.usaTema ? '<span><span class="key-badge">A</span> <span class="key-badge">B</span> tema</span>' : ''}
        <span><span class="key-badge">Enter</span> terminar</span>`;
    }

    renderGrading() {
      const cur = this.current;
      const rub = this.rubrica;
      $('gradingEmpty').style.display = cur ? 'none' : '';
      $('gradingBody').style.display = cur ? '' : 'none';
      this.renderScorecard();
      if (!cur) return;

      const editable = this.canEditCurrent();
      const estado = this.getEstado(cur.studentId);
      $('gName').textContent = `${cur.apellido}, ${cur.nombre}`;
      $('gMeta').innerHTML = `<span>DNI ${escapeHtml(cur.dni)}</span><span class="fecha-badge">${escapeHtml(this.inst.titulo)}</span><span class="pill-mini st-${estado}">${ESTADO_LABEL[estado]}</span>`;

      const hasTema = cur.tema === 'A' || cur.tema === 'B';
      $('temaSelector').style.display = rub.usaTema ? '' : 'none';
      $('temaPrompt').style.display = (rub.usaTema || cur.ausente) ? '' : 'none';
      document.querySelectorAll('#temaSelector .tema-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tema') === cur.tema);
        b.disabled = !editable || cur.ausente;
      });
      $('temaSelector').classList.toggle('unselected', !hasTema && !cur.ausente);
      const prompt = $('temaPrompt');
      prompt.className = `tema-prompt-label ${hasTema || !rub.usaTema ? 'selected' : 'pending'}`;
      prompt.textContent = cur.ausente ? 'Ausente' : (hasTema ? `✔ Tema ${cur.tema}` : '⚠️ Elegí Tema');
      $('btnAusente').classList.toggle('active', cur.ausente);
      $('btnAusente').textContent = cur.ausente ? '🚫 Ausente (quitar)' : 'Ausente';
      $('btnAusente').disabled = !editable;
      $('btnAusente').style.display = this.profile.isAdmin ? '' : 'none';
      $('btnFinish').disabled = !editable;

      const lock = $('lockNotice');
      if (this.isStudentPublished(cur.studentId, cur.fecha)) {
        lock.style.display = '';
        lock.textContent = editable
          ? '📤 La nota de este estudiante ya está publicada. Si cambiás algo, volvé a publicar desde la pestaña Publicación para que la familia lo vea.'
          : '🔒 Dirección ya publicó la nota de este estudiante: su corrección quedó cerrada. Para cambios, consultá con Dirección.';
      } else {
        lock.style.display = 'none';
      }

      const wrap = $('itemsWrap');
      $('obsInput').disabled = !editable;
      if (cur.ausente) {
        wrap.innerHTML = this.profile.isAdmin
          ? '<div class="empty-state">Estudiante marcado como <strong>ausente</strong>. Tocá “Ausente (quitar)” si rindió el examen.</div>'
          : '<div class="empty-state">Este estudiante figura como <strong>ausente</strong> en la toma de lista. Si tenés su examen, avisale a Dirección para que corrija el presentismo.</div>';
        $('obsInput').value = cur.observaciones;
        return;
      }

      const sc = this.scores(cur.niveles);
      const compact = rub.tipo === 'mat';
      let html = '';
      if (compact) {
        html += `<div class="criterios-legend">${CFG.matematica.calificaciones.map(c => `<b>${c.label}</b> ${escapeHtml(c.nombre)} (${Math.round(c.factor * 100)} %): ${escapeHtml(c.desc)}`).join('<br>')}</div>`;
        if (!this.clave) html += '<div class="muted-note">Las respuestas esperadas todavía no están cargadas: Dirección las sube desde Publicación.</div>';
      }
      rub.secciones.forEach(sec => {
        html += `<div class="sec-header"><span>${rub.secciones.length > 1 ? `Sección ${sec.id} • ` : ''}${escapeHtml(sec.titulo)}</span><span>${fmt(sc.secs[sec.id])} / ${fmt(sec.max)}</span></div>`;
        rub.items.forEach((it, idx) => {
          if (it.seccion !== sec.id) return;
          const key = cur.niveles[it.id];
          const val = sc.puntajes[it.id];
          const clave = this.claveDe(it.id);
          const guia = it.guia && hasTema ? it.guia[cur.tema] : null;
          let guiaHtml = '';
          if (clave) {
            guiaHtml = `<div class="item-guia"><strong>Respuesta esperada:</strong> ${escapeHtml(clave.respuesta)}${clave.desarrollo ? ` <span class="guia-dev">· ${escapeHtml(clave.desarrollo)}</span>` : ''}</div>`;
          } else if (guia) {
            guiaHtml = `<div class="item-guia"><strong>Orientación Tema ${cur.tema}:</strong> ${escapeHtml(guia)}</div>`;
          }
          const base = it.tema ? `${it.criterio} · ${it.tema}` : it.criterio;
          const criterio = clave && clave.consigna ? `${base} — ${clave.consigna}` : base;
          html += `
            <div class="item-row ${idx === this.focusedIdx ? 'focused' : ''} ${key ? 'done' : ''}" data-idx="${idx}">
              <div class="item-head">
                <span class="item-id">${escapeHtml(it.id)}</span>
                <span class="item-criterio">${escapeHtml(criterio)}</span>
                <span class="item-pts">${typeof val === 'number' ? fmtPts(val) : '–'} / ${fmtPts(it.max)}</span>
              </div>
              ${guiaHtml}
              <div class="levels ${compact ? 'compact' : ''}">
                ${it.niveles.map((lv, li) => {
                  const shortcut = (!compact && lv.pts === 0) ? '0' : li + 1;
                  return `
                  <button type="button" class="level-btn ${key === lv.key ? 'selected' : ''} ${lv.pts === 0 ? 'zero' : ''}" data-idx="${idx}" data-key="${escapeHtml(lv.key)}" ${editable ? '' : 'disabled'} title="${escapeHtml(lv.desc)}">
                    <span class="level-top">${escapeHtml(lv.label)} <span class="level-key">${shortcut}</span></span>
                    <span class="level-desc">${compact ? `${escapeHtml(lv.nombre)} · ${fmtPts(lv.pts)}` : escapeHtml(lv.desc)}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>`;
        });
      });
      wrap.innerHTML = html;
      wrap.querySelectorAll('.item-row').forEach(row => {
        row.addEventListener('click', () => {
          this.focusedIdx = Number(row.getAttribute('data-idx'));
          this.highlightFocused();
        });
      });
      wrap.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          this.setLevel(Number(btn.getAttribute('data-idx')), btn.getAttribute('data-key'));
        });
      });
      if (document.activeElement !== $('obsInput')) $('obsInput').value = cur.observaciones;
      this.highlightFocused(false);
    }

    highlightFocused(scroll = true) {
      document.querySelectorAll('#itemsWrap .item-row').forEach(row => {
        row.classList.toggle('focused', Number(row.getAttribute('data-idx')) === this.focusedIdx);
      });
      const el = document.querySelector(`#itemsWrap .item-row[data-idx="${this.focusedIdx}"]`);
      if (el && scroll) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    renderScorecard() {
      const cur = this.current;
      const rub = this.rubrica;
      const sc = this.scores(cur ? cur.niveles : {});
      const estado = cur ? this.getEstado(cur.studentId) : null;
      const showNota = cur && !cur.ausente;
      $('scProgress').textContent = `${sc.completos} / ${rub.items.length} ítems`;
      $('scTotal').textContent = showNota ? fmt(sc.nota) : '-';
      $('scMaxLabel').textContent = 'de 10,00 puntos';
      const badge = $('scEstado');
      if (!cur) {
        badge.className = 'score-badge badge-tema-pending';
        badge.textContent = 'SIN SELECCIÓN';
      } else if (cur.ausente) {
        badge.className = 'score-badge badge-failed';
        badge.textContent = 'AUSENTE';
      } else if (estado === 'corregido' && sc.completo) {
        badge.className = 'score-badge badge-passed';
        badge.textContent = 'CORRECCIÓN TERMINADA';
      } else {
        badge.className = 'score-badge badge-tema-pending';
        badge.textContent = sc.completo ? 'LISTA PARA TERMINAR' : 'EN CORRECCIÓN';
      }
      if (rub.porCalificacion) {
        // Matemática: suma exacta de puntajes (la nota se muestra con 2 decimales y entra al orden de mérito)
        $('scSections').innerHTML = `
          <div class="subject-item"><div class="subject-name">Suma exacta de puntajes</div><div class="subject-score">${showNota ? fmtPts(sc.suma) : '-'} / ${fmt(rub.secciones[0].max)}</div></div>`;
      } else {
        $('scSections').innerHTML = rub.secciones.map(s => `
          <div class="subject-item">
            <div class="subject-name">${s.id}. ${escapeHtml(s.titulo)}</div>
            <div class="subject-score">${showNota ? fmt(sc.secs[s.id]) : '-'} / ${fmt(s.max)}</div>
          </div>`).join('');
      }

      const g = cur ? this.getGrade(cur.studentId) : null;
      $('correctorInfo').innerHTML = g
        ? `<strong style="color: var(--text-main);">Última edición:</strong> ${escapeHtml(g.correctorNombre || '-')}<br>${g.actualizadoEn ? new Date(g.actualizadoEn).toLocaleString('es-AR') : ''}`
        : 'Todavía sin corregir.';
    }

    bindKeyboard() {
      window.addEventListener('keydown', e => {
        if (this.tab !== 'correccion' || !this.current || !this.profile) return;
        const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          if (e.key === 'Escape') document.activeElement.blur();
          return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const key = e.key.toUpperCase();
        const items = this.rubrica.items;

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.focusedIdx = Math.max(0, Math.min(items.length - 1, this.focusedIdx + (e.key === 'ArrowDown' ? 1 : -1)));
          this.highlightFocused();
          return;
        }
        if (this.rubrica.usaTema && (key === 'A' || key === 'B')) {
          e.preventDefault();
          this.setTema(key);
          return;
        }
        if (/^[0-9]$/.test(e.key)) {
          // 1 = nivel más alto, 2 = siguiente...; 0 = último nivel (0 pts / NR)
          const niveles = items[this.focusedIdx].niveles;
          const n = Number(e.key);
          const lv = n === 0 ? niveles[niveles.length - 1] : niveles[n - 1];
          if (lv) {
            e.preventDefault();
            this.setLevel(this.focusedIdx, lv.key, false);
          }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.finish();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          this.navigate(e.key === 'ArrowRight' ? 1 : -1);
        }
      });
    }

    openCorreccion(studentId) {
      $('fEstado').value = 'all';
      $('fBuscar').value = '';
      this.switchTab('correccion');
      this.selectStudent(studentId);
    }

    // --- RESULTADOS ---

    // Columnas propias de cada rúbrica: PdL por sección y tema; Matemática la nota
    resultColumns() {
      const rub = this.rubrica;
      if (rub.porCalificacion) {
        return [
          { th: 'Nota (/10)', td: g => `<strong>${fmt(g.nota)}</strong>` }
        ];
      }
      return [
        { th: 'Tema', td: g => g.tema || '-' },
        ...rub.secciones.map(s => ({ th: `${s.id} (/${fmt(s.max, 0)})`, td: g => fmt(g[`nota${s.id}`]) })),
        { th: 'Nota (/10)', td: g => `<strong>${fmt(g.nota)}</strong>` }
      ];
    }

    renderResultados() {
      $('resTitle').textContent = `📋 Resultados • ${this.inst.titulo}`;
      $('resSubtitle').textContent = this.rubrica.porCalificacion
        ? 'Nota por estudiante (con 2 decimales) y estado de corrección. El ingreso se define por el promedio de PdL y Matemática (Orden de mérito).'
        : 'Nota por estudiante, por sección y estado de corrección';
      const cols = this.resultColumns();
      const nCols = 7 + cols.length;
      $('resHead').innerHTML = `
        <tr>
          <th class="num" style="width: 45px;">#</th>
          <th>Estudiante</th>
          <th>DNI</th>
          <th class="num">Presentismo</th>
          <th class="num">Estado</th>
          ${cols.map(c => `<th class="num">${c.th}</th>`).join('')}
          <th>Corrector/a</th>
          <th></th>
        </tr>`;
      const body = $('resBody');
      if (this.roster.length === 0) {
        body.innerHTML = `<tr><td colspan="${nCols}">${this.noRosterHtml()}</td></tr>`;
        return;
      }
      const q = $('resBuscar').value;
      const filtro = $('resFiltro').value;
      const rows = this.getRoster().filter(st => {
        const e = this.getEstado(st.id);
        if (filtro === 'por_corregir' && !(e === 'pendiente' || e === 'en_progreso')) return false;
        if (filtro !== 'all' && filtro !== 'por_corregir' && e !== filtro) return false;
        return matchesSearch(st, q);
      });
      body.innerHTML = rows.length === 0
        ? `<tr><td colspan="${nCols}" class="empty-state">No hay estudiantes con esos filtros.</td></tr>`
        : rows.map((st, i) => {
          const g = this.getGrade(st.id);
          const e = this.getEstado(st.id);
          const p = this.getPresencia(st.id);
          const show = g && e !== 'ausente' && g.itemsCompletos > 0;
          return `
            <tr>
              <td class="num" style="color: var(--text-muted);">${i + 1}</td>
              <td><strong>${escapeHtml(st.apellido)}, ${escapeHtml(st.nombre)}</strong></td>
              <td>${escapeHtml(st.dni)}</td>
              <td class="num"><span class="pill-mini st-${p}">${PRESENCIA_LABEL[p]}</span></td>
              <td class="num"><span class="pill-mini st-${e}">${ESTADO_LABEL[e]}</span></td>
              ${cols.map(c => `<td class="num">${show ? c.td(g) : '-'}</td>`).join('')}
              <td style="font-size: 0.8rem; color: var(--text-muted);">${g ? escapeHtml(g.correctorNombre || '') : ''}</td>
              <td><button type="button" class="link-btn" data-open="${escapeHtml(st.id)}">Abrir ✏️</button></td>
            </tr>`;
        }).join('');
      body.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => this.openCorreccion(b.getAttribute('data-open'))));
    }

    exportXlsx() {
      if (typeof XLSX === 'undefined') {
        this.toast('No se pudo cargar el generador de Excel. Revisá la conexión y recargá.', 'danger');
        return;
      }
      const rub = this.rubrica;
      const strip = s => s.replace(/^\S+\s/, '');
      // Matemática: calificación (B, B⁻, R, M, NR) y puntaje de cada ejercicio; PdL: puntaje de cada ítem
      const itemCols = rub.porCalificacion ? rub.items.flatMap(i => [`${i.id} calif.`, `${i.id} pts`]) : rub.items.map(i => i.id);
      const totals = rub.porCalificacion ? ['Suma exacta', 'Nota final'] : [...rub.secciones.map(s => `Sección ${s.id}`), 'Nota final'];
      const header = ['Apellido', 'Nombre', 'DNI', 'Presentismo', 'Estado', ...(rub.usaTema ? ['Tema'] : []), ...itemCols, ...totals, 'Corrector/a', 'Observaciones'];
      const rows = this.getRoster().map(st => {
        const g = this.getGrade(st.id) || {};
        const e = this.getEstado(st.id);
        const show = e !== 'ausente' && g.itemsCompletos > 0;
        const niveles = Core.nivelesDeGrade(rub, g);
        const sc = Core.computeScores(rub, niveles);
        const itemVals = rub.porCalificacion
          ? rub.items.flatMap(i => {
            const lv = i.niveles.find(l => l.key === niveles[i.id]);
            return [lv ? lv.label : '', lv ? lv.pts : ''];
          })
          : rub.items.map(i => (typeof sc.puntajes[i.id] === 'number' ? sc.puntajes[i.id] : ''));
        const totalVals = !show
          ? totals.map(() => '')
          : (rub.porCalificacion
            ? [sc.suma, sc.nota]
            : [...rub.secciones.map(s => sc.secs[s.id]), sc.nota]);
        return [st.apellido, st.nombre, st.dni, strip(PRESENCIA_LABEL[this.getPresencia(st.id)]), strip(ESTADO_LABEL[e]),
          ...(rub.usaTema ? [g.tema || ''] : []), ...itemVals, ...totalVals, g.correctorNombre || '', g.observaciones || ''];
      });
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws['!cols'] = header.map((h, i) => ({ wch: i < 2 ? 22 : (h === 'Observaciones' ? 40 : (h === 'Corrector/a' ? 22 : Math.max(6, h.length + 1))) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, this.inst.titulo.replace('/', '-'));
      XLSX.writeFile(wb, `Resultados_${this.inst.titulo.replace(/[\s/]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // --- ESTADÍSTICAS DE LA INSTANCIA ---

    renderStats() {
      const rub = this.rubrica;
      const roster = this.getRoster();
      const presencias = { presente: 0, ausente: 0, sin_registrar: 0 };
      roster.forEach(st => { presencias[this.getPresencia(st.id)]++; });
      $('statsTitle').textContent = `📊 Estadísticas • ${this.inst.titulo}`;
      $('statsSubtitle').textContent = 'Las notas solo cuentan exámenes con corrección terminada';
      $('statsSectionsCard').style.display = rub.secciones.length > 1 ? '' : 'none';
      $('statsCalifCard').style.display = rub.porCalificacion ? '' : 'none';
      $('statsHistoSub').textContent = 'Cantidad de estudiantes por tramo de nota (sobre 10)';

      const pctPres = roster.length ? `${Math.round(presencias.presente / roster.length * 100)}%` : '-';
      const done = roster.map(s => this.getGrade(s.id)).filter(g => g && !g.ausente && g.estado === 'corregido');
      const ausentes = roster.filter(s => this.getEstado(s.id) === 'ausente').length;
      const sinTerminar = roster.length - done.length - ausentes;
      const notas = done.map(g => g.nota).sort((a, b) => a - b);
      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const promedio = avg(notas);
      const mediana = notas.length ? (notas.length % 2 ? notas[(notas.length - 1) / 2] : (notas[notas.length / 2 - 1] + notas[notas.length / 2]) / 2) : null;

      $('statsKpis').innerHTML =
        this.kpi('🙋', `${presencias.presente} / ${roster.length}`, `Presentes (${pctPres})`, '#34d399') +
        this.kpi('📋', `${done.length} / ${roster.length - ausentes}`, 'Corregidos (presentes)') +
        this.kpi('⏳', sinTerminar, 'Sin terminar', sinTerminar > 0 ? '#fbbf24' : null) +
        this.kpi('🎯', fmt(promedio), 'Promedio (/10)') +
        this.kpi('📍', fmt(mediana), 'Mediana (/10)') +
        this.kpi('📈', notas.length ? `${fmt(notas[notas.length - 1])} / ${fmt(notas[0])}` : '-', 'Nota más alta / más baja');

      if (done.length === 0) {
        const empty = '<div class="empty-state">Todavía no hay correcciones terminadas para mostrar.</div>';
        $('statsHisto').innerHTML = empty;
        $('statsSections').innerHTML = '';
        $('statsTemas').innerHTML = '';
        $('statsItems').innerHTML = empty;
        $('statsCalif').innerHTML = '';
        $('statsCorrectores').innerHTML = '';
        return;
      }

      // Histograma en tramos de 1 punto (el último incluye el 10)
      const bins = Array.from({ length: 10 }, () => 0);
      notas.forEach(n => { bins[Math.min(9, Math.floor(n))]++; });
      const binLabel = i => `${i}–${i + 1}`;
      const binTitle = i => `${i} a ${i === 9 ? '10' : `menos de ${i + 1}`}`;
      const maxBin = Math.max(...bins, 1);
      $('statsHisto').innerHTML = `
        <div class="histo">${bins.map((c, i) => `
          <div class="histo-col" title="${binTitle(i)}: ${c} estudiante(s)">
            <span class="histo-count">${c || ''}</span>
            <div class="histo-bar" style="height: ${(c / maxBin) * 100}%;"></div>
          </div>`).join('')}
        </div>
        <div class="histo-labels">${bins.map((_, i) => `<span>${binLabel(i)}</span>`).join('')}</div>`;

      const hbar = (label, pct, valueText, title) => `
        <div class="hbar-row" title="${escapeHtml(title || label)}">
          <span class="hbar-label">${escapeHtml(label)}</span>
          <div class="hbar-track"><div class="hbar-fill" style="width: ${Math.max(0, Math.min(100, pct))}%;"></div></div>
          <span class="hbar-val">${valueText}</span>
        </div>`;

      if (rub.secciones.length > 1) {
        $('statsSections').innerHTML = rub.secciones.map(s => {
          const prom = avg(done.map(g => g[`nota${s.id}`] || 0));
          const pct = prom / s.max * 100;
          return hbar(`${s.id}. ${s.titulo}`, pct, `${Math.round(pct)}%`, `Sección ${s.id}: promedio ${fmt(prom)} de ${fmt(s.max)}`);
        }).join('') + '<div class="muted-note">Valor: promedio de la sección sobre su máximo.</div>';
      }

      if (rub.usaTema) {
        const temaRows = ['A', 'B'].map(t => {
          const del = done.filter(g => g.tema === t);
          return `<tr><td>Tema ${t}</td><td class="num">${del.length}</td><td class="num">${fmt(avg(del.map(g => g.nota)))}</td></tr>`;
        }).join('');
        $('statsTemas').innerHTML = `
          <div class="table-responsive"><table class="custom-table">
            <thead><tr><th>Tema</th><th class="num">Corregidos</th><th class="num">Promedio</th></tr></thead>
            <tbody>${temaRows}</tbody>
          </table></div>`;
      } else {
        $('statsTemas').innerHTML = '';
      }

      const nivelesDone = done.map(g => Core.nivelesDeGrade(rub, g));
      $('statsItems').innerHTML = rub.items.map(it => {
        const vals = nivelesDone.map(n => {
          const lv = it.niveles.find(l => l.key === n[it.id]);
          return lv ? lv.pts : 0;
        });
        const prom = avg(vals);
        const pct = prom / it.max * 100;
        const enCero = vals.filter(v => v === 0).length;
        const clave = this.claveDe(it.id);
        const label = `${it.id} · ${it.tema || (clave && clave.consigna) || it.criterio}`;
        return hbar(label, pct, `${Math.round(pct)}%`,
          `${label}: promedio ${fmt(prom)} de ${fmtPts(it.max)} • ${enCero} con 0 pts`);
      }).join('');

      // Matemática: cuántos obtuvieron cada calificación en cada ejercicio
      if (rub.porCalificacion) {
        const califs = CFG.matematica.calificaciones;
        $('statsCalif').innerHTML = `
          <table class="custom-table">
            <thead><tr><th>Ejercicio</th>${califs.map(c => `<th class="num" title="${escapeHtml(c.nombre)}">${escapeHtml(c.label)}</th>`).join('')}<th class="num">% logrado</th></tr></thead>
            <tbody>${rub.items.map(it => {
              const counts = califs.map(c => nivelesDone.filter(n => n[it.id] === c.id).length);
              const prom = avg(nivelesDone.map(n => (it.niveles.find(l => l.key === n[it.id]) || { pts: 0 }).pts));
              const clave = this.claveDe(it.id);
              return `<tr><td><strong>${escapeHtml(it.id)}</strong> <span style="color: var(--text-muted);">${it.tema ? `${escapeHtml(it.tema)} · ` : ''}${fmtPts(it.max)} pts</span></td>${counts.map(c => `<td class="num">${c}</td>`).join('')}<td class="num">${Math.round(prom / it.max * 100)}%</td></tr>`;
            }).join('')}
            </tbody>
          </table>`;
      }

      // Por corrector: cantidad y promedio (sirve para ver si hay criterios muy distintos)
      const byCorr = {};
      done.forEach(g => {
        const k = g.correctorNombre || '-';
        if (!byCorr[k]) byCorr[k] = [];
        byCorr[k].push(g.nota);
      });
      $('statsCorrectores').innerHTML = `
        <table class="custom-table">
          <thead><tr><th>Corrector/a</th><th class="num">Exámenes corregidos</th><th class="num">Promedio de notas</th></tr></thead>
          <tbody>${Object.entries(byCorr).map(([name, arr]) => `
            <tr><td>${escapeHtml(name)}</td><td class="num">${arr.length}</td><td class="num">${fmt(avg(arr))}</td></tr>`).join('')}
          </tbody>
        </table>`;
    }

    // --- PUBLICACIÓN (DIRECCIÓN) ---

    // Estado de la publicación de una fecha: Dirección libera de a partes las notas ya corregidas
    getFechaSummary(fecha = this.fecha) {
      const roster = Core.rosterFor(this.roster, fecha);
      const grades = this.gradesFor(fecha);
      const pub = this.publicadas[fecha];
      const counts = { corregido: 0, ausente: 0, en_progreso: 0, pendiente: 0 };
      const faltan = [];
      const resueltos = [];   // corregidos o ausentes: se pueden publicar
      const nuevos = [];      // resueltos que todavía no se publicaron
      const cambiados = [];   // publicados que Dirección modificó después de publicar
      let publicados = 0;
      roster.forEach(st => {
        const g = grades.get(st.id);
        const e = Core.estadoGrade(g, this.getAsistencia(st.id, fecha));
        counts[e]++;
        const publicado = this.isStudentPublished(st.id, fecha);
        if (publicado) publicados++;
        if (e === 'pendiente' || e === 'en_progreso') {
          faltan.push(st);
          return;
        }
        resueltos.push(st);
        if (!publicado) nuevos.push(st);
        else if (pub && g && g.actualizadoEn && g.actualizadoEn > pub.en) cambiados.push(st);
      });
      return { roster, counts, faltan, resueltos, nuevos, cambiados, publicados, listo: roster.length > 0 && faltan.length === 0 };
    }

    renderPublicacion() {
      const fecha = this.fecha;
      $('pubTitle').textContent = `📤 Publicación • ${this.inst.titulo}`;
      $('rosterInfo').innerHTML = this.rosterMeta
        ? `📋 Padrón de la 2da instancia: <strong style="color: var(--text-main);">${this.roster.length} estudiantes</strong>, enviado por ${escapeHtml(this.rosterMeta.actualizadoPor || '-')} el ${new Date(this.rosterMeta.actualizadoEn).toLocaleString('es-AR')}. Si cambia la condición de algún estudiante, volvé a enviarlo desde <a href="index.html" style="color: #93c5fd;">Actas y Exportación</a> (las correcciones hechas se conservan).`
        : '📋 Todavía no hay padrón. Envialo desde <a href="index.html" style="color: #93c5fd;">Sistema del personal → Actas y Exportación → 📖 Enviar padrón de la 2da instancia</a>.';

      const s = this.getFechaSummary(fecha);
      const pub = this.publicadas[fecha];
      const presentes = s.roster.length - s.counts.ausente;
      const pct = presentes > 0 ? Math.round(s.counts.corregido / presentes * 100) : 0;
      const porPublicar = s.nuevos.length + s.cambiados.length;
      const partes = [];
      if (s.nuevos.length) partes.push(`${s.nuevos.length} corregido(s) sin publicar`);
      if (s.cambiados.length) partes.push(`${s.cambiados.length} con cambios después de publicar`);
      const status = `<div class="pub-status ${pub ? 'ok' : 'wait'}">${pub
        ? `✅ Publicadas ${s.publicados} de ${s.roster.length} notas (última vez el ${new Date(pub.en).toLocaleString('es-AR')} por ${escapeHtml(pub.por)}). Esas familias ya las ven y los profesores no pueden modificarlas.`
        : '⏳ Todavía no se publicó ninguna nota de esta fecha: las familias ven "Aún sin corregir".'}
        ${porPublicar ? `<br>🟢 Listas para publicar: ${partes.join(' y ')}.` : (s.resueltos.length ? '<br>No hay notas nuevas para publicar.' : '')}
        ${s.faltan.length ? `<br>Quedan ${s.faltan.length} por corregir: siguen como "Aún sin corregir" hasta que las publiques.` : ''}</div>`;
      const actions = `<button class="btn btn-primary" data-act="publicar" ${porPublicar ? '' : 'disabled'}>📤 Publicar notas corregidas de ${escapeHtml(this.inst.titulo)}${porPublicar ? ` (${porPublicar})` : ''}</button>
        ${pub ? '<button class="btn btn-danger" data-act="retirar">🚫 Retirar todas las notas de esta fecha</button>' : ''}`;
      const pendientes = s.faltan.length
        ? `<div class="pending-list"><strong style="color: var(--text-main);">Por corregir:</strong>${s.faltan.map(st =>
            `<a data-open="${escapeHtml(st.id)}">• ${escapeHtml(st.apellido)}, ${escapeHtml(st.nombre)} — ${ESTADO_LABEL[this.getEstado(st.id)]}</a>`).join('')}</div>`
        : '';
      $('pubCard').innerHTML = `
        <div class="chart-card pub-card">
          <div class="chart-card-header">
            <h2 class="chart-card-title">${this.inst.icono} ${escapeHtml(this.inst.titulo)} • ${escapeHtml(this.inst.fechaTexto)}</h2>
          </div>
          <div class="progress-widget">
            <div class="progress-header"><span>Corregidos: <strong>${pct}%</strong></span><span>${s.counts.corregido} de ${presentes} presentes</span></div>
            <div class="progress-bar-track"><div class="progress-bar-fill ${s.listo ? 'success' : ''}" style="width: ${pct}%;"></div></div>
          </div>
          <div class="pub-stats">
            <div class="pub-stat"><div class="v">${s.roster.length}</div><div class="l">Padrón</div></div>
            <div class="pub-stat"><div class="v" style="color: #34d399;">${s.publicados}</div><div class="l">Publicadas</div></div>
            <div class="pub-stat"><div class="v" style="color: #fbbf24;">${s.faltan.length}</div><div class="l">Por corregir</div></div>
          </div>
          ${status}
          <div class="pub-actions">${actions}</div>
          ${pendientes}
        </div>`;

      $('pubCard').querySelectorAll('button[data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.getAttribute('data-act') === 'publicar') this.publish(fecha);
          else this.unpublish(fecha);
        });
      });
      $('pubCard').querySelectorAll('a[data-open]').forEach(a => {
        a.addEventListener('click', () => this.openCorreccion(a.getAttribute('data-open')));
      });

      // Respuestas esperadas de Matemática
      const isMat = this.inst.tipo === 'mat';
      $('claveCard').style.display = isMat ? '' : 'none';
      if (isMat) {
        const n = this.clave && this.clave.items ? Object.keys(this.clave.items).length : 0;
        $('claveStatus').className = `pub-status ${n ? 'ok' : 'wait'}`;
        $('claveStatus').innerHTML = n
          ? `✅ Cargadas ${n} respuestas por ${escapeHtml(this.clave.cargadoPor || '-')} el ${new Date(this.clave.cargadoEn).toLocaleString('es-AR')}. Los profesores las ven debajo de cada ejercicio.`
          : '⏳ Todavía no se cargaron. Elegí el archivo <strong>Examen 23-10/respuestas_matematica.json</strong> de la PC de Dirección.';
      }
    }

    async uploadClave(e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file || !this.profile.isAdmin) return;
      try {
        const data = JSON.parse(await file.text());
        const ids = this.rubrica.items.map(it => it.id);
        const items = {};
        ids.forEach(id => {
          const it = data.items && data.items[id];
          if (it && it.respuesta) {
            items[id] = { consigna: String(it.consigna || ''), respuesta: String(it.respuesta), desarrollo: String(it.desarrollo || '') };
          }
        });
        const faltan = ids.filter(id => !items[id]);
        if (Object.keys(items).length === 0) throw new Error('El archivo no tiene respuestas para los ejercicios de este examen.');
        if (faltan.length && !confirm(`El archivo no tiene respuesta para: ${faltan.join(', ')}.\n¿Cargar igual las demás?`)) return;
        await db.collection('mat_config').doc('clave').set({ items, cargadoPor: this.profile.name, cargadoEn: new Date().toISOString() });
        this.toast(`🔑 Respuestas esperadas cargadas (${Object.keys(items).length} ejercicios)`, 'success');
      } catch (err) {
        console.error('Error cargando respuestas:', err);
        this.toast(`No se pudieron cargar las respuestas: ${err.message}`, 'danger');
      }
    }

    // Lo que ven el estudiante y su familia: nota y, por cada punto, el tema evaluado y cómo le fue.
    // No se publican consignas, respuestas, observaciones ni quién corrigió.
    buildPublicResult(st, fecha, publicadoEn) {
      const inst = Core.getInstancia(fecha);
      const rub = Core.getRubrica(inst.tipo);
      const g = this.gradesFor(fecha).get(st.id);
      const base = { fecha, fechaTexto: inst.fechaTexto, publicadoEn };
      if (!g || g.ausente) return { ...base, estado: 'ausente' };
      const niveles = Core.nivelesDeGrade(rub, g);
      const sc = Core.computeScores(rub, niveles);
      if (rub.porCalificacion) {
        return {
          ...base,
          estado: 'evaluado',
          nota: sc.nota,
          items: rub.items.map(it => {
            const lv = it.niveles.find(l => l.key === niveles[it.id]);
            return { id: it.id, tema: it.tema, calificacion: lv ? lv.label : '-', nombre: lv ? lv.nombre : '', puntaje: lv ? lv.pts : 0, max: it.max };
          })
        };
      }
      return {
        ...base,
        estado: 'evaluado',
        tema: g.tema,
        nota: sc.nota,
        secciones: rub.secciones.map(s => ({ id: s.id, titulo: s.titulo, nota: sc.secs[s.id], max: s.max })),
        items: rub.items.map(it => ({ id: it.id, seccion: it.seccion, criterio: it.criterio, puntaje: sc.puntajes[it.id], max: it.max }))
      };
    }

    // Publica las notas ya corregidas (y los ausentes) de la fecha; las que faltan siguen "Aún sin corregir"
    async publish(fecha) {
      await this.saveNow();
      const s = this.getFechaSummary(fecha);
      const inst = Core.getInstancia(fecha);
      const campo = Core.getRubrica(inst.tipo).campoPublico;
      const aPublicar = [...s.nuevos, ...s.cambiados];
      if (aPublicar.length === 0) {
        this.toast(`No hay notas nuevas corregidas de ${inst.titulo} para publicar.`, 'warning');
        return;
      }
      const detalle = [s.nuevos.length ? `${s.nuevos.length} nueva(s)` : '', s.cambiados.length ? `${s.cambiados.length} con cambios` : ''].filter(Boolean).join(' y ');
      if (!confirm(`¿Publicar ${aPublicar.length} nota(s) de ${inst.titulo} (${detalle})?\n\nEsas familias verán con el DNI la nota y cómo le fue en cada tema evaluado. No se publican consignas, observaciones ni quién corrigió.${s.faltan.length ? `\nLas ${s.faltan.length} que faltan corregir siguen como "Aún sin corregir".` : ''}\nLos estudiantes publicados quedan cerrados para los profesores.`)) return;
      try {
        const en = new Date().toISOString();
        const docs = aPublicar.map(st => ({ dni: st.dni, apellido: st.apellido, nombre: st.nombre, [campo]: this.buildPublicResult(st, fecha, en) }));
        for (let i = 0; i < docs.length; i += 400) {
          const batch = db.batch();
          docs.slice(i, i + 400).forEach(d => {
            // merge: conserva los resultados de los otros exámenes ya publicados en el mismo documento
            batch.set(db.collection('student_results').doc(d.dni), d, { merge: true });
          });
          await batch.commit();
        }
        const prev = this.publicadas[fecha];
        const alumnos = [...new Set([...((prev && Array.isArray(prev.alumnos)) ? prev.alumnos : []), ...aPublicar.map(st => st.id)])];
        await db.collection('pdl_config').doc('publicacion').set({
          publicadas: { [fecha]: { en, por: this.profile.name, cantidad: alumnos.length, alumnos } }
        }, { merge: true });
        this.toast(`📤 ${docs.length} nota(s) de ${inst.titulo} publicadas (${alumnos.length} en total)`, 'success');
      } catch (err) {
        console.error('Error publicando notas:', err);
        this.toast(`Error al publicar: ${err.message}`, 'danger');
      }
    }

    async unpublish(fecha) {
      const inst = Core.getInstancia(fecha);
      const campo = Core.getRubrica(inst.tipo).campoPublico;
      if (!confirm(`¿Retirar todas las notas publicadas de ${inst.titulo}?\n\nLas familias vuelven a ver "Aún sin corregir" y los profesores pueden volver a modificar esas correcciones.`)) return;
      try {
        const roster = Core.rosterFor(this.roster, fecha);
        for (let i = 0; i < roster.length; i += 400) {
          const batch = db.batch();
          roster.slice(i, i + 400).forEach(st => {
            batch.set(db.collection('student_results').doc(st.dni), { [campo]: firebase.firestore.FieldValue.delete() }, { merge: true });
          });
          await batch.commit();
        }
        await db.collection('pdl_config').doc('publicacion').update(
          new firebase.firestore.FieldPath('publicadas', fecha), firebase.firestore.FieldValue.delete());
        this.toast(`Publicación de ${inst.titulo} retirada`, 'success');
      } catch (err) {
        console.error('Error retirando publicación:', err);
        this.toast(`Error al retirar la publicación: ${err.message}`, 'danger');
      }
    }

    toast(message, type = 'info') {
      const container = $('toastContainer');
      const el = document.createElement('div');
      el.className = `custom-toast toast-${type} animate-slide-in`;
      el.innerHTML = `<div class="toast-body"><span>${escapeHtml(message)}</span></div>`;
      container.appendChild(el);
      setTimeout(() => {
        el.classList.add('animate-fade-out');
        setTimeout(() => el.remove(), 400);
      }, 3800);
    }
  }

  window.instApp = new InstanciasApp();
  document.addEventListener('DOMContentLoaded', () => window.instApp.init());
})();
