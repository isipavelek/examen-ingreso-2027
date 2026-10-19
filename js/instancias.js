/**
 * Instancias del Ingreso 2027: PdL 16/10, Matemática 23/10 y PdL 30/10
 * Escuela Secundaria Técnica – UTN – San Miguel
 *
 * - El inicio de sesión es único (EST/index.html). Acá entran Dirección (todas las fechas)
 *   y los profesores de PdL (solo las fechas de PdL).
 * - Presentismo por fecha: la toma de lista de los encuentros ('instance_attendance'), la misma del sistema del personal.
 * - PdL: corrección ítem por ítem con la rúbrica oficial ('pdl_grades'), resultados, estadísticas
 *   y publicación por fecha, recién cuando están todas corregidas ('student_results/{dni}.pdl').
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
  const ITEMS = CFG.items;
  const SECCIONES = CFG.secciones;
  const SAVE_DELAY_MS = 1200;

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();
  const auth = firebase.auth();

  const $ = id => document.getElementById(id);
  const escapeHtml = str => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fmt = (n, dec = 2) => (typeof n === 'number') ? n.toFixed(dec).replace('.', ',') : '-';
  const computeScores = puntajes => Core.computeScores(puntajes);
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
      this.grades = new Map();
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

    get isPdl() {
      return !!this.inst && this.inst.tipo === 'pdl';
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
      const prof = CFG.profesores.find(p => p.uid === user.uid);
      if (!dir && !prof) {
        // Preceptores y demás personal trabajan en el sistema principal
        window.location.href = 'index.html';
        return;
      }
      this.profile = dir
        ? { uid: dir.uid, name: dir.name, isAdmin: true, role: 'DIRECCIÓN' }
        : { uid: prof.uid, name: prof.name, isAdmin: false, role: 'PROFESOR/A PdL' };

      $('loadingScreen').style.display = 'none';
      $('pdlUserName').textContent = this.profile.name;
      $('pdlUserRole').textContent = this.profile.role;
      $('pdlUserAvatar').textContent = this.profile.name.charAt(0);

      const inst = this.inst;
      const allowed = inst && inst.tipo !== 'mc' && (this.profile.isAdmin || inst.tipo === 'pdl');
      this.setFecha(allowed ? this.fecha : '16-10', this.requestedTab);
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
        onSelect: id => {
          const target = Core.getInstancia(id);
          if (!target || target.tipo === 'mc') return false; // 2/10 y Resumen general: sistema del personal
          this.setFecha(id);
          return true;
        }
      });

      document.querySelectorAll('.nav-tab-btn[data-tab]').forEach(btn => {
        const tipoOk = !btn.dataset.tipo || btn.dataset.tipo === inst.tipo;
        const adminOk = !btn.dataset.admin || this.profile.isAdmin;
        btn.style.display = (tipoOk && adminOk) ? 'flex' : 'none';
      });

      const def = !this.isPdl ? 'presentismo' : (this.profile.isAdmin ? 'resultados' : 'correccion');
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

      this.unsubs.push(db.collection('pdl_grades').onSnapshot(snap => {
        const map = new Map();
        snap.forEach(doc => map.set(doc.id, doc.data()));
        this.grades = map;
        // Si otro docente cambió la corrección abierta y acá no hay cambios sin guardar, se actualiza
        if (this.selectedId && !this.dirty && map.has(this.selectedId)) {
          this.current = this.loadCurrent(this.selectedId);
        }
        this.renderAll();
      }, onError('pdl_grades')));
    }

    // --- ESTADO DE CADA ESTUDIANTE EN LA FECHA ACTIVA ---

    getRoster() {
      return Core.rosterFor(this.roster, this.fecha);
    }

    getAsistencia(studentId, fecha = this.fecha) {
      return (this.asistencia[fecha] || {})[studentId] || null;
    }

    getGrade(studentId) {
      return this.isPdl ? this.grades.get(studentId) : null;
    }

    getPresencia(studentId) {
      return Core.presencia(this.fecha, this.getGrade(studentId), this.getAsistencia(studentId));
    }

    getEstado(studentId) {
      return Core.estadoPdl(this.grades.get(studentId), this.getAsistencia(studentId));
    }

    isPublished(fecha = this.fecha) {
      return !!(fecha && this.publicadas[fecha]);
    }

    canEditFecha() {
      if (!this.profile) return false;
      if (this.profile.isAdmin) return true;
      return this.isPdl && !this.isPublished();
    }

    canEditCurrent() {
      return !!this.current && this.canEditFecha();
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

    // --- PRESENTISMO ---

    renderPresentismo() {
      const roster = this.getRoster();
      $('attTitle').textContent = `🙋 Presentismo • ${this.inst.titulo}`;
      $('attSubtitle').textContent = this.isPdl
        ? 'Lo registra Dirección. Un examen que los profesores empiezan a corregir cuenta como presente.'
        : 'Convocados: todos los estudiantes que pasan a la segunda instancia.';

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
      const q = $('attBuscar').value.trim().toLowerCase();
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

    // El presentismo lo toma solo Dirección
    async setPresencia(studentId, asistio) {
      if (!this.profile || !this.profile.isAdmin) return;
      try {
        await this.writeAsistencia(studentId, asistio);
        // En PdL, una corrección existente acompaña el presentismo marcado
        const g = this.getGrade(studentId);
        if (g && !!g.ausente === asistio) {
          if (this.selectedId === studentId) this.saveNow();
          const sc = computeScores(g.puntajes);
          const estado = !asistio ? 'ausente' : ((g.finalizada && sc.completo && (g.tema === 'A' || g.tema === 'B')) ? 'corregido' : 'en_progreso');
          const updated = {
            ...g,
            ausente: !asistio,
            estado,
            nota: asistio ? sc.nota : null,
            correctorUid: this.profile.uid,
            correctorNombre: this.profile.name,
            actualizadoEn: new Date().toISOString()
          };
          this.grades.set(studentId, updated);
          await db.collection('pdl_grades').doc(studentId).set(updated);
        }
        this.renderAll();
      } catch (err) {
        console.error('Error registrando presentismo:', err);
        this.toast(`No se pudo registrar el presentismo: ${err.message}`, 'danger');
      }
    }

    // --- CORRECCIÓN (PdL) ---

    getFilteredRoster() {
      const fEstado = $('fEstado').value;
      const q = $('fBuscar').value.trim().toLowerCase();
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
        const g = this.grades.get(st.id);
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
      const g = this.grades.get(studentId);
      const att = this.getAsistencia(studentId, st.fecha);
      return {
        studentId,
        dni: st.dni,
        apellido: st.apellido,
        nombre: st.nombre,
        fecha: st.fecha,
        tema: (g && g.tema) || null,
        ausente: g ? !!g.ausente : !!(att && att.asistio === false),
        puntajes: { ...((g && g.puntajes) || {}) },
        observaciones: (g && g.observaciones) || '',
        finalizada: !!(g && g.finalizada)
      };
    }

    selectStudent(studentId) {
      if (studentId === this.selectedId) return;
      this.saveNow();
      this.selectedId = studentId;
      this.current = this.loadCurrent(studentId);
      const firstEmpty = ITEMS.findIndex(it => typeof (this.current && this.current.puntajes[it.id]) !== 'number');
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
      if (!this.current || !this.canEditCurrent() || this.current.ausente) return;
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

    setLevel(itemIdx, pts, toggle = true) {
      if (!this.current || !this.canEditCurrent() || this.current.ausente) return;
      const it = ITEMS[itemIdx];
      if (!it) return;
      if (toggle && this.current.puntajes[it.id] === pts) {
        delete this.current.puntajes[it.id]; // segundo clic sobre el mismo nivel lo borra
      } else {
        this.current.puntajes[it.id] = pts;
        this.focusedIdx = Math.min(ITEMS.length - 1, itemIdx + 1);
      }
      this.markDirty();
      this.renderGrading();
    }

    async finish() {
      if (!this.current || !this.canEditCurrent()) return;
      if (!this.current.ausente) {
        if (this.current.tema !== 'A' && this.current.tema !== 'B') {
          this.toast('Elegí Tema A o Tema B antes de terminar.', 'warning');
          const sel = $('temaSelector');
          sel.classList.remove('shake-highlight-tema');
          void sel.offsetWidth;
          sel.classList.add('shake-highlight-tema');
          return;
        }
        const faltan = ITEMS.filter(it => typeof this.current.puntajes[it.id] !== 'number');
        if (faltan.length > 0) {
          this.toast(`Faltan ${faltan.length} ítem(s): ${faltan.map(f => f.id).join(', ')}`, 'warning');
          this.focusedIdx = ITEMS.indexOf(faltan[0]);
          this.renderGrading();
          return;
        }
      }
      this.current.finalizada = true;
      this.dirty = true;
      const ok = await this.saveNow();
      if (ok) {
        const sc = computeScores(this.current.puntajes);
        this.toast(this.current.ausente
          ? `🚫 ${this.current.apellido}: registrado como ausente`
          : `✅ ${this.current.apellido}, ${this.current.nombre}: ${fmt(sc.nota)} / 10`, 'success');
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
      const sc = computeScores(cur.puntajes);
      let estado;
      if (cur.ausente) estado = 'ausente';
      else if (cur.finalizada && sc.completo && (cur.tema === 'A' || cur.tema === 'B')) estado = 'corregido';
      else estado = 'en_progreso';

      const record = {
        studentId: cur.studentId,
        dni: cur.dni,
        apellido: cur.apellido,
        nombre: cur.nombre,
        fecha: cur.fecha,
        tema: cur.tema || null,
        ausente: cur.ausente,
        puntajes: cur.puntajes,
        observaciones: cur.observaciones || '',
        notaA: sc.secs.A,
        notaB: sc.secs.B,
        notaC: sc.secs.C,
        nota: cur.ausente ? null : sc.nota,
        itemsCompletos: sc.completos,
        finalizada: cur.finalizada,
        estado,
        correctorUid: this.profile.uid,
        correctorNombre: this.profile.name,
        actualizadoEn: new Date().toISOString()
      };
      this.dirty = false;
      this.grades.set(cur.studentId, record);
      $('saveState').textContent = '☁️ Guardando...';
      try {
        await db.collection('pdl_grades').doc(cur.studentId).set(record);
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
          ? '🔒 No se pudo guardar: las notas de esta fecha ya fueron publicadas o faltan las reglas de Firebase.'
          : `Error al guardar: ${err.message}`, 'danger');
        return false;
      }
    }

    renderGrading() {
      const cur = this.current;
      $('gradingEmpty').style.display = cur ? 'none' : '';
      $('gradingBody').style.display = cur ? '' : 'none';
      this.renderScorecard();
      if (!cur) return;

      const editable = this.canEditCurrent();
      const estado = this.getEstado(cur.studentId);
      $('gName').textContent = `${cur.apellido}, ${cur.nombre}`;
      $('gMeta').innerHTML = `<span>DNI ${escapeHtml(cur.dni)}</span><span class="fecha-badge">${escapeHtml(this.inst.titulo)}</span><span class="pill-mini st-${estado}">${ESTADO_LABEL[estado]}</span>`;

      const hasTema = cur.tema === 'A' || cur.tema === 'B';
      document.querySelectorAll('#temaSelector .tema-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tema') === cur.tema);
        b.disabled = !editable || cur.ausente;
      });
      $('temaSelector').classList.toggle('unselected', !hasTema && !cur.ausente);
      const prompt = $('temaPrompt');
      prompt.className = `tema-prompt-label ${hasTema ? 'selected' : 'pending'}`;
      prompt.textContent = cur.ausente ? 'Ausente' : (hasTema ? `✔ Tema ${cur.tema}` : '⚠️ Elegí Tema');
      $('btnAusente').classList.toggle('active', cur.ausente);
      $('btnAusente').textContent = cur.ausente ? '🚫 Ausente (quitar)' : 'Ausente';
      $('btnAusente').disabled = !editable;
      $('btnAusente').style.display = this.profile.isAdmin ? '' : 'none';
      $('btnFinish').disabled = !editable;

      const lock = $('lockNotice');
      if (this.isPublished(cur.fecha)) {
        lock.style.display = '';
        lock.textContent = editable
          ? '📤 Las notas de esta fecha ya están publicadas. Si cambiás algo, republicá desde la pestaña Publicación para que el estudiante lo vea.'
          : '🔒 Las notas de esta fecha ya fueron publicadas por Dirección: la corrección quedó cerrada. Para cambios, consultá con Dirección.';
      } else {
        lock.style.display = 'none';
      }

      const wrap = $('itemsWrap');
      $('obsInput').disabled = !editable;
      if (cur.ausente) {
        wrap.innerHTML = this.profile.isAdmin
          ? '<div class="empty-state">Estudiante marcado como <strong>ausente</strong>. Tocá “Ausente (quitar)” si rindió el examen.</div>'
          : '<div class="empty-state">Dirección registró a este estudiante como <strong>ausente</strong>. Si tenés su examen, avisale a Dirección para que corrija el presentismo.</div>';
        $('obsInput').value = cur.observaciones;
        return;
      }

      const sc = computeScores(cur.puntajes);
      let html = '';
      SECCIONES.forEach(sec => {
        html += `<div class="sec-header"><span>Sección ${sec.id} • ${escapeHtml(sec.titulo)}</span><span>${fmt(sc.secs[sec.id])} / ${fmt(sec.max)}</span></div>`;
        ITEMS.forEach((it, idx) => {
          if (it.seccion !== sec.id) return;
          const val = cur.puntajes[it.id];
          const max = it.niveles[0].pts;
          const guia = it.guia && hasTema ? it.guia[cur.tema] : null;
          html += `
            <div class="item-row ${idx === this.focusedIdx ? 'focused' : ''} ${typeof val === 'number' ? 'done' : ''}" data-idx="${idx}">
              <div class="item-head">
                <span class="item-id">${it.id}</span>
                <span class="item-criterio">${escapeHtml(it.criterio)}</span>
                <span class="item-pts">${typeof val === 'number' ? fmt(val) : '–'} / ${fmt(max)}</span>
              </div>
              ${guia ? `<div class="item-guia"><strong>Orientación Tema ${cur.tema}:</strong> ${escapeHtml(guia)}</div>` : ''}
              <div class="levels">
                ${it.niveles.map((lv, li) => `
                  <button type="button" class="level-btn ${val === lv.pts ? 'selected' : ''} ${lv.pts === 0 ? 'zero' : ''}" data-idx="${idx}" data-pts="${lv.pts}" ${editable ? '' : 'disabled'}>
                    <span class="level-top">${fmt(lv.pts)} pts <span class="level-key">${lv.pts === 0 ? '0' : li + 1}</span></span>
                    <span class="level-desc">${escapeHtml(lv.desc)}</span>
                  </button>`).join('')}
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
          this.setLevel(Number(btn.getAttribute('data-idx')), Number(btn.getAttribute('data-pts')));
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
      const sc = computeScores(cur ? cur.puntajes : {});
      const estado = cur ? this.getEstado(cur.studentId) : null;
      $('scProgress').textContent = `${sc.completos} / ${ITEMS.length} ítems`;
      $('scTotal').textContent = (cur && !cur.ausente) ? fmt(sc.nota) : '-';
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
      $('scSections').innerHTML = SECCIONES.map(s => `
        <div class="subject-item">
          <div class="subject-name">${s.id}. ${escapeHtml(s.titulo)}</div>
          <div class="subject-score">${cur && !cur.ausente ? fmt(sc.secs[s.id]) : '-'} / ${fmt(s.max)}</div>
        </div>`).join('');

      const g = cur ? this.grades.get(cur.studentId) : null;
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

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.focusedIdx = Math.max(0, Math.min(ITEMS.length - 1, this.focusedIdx + (e.key === 'ArrowDown' ? 1 : -1)));
          this.highlightFocused();
          return;
        }
        if (key === 'A' || key === 'B') {
          e.preventDefault();
          this.setTema(key);
          return;
        }
        if (/^[0-4]$/.test(e.key)) {
          e.preventDefault();
          // 1 = nivel más alto, 2 = siguiente...; 0 = último nivel (0 pts)
          const niveles = ITEMS[this.focusedIdx].niveles;
          const n = Number(e.key);
          const lv = n === 0 ? niveles[niveles.length - 1] : niveles[n - 1];
          if (lv) this.setLevel(this.focusedIdx, lv.pts, false);
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

    // --- RESULTADOS (PdL) ---

    renderResultados() {
      $('resTitle').textContent = `📋 Resultados • ${this.inst.titulo}`;
      const body = $('resBody');
      if (this.roster.length === 0) {
        body.innerHTML = `<tr><td colspan="12">${this.noRosterHtml()}</td></tr>`;
        return;
      }
      const q = $('resBuscar').value.trim().toLowerCase();
      const filtro = $('resFiltro').value;
      const rows = this.getRoster().filter(st => {
        const e = this.getEstado(st.id);
        if (filtro === 'por_corregir' && !(e === 'pendiente' || e === 'en_progreso')) return false;
        if (filtro !== 'all' && filtro !== 'por_corregir' && e !== filtro) return false;
        return matchesSearch(st, q);
      });
      body.innerHTML = rows.length === 0
        ? '<tr><td colspan="12" class="empty-state">No hay estudiantes con esos filtros.</td></tr>'
        : rows.map((st, i) => {
          const g = this.grades.get(st.id);
          const e = this.getEstado(st.id);
          const p = this.getPresencia(st.id);
          const show = g && e !== 'ausente';
          return `
            <tr>
              <td class="num" style="color: var(--text-muted);">${i + 1}</td>
              <td><strong>${escapeHtml(st.apellido)}, ${escapeHtml(st.nombre)}</strong></td>
              <td>${escapeHtml(st.dni)}</td>
              <td class="num"><span class="pill-mini st-${p}">${PRESENCIA_LABEL[p]}</span></td>
              <td class="num"><span class="pill-mini st-${e}">${ESTADO_LABEL[e]}</span></td>
              <td class="num">${show && g.tema ? g.tema : '-'}</td>
              <td class="num">${show ? fmt(g.notaA) : '-'}</td>
              <td class="num">${show ? fmt(g.notaB) : '-'}</td>
              <td class="num">${show ? fmt(g.notaC) : '-'}</td>
              <td class="num"><strong>${show ? fmt(g.nota) : '-'}</strong></td>
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
      const header = ['Apellido', 'Nombre', 'DNI', 'Presentismo', 'Estado', 'Tema', ...ITEMS.map(i => i.id), 'Sección A', 'Sección B', 'Sección C', 'Nota final', 'Corrector/a', 'Observaciones'];
      const strip = s => s.replace(/^\S+\s/, '');
      const rows = this.getRoster().map(st => {
        const g = this.grades.get(st.id) || {};
        const e = this.getEstado(st.id);
        const p = g.puntajes || {};
        const show = e !== 'ausente';
        return [st.apellido, st.nombre, st.dni, strip(PRESENCIA_LABEL[this.getPresencia(st.id)]), strip(ESTADO_LABEL[e]), g.tema || '',
          ...ITEMS.map(i => typeof p[i.id] === 'number' ? p[i.id] : ''),
          show ? (g.notaA ?? '') : '', show ? (g.notaB ?? '') : '', show ? (g.notaC ?? '') : '',
          show ? (g.nota ?? '') : '', g.correctorNombre || '', g.observaciones || ''];
      });
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 11 }, { wch: 13 }, { wch: 13 }, { wch: 6 }, ...ITEMS.map(() => ({ wch: 5 })), { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 22 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, this.inst.titulo.replace('/', '-'));
      XLSX.writeFile(wb, `Resultados_${this.inst.titulo.replace(/[\s/]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // --- ESTADÍSTICAS DE LA INSTANCIA ---

    renderStats() {
      const roster = this.getRoster();
      const presencias = { presente: 0, ausente: 0, sin_registrar: 0 };
      roster.forEach(st => { presencias[this.getPresencia(st.id)]++; });
      $('statsTitle').textContent = `📊 Estadísticas • ${this.inst.titulo}`;
      $('statsPdlBlock').style.display = this.isPdl ? '' : 'none';
      $('statsMatNote').style.display = this.isPdl ? 'none' : '';
      $('statsSubtitle').textContent = this.isPdl ? 'Las notas solo cuentan exámenes con corrección terminada' : 'Presentismo de la instancia';

      const pctPres = roster.length ? `${Math.round(presencias.presente / roster.length * 100)}%` : '-';
      if (!this.isPdl) {
        $('statsKpis').innerHTML =
          this.kpi('📋', roster.length, 'Convocados') +
          this.kpi('✔', presencias.presente, `Presentes (${pctPres})`, '#34d399') +
          this.kpi('✘', presencias.ausente, 'Ausentes', '#f87171') +
          this.kpi('—', presencias.sin_registrar, 'Sin registrar');
        return;
      }

      const done = roster.map(s => this.grades.get(s.id)).filter(g => g && !g.ausente && g.estado === 'corregido');
      const ausentes = roster.filter(s => this.getEstado(s.id) === 'ausente').length;
      const sinTerminar = roster.length - done.length - ausentes;
      const notas = done.map(g => g.nota).sort((a, b) => a - b);
      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const promedio = avg(notas);
      const mediana = notas.length ? (notas.length % 2 ? notas[(notas.length - 1) / 2] : (notas[notas.length / 2 - 1] + notas[notas.length / 2]) / 2) : null;
      const conSeis = notas.filter(n => n >= 6).length;

      $('statsKpis').innerHTML =
        this.kpi('🙋', `${presencias.presente} / ${roster.length}`, `Presentes (${pctPres})`, '#34d399') +
        this.kpi('📋', `${done.length} / ${roster.length - ausentes}`, 'Corregidos (presentes)') +
        this.kpi('⏳', sinTerminar, 'Sin terminar', sinTerminar > 0 ? '#fbbf24' : null) +
        this.kpi('🎯', fmt(promedio), 'Promedio (/10)') +
        this.kpi('📍', fmt(mediana), 'Mediana (/10)') +
        this.kpi('📈', notas.length ? `${Math.round(conSeis / notas.length * 100)}%` : '-', `Con 6 o más (${conSeis})`);

      if (done.length === 0) {
        const empty = '<div class="empty-state">Todavía no hay correcciones terminadas para mostrar.</div>';
        $('statsHisto').innerHTML = empty;
        $('statsSections').innerHTML = '';
        $('statsTemas').innerHTML = '';
        $('statsItems').innerHTML = empty;
        $('statsCorrectores').innerHTML = '';
        return;
      }

      // Histograma de notas en tramos de 1 punto (el último incluye el 10)
      const bins = Array.from({ length: 10 }, () => 0);
      notas.forEach(n => { bins[Math.min(9, Math.floor(n))]++; });
      const maxBin = Math.max(...bins, 1);
      $('statsHisto').innerHTML = `
        <div class="histo">${bins.map((c, i) => `
          <div class="histo-col" title="${i} a ${i === 9 ? '10' : `menos de ${i + 1}`}: ${c} estudiante(s)">
            <span class="histo-count">${c || ''}</span>
            <div class="histo-bar" style="height: ${(c / maxBin) * 100}%;"></div>
          </div>`).join('')}
        </div>
        <div class="histo-labels">${bins.map((_, i) => `<span>${i}–${i + 1}</span>`).join('')}</div>`;

      const hbar = (label, pct, valueText, title) => `
        <div class="hbar-row" title="${escapeHtml(title || label)}">
          <span class="hbar-label">${escapeHtml(label)}</span>
          <div class="hbar-track"><div class="hbar-fill" style="width: ${Math.max(0, Math.min(100, pct))}%;"></div></div>
          <span class="hbar-val">${valueText}</span>
        </div>`;

      $('statsSections').innerHTML = SECCIONES.map(s => {
        const prom = avg(done.map(g => g[`nota${s.id}`] || 0));
        const pct = prom / s.max * 100;
        return hbar(`${s.id}. ${s.titulo}`, pct, `${Math.round(pct)}%`, `Sección ${s.id}: promedio ${fmt(prom)} de ${fmt(s.max)}`);
      }).join('') + '<div class="muted-note">Valor: promedio de la sección sobre su máximo (A y B: 3 pts, C: 4 pts).</div>';

      const temaRows = ['A', 'B'].map(t => {
        const del = done.filter(g => g.tema === t);
        return `<tr><td>Tema ${t}</td><td class="num">${del.length}</td><td class="num">${fmt(avg(del.map(g => g.nota)))}</td></tr>`;
      }).join('');
      $('statsTemas').innerHTML = `
        <div class="table-responsive"><table class="custom-table">
          <thead><tr><th>Tema</th><th class="num">Corregidos</th><th class="num">Promedio</th></tr></thead>
          <tbody>${temaRows}</tbody>
        </table></div>`;

      $('statsItems').innerHTML = ITEMS.map(it => {
        const max = it.niveles[0].pts;
        const vals = done.map(g => (g.puntajes && typeof g.puntajes[it.id] === 'number') ? g.puntajes[it.id] : 0);
        const prom = avg(vals);
        const pct = prom / max * 100;
        const enCero = vals.filter(v => v === 0).length;
        return hbar(`${it.id} · ${it.criterio}`, pct, `${Math.round(pct)}%`,
          `${it.id} ${it.criterio}: promedio ${fmt(prom)} de ${fmt(max)} • ${enCero} con 0 pts`);
      }).join('');

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

    // --- PUBLICACIÓN (DIRECCIÓN, PdL) ---

    getFechaSummary(fecha = this.fecha) {
      const roster = Core.rosterFor(this.roster, fecha);
      const counts = { corregido: 0, ausente: 0, en_progreso: 0, pendiente: 0 };
      const faltan = [];
      roster.forEach(st => {
        const e = Core.estadoPdl(this.grades.get(st.id), this.getAsistencia(st.id, fecha));
        counts[e]++;
        if (e === 'pendiente' || e === 'en_progreso') faltan.push(st);
      });
      return { roster, counts, faltan, listo: roster.length > 0 && faltan.length === 0 };
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
      const status = pub
        ? `<div class="pub-status ok">✅ Publicadas el ${new Date(pub.en).toLocaleString('es-AR')} por ${escapeHtml(pub.por)} (${pub.cantidad} estudiantes). Los profesores ya no pueden modificar esta fecha.</div>`
        : `<div class="pub-status wait">${s.listo ? '🟢 Todas las correcciones están terminadas: se puede publicar.' : `⏳ No se puede publicar todavía: faltan ${s.faltan.length} corrección(es).`} Los estudiantes no ven ninguna nota de esta fecha.</div>`;
      const actions = pub
        ? `<button class="btn btn-primary" data-act="publicar" ${s.listo ? '' : 'disabled'}>🔄 Republicar con los últimos cambios</button>
           <button class="btn btn-danger" data-act="retirar">🚫 Retirar publicación</button>`
        : `<button class="btn btn-primary" data-act="publicar" ${s.listo ? '' : 'disabled'}>📤 Publicar notas de ${escapeHtml(this.inst.titulo)}</button>`;
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
            <div class="pub-stat"><div class="v" style="color: #fbbf24;">${s.faltan.length}</div><div class="l">Por corregir</div></div>
            <div class="pub-stat"><div class="v">${s.counts.ausente}</div><div class="l">Ausentes</div></div>
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
    }

    // Lo que ve el estudiante: nota, secciones y puntaje por ítem (sin observaciones ni corrector)
    buildPublicPdl(st, fecha, publicadoEn) {
      const g = this.grades.get(st.id);
      const inst = Core.getInstancia(fecha);
      const base = { fecha, fechaTexto: inst.fechaTexto, publicadoEn };
      if (!g || g.ausente) return { ...base, estado: 'ausente' };
      return {
        ...base,
        estado: 'evaluado',
        tema: g.tema,
        nota: g.nota,
        secciones: SECCIONES.map(s => ({ id: s.id, titulo: s.titulo, nota: g[`nota${s.id}`], max: s.max })),
        items: ITEMS.map(it => ({ id: it.id, seccion: it.seccion, criterio: it.criterio, puntaje: g.puntajes[it.id], max: it.niveles[0].pts }))
      };
    }

    async publish(fecha) {
      await this.saveNow();
      const s = this.getFechaSummary(fecha);
      const titulo = Core.getInstancia(fecha).titulo;
      if (!s.listo) {
        this.toast(`Faltan ${s.faltan.length} corrección(es) de ${titulo}: no se puede publicar.`, 'warning');
        return;
      }
      if (!confirm(`¿Publicar las notas de ${titulo} para ${s.roster.length} estudiantes?\n\nCada estudiante verá con su DNI su nota final, el puntaje por sección e ítem por ítem. No se publican observaciones ni quién corrigió.\nDespués de publicar, los profesores ya no pueden modificar esta fecha.`)) return;
      try {
        const en = new Date().toISOString();
        const docs = s.roster.map(st => ({ dni: st.dni, apellido: st.apellido, nombre: st.nombre, pdl: this.buildPublicPdl(st, fecha, en) }));
        for (let i = 0; i < docs.length; i += 400) {
          const batch = db.batch();
          docs.slice(i, i + 400).forEach(d => {
            // merge: conserva el resultado del primer examen ya publicado en el mismo documento
            batch.set(db.collection('student_results').doc(d.dni), d, { merge: true });
          });
          await batch.commit();
        }
        await db.collection('pdl_config').doc('publicacion').set({
          publicadas: { [fecha]: { en, por: this.profile.name, cantidad: docs.length } }
        }, { merge: true });
        this.toast(`📤 Notas de ${titulo} publicadas para ${docs.length} estudiantes`, 'success');
      } catch (err) {
        console.error('Error publicando PdL:', err);
        this.toast(`Error al publicar: ${err.message}`, 'danger');
      }
    }

    async unpublish(fecha) {
      const titulo = Core.getInstancia(fecha).titulo;
      if (!confirm(`¿Retirar la publicación de ${titulo}?\n\nLos estudiantes dejan de ver la nota de PdL y los profesores pueden volver a modificar las correcciones.`)) return;
      try {
        const roster = Core.rosterFor(this.roster, fecha);
        for (let i = 0; i < roster.length; i += 400) {
          const batch = db.batch();
          roster.slice(i, i + 400).forEach(st => {
            batch.set(db.collection('student_results').doc(st.dni), { pdl: firebase.firestore.FieldValue.delete() }, { merge: true });
          });
          await batch.commit();
        }
        await db.collection('pdl_config').doc('publicacion').update(
          new firebase.firestore.FieldPath('publicadas', fecha), firebase.firestore.FieldValue.delete());
        this.toast(`Publicación de ${titulo} retirada`, 'success');
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
