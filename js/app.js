/**
 * Main Application Controller - Examen de Ingreso 2027
 * Escuela Secundaria Técnica – UTN – San Miguel
 * Control de interfaz, carga ágil, doble carga cruzada y Firebase Auth.
 */

(function () {
  class AppController {
    constructor() {
      this.currentTab = 'carga';
      this.selectedStudent = null;
      this.currentAnswers = {};
      this.currentTema = null;
      this.focusedQuestion = 1;
      this.searchQuery = '';
      this.selectedAulaFilter = 'all';
      this.selectedScopeFilter = 'assigned'; // 'assigned' | 'all'
    }

    init() {
      this.setupEventListeners();
      this.bindKeyboardShortcuts();
      this.populateClassroomFilters();
      this.populateSchoolFilters();

      // Escuchar cambios de datos de Firestore
      window.DataService.subscribe(() => {
        this.renderAll();
      });

      // Escuchar cambios de estado de Firebase
      window.addEventListener('firebase-status-change', (e) => {
        this.updateFirebaseStatusBadge(e.detail);
      });

      // Si ya hay un usuario cargado inicialmente
      const cur = window.DataService.getCurrentUser();
      if (cur) {
        this.onUserLoggedIn(cur);
      }
    }

    // --- ENLACE DE EVENTOS Y TECLADO ---

    setupEventListeners() {
      // Pestañas de navegación
      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tab = e.currentTarget.getAttribute('data-tab');
          this.switchTab(tab);
        });
      });

      // Filtro de alcance: Mis Asignados vs Todos
      const scopeFilter = document.getElementById('studentScopeFilter');
      if (scopeFilter) {
        scopeFilter.addEventListener('change', (e) => {
          this.selectedScopeFilter = e.target.value;
          this.renderStudentSearchList();
        });
      }

      // Búsqueda en Carga Ágil
      const searchInput = document.getElementById('studentSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value;
          this.renderStudentSearchList();
        });
      }

      // Filtro de Aula en Carga Ágil
      const aulaFilter = document.getElementById('studentAulaFilter');
      if (aulaFilter) {
        aulaFilter.addEventListener('change', (e) => {
          this.selectedAulaFilter = e.target.value;
          this.renderStudentSearchList();
        });
      }

      // Cambio de Tema
      const btnTemaA = document.getElementById('btnTemaA');
      const btnTemaB = document.getElementById('btnTemaB');
      if (btnTemaA) btnTemaA.addEventListener('click', () => this.setTema('A'));
      if (btnTemaB) btnTemaB.addEventListener('click', () => this.setTema('B'));

      // Botón Guardar Examen
      const btnSaveExam = document.getElementById('btnSaveExam');
      if (btnSaveExam) btnSaveExam.addEventListener('click', () => this.saveCurrentExam());

      // Botón Marcar Ausente
      const btnMarkAbsent = document.getElementById('btnMarkAbsent');
      if (btnMarkAbsent) btnMarkAbsent.addEventListener('click', () => this.markCurrentAbsent());

      // Botones Alumno Anterior / Siguiente
      const btnPrev = document.getElementById('btnPrevStudent');
      const btnNext = document.getElementById('btnNextStudent');
      if (btnPrev) btnPrev.addEventListener('click', () => this.navigateStudent(-1));
      if (btnNext) btnNext.addEventListener('click', () => this.navigateStudent(1));
    }

    bindKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        // Solo actuar si estamos en la pestaña de carga ágil y no hay modal abierto
        if (this.currentTab !== 'carga') return;
        const overlay = document.getElementById('firebaseAuthOverlay');
        if (overlay && overlay.style.display !== 'none') return;

        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
          if (document.activeElement.id === 'studentSearchInput' && e.key === 'Escape') {
            document.activeElement.blur();
          }
          return;
        }

        const key = e.key.toUpperCase();

        // 1. Opciones directas: A, B, C, D o 1, 2, 3, 4
        if (['A', 'B', 'C', 'D'].includes(key)) {
          e.preventDefault();
          this.setQuestionAnswer(this.focusedQuestion, key);
          this.focusNextQuestion();
          return;
        }

        if (['1', '2', '3', '4'].includes(key)) {
          e.preventDefault();
          const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
          this.setQuestionAnswer(this.focusedQuestion, map[key]);
          this.focusNextQuestion();
          return;
        }

        // 2. Navegación: Flecha Arriba / Abajo
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.focusedQuestion = Math.min(20, this.focusedQuestion + 1);
          this.highlightFocusedQuestion();
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.focusedQuestion = Math.max(1, this.focusedQuestion - 1);
          this.highlightFocusedQuestion();
          return;
        }

        // 3. Borrar respuesta: Backspace o Delete
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          delete this.currentAnswers[this.focusedQuestion];
          this.renderAnswerSheet();
          this.updateLiveScorecard();
          if (e.key === 'Backspace') {
            this.focusedQuestion = Math.max(1, this.focusedQuestion - 1);
            this.highlightFocusedQuestion();
          }
          return;
        }

        // 4. Salto de pregunta en blanco: Espacio
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          delete this.currentAnswers[this.focusedQuestion];
          this.renderAnswerSheet();
          this.updateLiveScorecard();
          this.focusNextQuestion();
          return;
        }

        // 5. Guardar en Firestore: Enter
        if (e.key === 'Enter') {
          e.preventDefault();
          this.saveCurrentExam();
          return;
        }

        // 6. Cambio de Tema: Alt+A o Alt+B
        if (e.altKey && key === 'A') {
          e.preventDefault();
          this.setTema('A');
          return;
        }
        if (e.altKey && key === 'B') {
          e.preventDefault();
          this.setTema('B');
          return;
        }
      });
    }

    // --- AUTENTICACIÓN FIREBASE AUTH ---

    fillLoginEmail(email) {
      const emailInput = document.getElementById('authEmailInput');
      const passInput = document.getElementById('authPasswordInput');
      if (emailInput) {
        emailInput.value = email;
      }
      if (passInput) {
        passInput.focus();
      }
    }

    async handleFirebaseLogin(e) {
      e.preventDefault();
      const emailInput = document.getElementById('authEmailInput');
      const passInput = document.getElementById('authPasswordInput');
      const errorBox = document.getElementById('authErrorMessage');
      const btnSubmit = document.getElementById('btnSubmitLogin');

      const email = emailInput ? emailInput.value.trim() : '';
      const pass = passInput ? passInput.value : '';

      if (errorBox) errorBox.style.display = 'none';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Verificando con Firebase...';
      }

      try {
        await window.FirebaseSyncService.signIn(email, pass);
        // onAuthStateChanged en firebase-sync.js se encarga de habilitar el perfil
        if (passInput) passInput.value = '';
      } catch (err) {
        console.error('Error de autenticación:', err);
        if (errorBox) {
          errorBox.textContent = `Error de acceso: ${this.translateFirebaseError(err.code || err.message)}`;
          errorBox.style.display = 'block';
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = '🔐 Iniciar Sesión con Firebase';
        }
      }
    }

    translateFirebaseError(code) {
      if (code.includes('user-not-found')) return 'Usuario no registrado en Firebase.';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Contraseña incorrecta.';
      if (code.includes('invalid-email')) return 'El formato del correo electrónico no es válido.';
      if (code.includes('too-many-requests')) return 'Demasiados intentos fallidos. Aguardá unos instantes.';
      return code;
    }

    onUserLoggedIn(profile) {
      this.updateUserProfileUI();

      // Permitir ver todos los estudiantes
      this.selectedScopeFilter = 'all';
      const scopeSelect = document.getElementById('studentScopeFilter');
      if (scopeSelect) {
        scopeSelect.value = 'all';
        scopeSelect.disabled = false;
      }

      // Si es preceptor, ir a Carga Ágil
      if (!profile.isAdmin) {
        this.switchTab('carga');
      } else {
        this.switchTab('monitor-preceptores');
      }

      // Seleccionar el primer alumno visible
      const visibleList = this.getVisibleStudents();
      if (visibleList.length > 0) {
        this.selectStudent(visibleList[0].id);
      }

      this.renderAll();
      this.showToast(`Bienvenido/a, ${profile.name}`, 'success');
    }

    // --- NAVEGACIÓN Y VISTAS ---

    switchTab(tabName) {
      const isAd = window.DataService.isAdmin();

      // Bloquear accesos directos o no autorizados a preceptores
      if (['monitor-preceptores', 'auditoria', 'estadisticas', 'exportar'].includes(tabName) && !isAd) {
        this.showToast('Acceso restringido: Esta sección es exclusiva de Dirección y Vicedirección.', 'warning');
        return;
      }

      this.currentTab = tabName;

      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
      });

      document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `view-${tabName}`);
      });

      if (tabName === 'carga') {
        this.renderStudentSearchList();
        this.renderAnswerSheet();
      } else if (tabName === 'mi-progreso') {
        this.renderMiProgresoView();
      } else if (tabName === 'monitor-preceptores') {
        this.renderMonitorPreceptoresView();
      } else if (tabName === 'auditoria') {
        this.renderAuditView();
      } else if (tabName === 'estadisticas') {
        this.renderAnalyticsView();
      } else if (tabName === 'estudiantes') {
        this.renderStudentsDirectory();
      } else if (tabName === 'exportar') {
        this.renderExportView();
      }
    }

    // --- CARGA ÁGIL DE EXÁMENES ---

    getVisibleStudents() {
      let students = window.DataService.getStudents();
      const user = window.DataService.getCurrentUser();
      const myUid = user ? user.uid : '';

      // Filtro de alcance por Estado de Carga
      if (this.selectedScopeFilter === 'need_second') {
        // Necesitan 2da carga: tienen exactamente 1 carga, y NO fue cargada por el usuario actual
        students = students.filter(s => {
          const subs = window.DataService.getSubmissionsForStudent(s.id);
          return subs.length === 1 && !subs.some(x => x.preceptorUid === myUid);
        });
      } else if (this.selectedScopeFilter === 'zero_loads') {
        students = students.filter(s => window.DataService.getSubmissionsForStudent(s.id).length === 0);
      } else if (this.selectedScopeFilter === 'my_pending') {
        students = students.filter(s => {
          const subs = window.DataService.getSubmissionsForStudent(s.id);
          return subs.length < 2 && !subs.some(x => x.preceptorUid === myUid);
        });
      } else if (this.selectedScopeFilter === 'loaded_by_me') {
        students = students.filter(s => {
          const subs = window.DataService.getSubmissionsForStudent(s.id);
          return subs.some(x => x.preceptorUid === myUid);
        });
      } else if (this.selectedScopeFilter === 'completed') {
        students = students.filter(s => window.DataService.getSubmissionsForStudent(s.id).length >= 2);
      }

      // Filtro de Aula
      if (this.selectedAulaFilter !== 'all') {
        students = students.filter(s => s.aula === this.selectedAulaFilter);
      }

      // Búsqueda
      const q = this.searchQuery.trim().toLowerCase();
      if (q) {
        students = students.filter(s => {
          return s.apellido.toLowerCase().includes(q) ||
                 s.nombre.toLowerCase().includes(q) ||
                 String(s.dni).includes(q) ||
                 (s.familiar && s.familiar.toLowerCase().includes(q));
        });
      }

      return students;
    }

    selectStudent(studentId) {
      const student = window.DataService.getStudentById(studentId);
      if (!student) return;
      this.selectedStudent = student;

      // Cargar respuestas previas del usuario actual si ya las subió a Firestore
      const user = window.DataService.getCurrentUser();
      const subs = window.DataService.getSubmissionsForStudent(studentId);
      const mySub = user ? subs.find(s => s.preceptorUid === user.uid) : null;

      if (mySub && !mySub.isAbsent) {
        this.currentAnswers = { ...mySub.answers };
        this.currentTema = mySub.tema || null;
      } else {
        this.currentAnswers = {};
        this.currentTema = null;
      }

      this.focusedQuestion = 1;
      this.renderSelectedStudentCard();
      this.renderAnswerSheet();
      this.updateLiveScorecard();
      this.highlightFocusedQuestion();

      document.querySelectorAll('.student-list-item').forEach(el => {
        el.classList.toggle('selected', el.getAttribute('data-id') === studentId);
      });
    }

    navigateStudent(delta) {
      const list = this.getVisibleStudents();
      if (!this.selectedStudent || list.length === 0) return;

      const curIdx = list.findIndex(s => s.id === this.selectedStudent.id);
      let nextIdx = curIdx + delta;

      if (nextIdx < 0) nextIdx = list.length - 1;
      if (nextIdx >= list.length) nextIdx = 0;

      this.selectStudent(list[nextIdx].id);
      this.scrollSelectedStudentIntoView();
    }

    scrollSelectedStudentIntoView() {
      const item = document.querySelector(`.student-list-item[data-id="${this.selectedStudent.id}"]`);
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    cancelEditingPreceptor() {
      this.editingPreceptorUid = null;
      this.editingPreceptorName = null;
      if (this.selectedStudent) {
        this.selectStudent(this.selectedStudent.id);
      }
      this.showToast('Modo de corrección cancelado', 'info');
    }

    setTema(tema) {
      this.currentTema = tema;
      const btnA = document.getElementById('btnTemaA');
      const btnB = document.getElementById('btnTemaB');
      const container = document.getElementById('temaSelectorContainer');
      const promptBadge = document.getElementById('temaPromptBadge');

      if (btnA) btnA.classList.toggle('active', tema === 'A');
      if (btnB) btnB.classList.toggle('active', tema === 'B');

      if (container) {
        container.classList.toggle('unselected', !tema);
      }

      if (promptBadge) {
        if (!tema) {
          promptBadge.textContent = '⚠️ Elegí Tema';
          promptBadge.className = 'tema-prompt-label pending';
        } else {
          promptBadge.textContent = `✅ Tema ${tema}`;
          promptBadge.className = 'tema-prompt-label selected';
        }
      }

      this.renderAnswerSheet();
      this.updateLiveScorecard();
    }

    setQuestionAnswer(qNum, option) {
      this.currentAnswers[qNum] = option;
      this.renderAnswerSheet();
      this.updateLiveScorecard();
    }

    focusNextQuestion() {
      if (this.focusedQuestion < 20) {
        this.focusedQuestion++;
        this.highlightFocusedQuestion();
      }
    }

    highlightFocusedQuestion() {
      document.querySelectorAll('.answer-grid-row').forEach(row => {
        const q = parseInt(row.getAttribute('data-q'), 10);
        row.classList.toggle('focused', q === this.focusedQuestion);
      });

      const focusedRow = document.querySelector(`.answer-grid-row[data-q="${this.focusedQuestion}"]`);
      if (focusedRow) {
        focusedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    updateLiveScorecard() {
      if (!this.selectedStudent) return;
      const calc = window.DataService.calculateScore(this.currentTema, this.currentAnswers);

      const mathEl = document.getElementById('liveScoreMath');
      const langEl = document.getElementById('liveScoreLang');
      const totalEl = document.getElementById('liveScoreTotal');
      const statusEl = document.getElementById('liveScoreStatus');

      if (!calc.hasTema) {
        if (mathEl) mathEl.textContent = `- / 5.0`;
        if (langEl) langEl.textContent = `- / 5.0`;
        if (totalEl) totalEl.textContent = `-`;
        if (statusEl) {
          statusEl.textContent = 'ELEGIR TEMA A o B';
          statusEl.className = 'score-badge badge-tema-pending';
        }
      } else {
        if (mathEl) mathEl.textContent = `${calc.scoreMath.toFixed(1)} / 5.0`;
        if (langEl) langEl.textContent = `${calc.scoreLang.toFixed(1)} / 5.0`;
        if (totalEl) totalEl.textContent = calc.scoreTotal.toFixed(1);

        if (statusEl) {
          const isPassed = calc.scoreTotal >= 6.0;
          statusEl.textContent = isPassed ? 'APROBADO' : 'NO ALCANZA';
          statusEl.className = `score-badge ${isPassed ? 'badge-passed' : 'badge-failed'}`;
        }
      }

      // Detalle de doble carga
      const detailsBox = document.getElementById('currentStudentDualLoadDetails');
      if (detailsBox) {
        const subs = window.DataService.getSubmissionsForStudent(this.selectedStudent.id);
        const currentUser = window.DataService.getCurrentUser();
        const myUid = currentUser ? currentUser.uid : '';

        let loadsHtml = '';
        if (subs.length === 0) {
          loadsHtml = '<div class="text-muted small">Sin calificaciones registradas aún (se requieren 2 de colegas distintos).</div>';
        } else {
          loadsHtml = subs.map(sub => {
            const isMe = sub.preceptorUid === myUid;
            return `
              <div class="d-flex justify-content-between mb-1 small">
                <span><strong>${sub.preceptorName || 'Preceptor'}</strong>${isMe ? ' (Vos)' : ''}:</span>
                <span style="color: #34d399;">✅ Nota: ${sub.scoreTotal !== null ? sub.scoreTotal.toFixed(1) : '-'}</span>
              </div>
            `;
          }).join('');
        }

        let summaryBadge = '';
        if (subs.length === 0) {
          summaryBadge = '<span class="status-pill pill-warning">⏳ 0 de 2 mínimas</span>';
        } else if (subs.length === 1) {
          summaryBadge = '<span class="status-pill pill-warning">⚡ 1 de 2 (Requiere 2da carga)</span>';
        } else {
          summaryBadge = '<span class="status-pill pill-success">✅ 2 de 2 Completas</span>';
        }

        detailsBox.innerHTML = `
          <div class="mb-2">${loadsHtml}</div>
          <div class="pt-2 border-top d-flex justify-content-between align-items-center" style="border-color: rgba(255,255,255,0.1) !important;">
            <strong>Control:</strong>
            ${summaryBadge}
          </div>
        `;
      }
    }

    async saveCurrentExam() {
      if (!this.selectedStudent) {
        this.showToast('Por favor, seleccioná un estudiante', 'warning');
        return;
      }

      if (!this.currentTema || (this.currentTema !== 'A' && this.currentTema !== 'B')) {
        this.showToast('⚠️ Debés seleccionar si el examen es TEMA A o TEMA B antes de guardar', 'danger');
        const container = document.getElementById('temaSelectorContainer');
        if (container) {
          container.classList.remove('shake-highlight-tema');
          void container.offsetWidth;
          container.classList.add('shake-highlight-tema');
          container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      const answeredCount = Object.keys(this.currentAnswers).length;
      if (answeredCount < 20) {
        const confirmSave = confirm(`Se cargaron ${answeredCount} de 20 preguntas. ¿Deseás guardar las respuestas restantes como incorrectas/en blanco?`);
        if (!confirmSave) return;
      }

      const prevSubs = window.DataService.getSubmissionsForStudent(this.selectedStudent.id);
      const currentUser = window.DataService.getCurrentUser();
      const myUid = currentUser ? currentUser.uid : '';
      const otherSub = prevSubs.find(s => s.preceptorUid !== myUid);

      try {
        const overrideUid = this.editingPreceptorUid || null;
        const overrideName = this.editingPreceptorName || null;
        const wasEditing = !!this.editingPreceptorName;
        const editedName = this.editingPreceptorName;

        const submission = await window.DataService.saveExamSubmission({
          studentId: this.selectedStudent.id,
          tema: this.currentTema,
          answers: this.currentAnswers,
          isAbsent: false,
          overridePreceptorUid: overrideUid,
          overridePreceptorName: overrideName
        });

        this.editingPreceptorUid = null;
        this.editingPreceptorName = null;

        if (wasEditing) {
          this.showToast(`✅ Evaluación de ${editedName} modificada y guardada con éxito en Firebase (Nota: ${submission.scoreTotal})`, 'success');
        } else if (submission.localOnly) {
          if (submission.quotaExceeded) {
            this.showToast(`💾 Guardado localmente (Cuota diaria de Firebase agotada). La nota ${submission.scoreTotal} quedó segura en tu equipo.`, 'warning');
          } else {
            this.showToast(`💾 Guardado localmente en tu equipo (Nota: ${submission.scoreTotal}). Sin conexión a Firebase.`, 'warning');
          }
        } else if (otherSub) {
          const isMatch = Math.abs(submission.scoreTotal - otherSub.scoreTotal) < 0.01;
          if (isMatch) {
            this.showToast(`☁️ Examen guardado y sincronizado en Firebase: ${this.selectedStudent.apellido} (Nota: ${submission.scoreTotal}). Coincide con ${otherSub.preceptorName}.`, 'success');
          } else {
            this.showToast(`☁️ Examen guardado y sincronizado en Firebase: Tu nota ${submission.scoreTotal} vs ${otherSub.scoreTotal} de ${otherSub.preceptorName} (Discrepancia para revisar).`, 'warning');
          }
        } else {
          this.showToast(`☁️ Examen guardado y sincronizado en Firebase: ${this.selectedStudent.apellido} (Nota: ${submission.scoreTotal}).`, 'success');
        }

        // Navegar automáticamente al siguiente examen pendiente
        this.navigateNextPending();
      } catch (err) {
        console.error(err);
        this.showToast('Error guardando examen: ' + err.message, 'danger');
      }
    }

    async markCurrentAbsent() {
      if (!this.selectedStudent) return;
      if (!confirm(`¿Confirmás marcar a ${this.selectedStudent.apellido}, ${this.selectedStudent.nombre} como AUSENTE?`)) return;

      try {
        await window.DataService.saveExamSubmission({
          studentId: this.selectedStudent.id,
          tema: this.currentTema,
          answers: {},
          isAbsent: true
        });

        this.showToast(`${this.selectedStudent.apellido} registrado como Ausente`, 'info');
        this.navigateNextPending();
      } catch (err) {
        this.showToast('Error: ' + err.message, 'danger');
      }
    }

    navigateNextPending() {
      const allStudents = window.DataService.getStudents();
      const currentUser = window.DataService.getCurrentUser();
      const myUid = currentUser ? currentUser.uid : '';

      const curIdx = this.selectedStudent ? allStudents.findIndex(s => s.id === this.selectedStudent.id) : -1;
      let nextStudent = null;

      // Buscar de la posición actual hacia adelante
      for (let i = curIdx + 1; i < allStudents.length; i++) {
        const st = allStudents[i];
        const subs = window.DataService.getSubmissionsForStudent(st.id);
        if (subs.length < 2 && !subs.some(x => x.preceptorUid === myUid)) {
          nextStudent = st;
          break;
        }
      }

      // Si no se encontró adelante, buscar desde el principio
      if (!nextStudent) {
        for (let i = 0; i <= curIdx; i++) {
          const st = allStudents[i];
          const subs = window.DataService.getSubmissionsForStudent(st.id);
          if (subs.length < 2 && !subs.some(x => x.preceptorUid === myUid)) {
            nextStudent = st;
            break;
          }
        }
      }

      if (nextStudent) {
        this.selectStudent(nextStudent.id);
        this.scrollSelectedStudentIntoView();
      } else {
        this.showToast('¡Felicitaciones! No quedan exámenes pendientes para calificar.', 'success');
      }
    }

    // --- RENDERIZADO DE COMPONENTES ---

    renderSelectedStudentCard() {
      const s = this.selectedStudent;
      if (!s) return;

      const nameEl = document.getElementById('selectedStudentName');
      const badgeAulaEl = document.getElementById('selectedStudentAula');
      const dniEl = document.getElementById('selectedStudentDni');
      const schoolEl = document.getElementById('selectedStudentSchool');
      const tutorEl = document.getElementById('selectedStudentTutor');
      const phoneLinkEl = document.getElementById('selectedStudentPhoneLink');
      const waLinkEl = document.getElementById('selectedStudentWaLink');
      const attendBadgeEl = document.getElementById('selectedStudentAttendBadge');
      const assignedNamesEl = document.getElementById('assignedPreceptorsNames');

      const subs = window.DataService.getSubmissionsForStudent(s.id);
      const currentUser = window.DataService.getCurrentUser();
      const myUid = currentUser ? currentUser.uid : '';

      if (nameEl) nameEl.textContent = `${s.apellido}, ${s.nombre}`;
      if (badgeAulaEl) badgeAulaEl.textContent = `Aula ${s.aula}`;
      if (dniEl) dniEl.textContent = s.dni || 'Sin DNI';
      if (schoolEl) schoolEl.textContent = s.escuela_origen || 'No especificada';
      if (tutorEl) tutorEl.textContent = s.familiar || 'No especificado';

      if (assignedNamesEl) {
        if (subs.length === 0) {
          assignedNamesEl.innerHTML = `<span style="color: #94a3b8;">⏳ Sin evaluar (0 de 2 cargas)</span>`;
        } else if (subs.length === 1) {
          assignedNamesEl.innerHTML = `<span style="color: #fbbf24;">⚡ 1 de 2 cargas (${subs[0].preceptorName}) &bull; Requiere 2da carga</span>`;
        } else {
          assignedNamesEl.innerHTML = `<span style="color: #34d399;">✅ 2 de 2 cargas (${subs[0].preceptorName} y ${subs[1].preceptorName})</span>`;
        }
      }

      // Aviso si estamos en modo edición de otro preceptor o si ya completaron
      const bannerCompleted = document.getElementById('examAlreadyCompletedBanner');
      if (bannerCompleted) {
        if (this.editingPreceptorUid) {
          bannerCompleted.innerHTML = `
            <div class="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
              <div>
                <strong>✏️ MODO DE CORRECCIÓN:</strong> Estás editando la evaluación registrada por <strong>${this.editingPreceptorName}</strong>. Modificá las respuestas o el Tema y presioná <strong>💾 Guardar Examen</strong>.
              </div>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.app.cancelEditingPreceptor()">
                  ❌ Cancelar Edición
                </button>
                <button type="button" class="btn btn-danger btn-sm" onclick="window.AuditManager.confirmDeleteSubmission('${s.id}', '${this.editingPreceptorUid}', '${this.editingPreceptorName}')">
                  🗑️ Anular Carga
                </button>
              </div>
            </div>
          `;
          bannerCompleted.style.display = 'block';
        } else {
          const isLoadedByMe = subs.some(x => x.preceptorUid === myUid);
          if (subs.length >= 2 && !isLoadedByMe) {
            bannerCompleted.innerHTML = `
              <div class="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
                <div>
                  <strong>⚠️ Examen ya calificado por 2 colegas:</strong> Este alumno ya fue evaluado por <strong>${subs[0].preceptorName}</strong> y <strong>${subs[1].preceptorName}</strong>. No requiere más cargas.
                </div>
                <button type="button" class="btn btn-warning btn-sm" onclick="window.app.navigateNextPending()">
                  ⏩ Siguiente Examen Pendiente
                </button>
              </div>
            `;
            bannerCompleted.style.display = 'block';
          } else {
            bannerCompleted.style.display = 'none';
          }
        }
      }

      // Control del botón de anulación en Carga Ágil
      const btnAnularExam = document.getElementById('btnAnularExam');
      if (btnAnularExam) {
        if (subs.length > 0) {
          btnAnularExam.style.display = 'inline-block';
          btnAnularExam.onclick = () => {
            if (subs.length === 1) {
              window.AuditManager.confirmDeleteSubmission(s.id, subs[0].preceptorUid, subs[0].preceptorName);
            } else {
              window.AuditManager.confirmResetStudentExam(s.id);
            }
          };
        } else {
          btnAnularExam.style.display = 'none';
        }
      }

      if (phoneLinkEl) {
        phoneLinkEl.href = s.telefono ? `tel:${s.telefono}` : '#';
        phoneLinkEl.textContent = s.telefono || 'Sin teléfono';
      }

      if (waLinkEl) {
        const cleanPhone = String(s.telefono || '').replace(/\D/g, '');
        waLinkEl.href = cleanPhone ? `https://wa.me/549${cleanPhone}` : '#';
        waLinkEl.style.display = cleanPhone ? 'inline-flex' : 'none';
      }

      if (attendBadgeEl) {
        attendBadgeEl.textContent = s.asistio ? 'PRESENTE' : 'AUSENTE';
        attendBadgeEl.className = `status-pill ${s.asistio ? 'pill-success' : 'pill-danger'}`;
      }

      this.setTema(this.currentTema);
    }

    renderStudentSearchList() {
      const listContainer = document.getElementById('studentsListContainer');
      if (!listContainer) return;

      const students = this.getVisibleStudents();

      if (students.length === 0) {
        listContainer.innerHTML = '<div class="p-4 text-center text-muted">No se encontraron estudiantes con los filtros aplicados.</div>';
        return;
      }

      const currentUser = window.DataService.getCurrentUser();
      let html = '';

      students.forEach(st => {
        const isSelected = this.selectedStudent && this.selectedStudent.id === st.id;
        const subs = window.DataService.getSubmissionsForStudent(st.id);
        const mySub = currentUser ? subs.find(s => s.preceptorUid === currentUser.uid) : null;

        let myBadge = '';
        if (mySub) {
          myBadge = `<span class="badge badge-success-subtle">✍️ Calificado (${mySub.scoreTotal.toFixed(1)})</span>`;
        } else if (subs.length === 1) {
          myBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">⚡ Falta 2da (${subs[0].preceptorName})</span>`;
        } else if (subs.length >= 2) {
          myBadge = `<span class="badge badge-matched">✅ Completo (2/2)</span>`;
        } else {
          myBadge = `<span class="badge badge-pending-subtle">⏳ Sin evaluar (0/2)</span>`;
        }

        let loadsInfo = '';
        if (subs.length === 0) {
          loadsInfo = '<span class="text-muted small">Sin cargas registradas</span>';
        } else if (subs.length === 1) {
          loadsInfo = `<span class="small" style="color: #fbbf24;">1/2 por ${subs[0].preceptorName}</span>`;
        } else {
          loadsInfo = `<span class="small" style="color: #34d399;">2/2: ${subs[0].preceptorName} y ${subs[1].preceptorName}</span>`;
        }

        html += `
          <div class="student-list-item ${isSelected ? 'selected' : ''}" data-id="${st.id}" onclick="window.app.selectStudent('${st.id}')">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="student-name">${st.apellido}, ${st.nombre}</strong>
              <span class="badge badge-aula">A${st.aula}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center text-muted small">
              <span>DNI: ${st.dni}</span>
              ${myBadge}
            </div>
            <div class="preceptor-pair-label">
              ${loadsInfo}
            </div>
          </div>
        `;
      });

      listContainer.innerHTML = html;
    }

    renderAnswerSheet() {
      const container = document.getElementById('answerSheetRows');
      if (!container) return;

      const questions = window.EXAM_CONFIG.questions;
      let html = '';

      // Sección Matemática (1 a 10)
      html += `<div class="exam-section-header">📐 PARTE 1: MATEMÁTICA (Preguntas 1 a 10 &bull; 0.5 pts c/u)</div>`;
      for (let i = 0; i < 10; i++) {
        html += this.buildQuestionRowHTML(questions[i]);
      }

      // Sección Lengua (11 a 20)
      html += `<div class="exam-section-header mt-3">📖 PARTE 2: PRÁCTICAS DEL LENGUAJE (Preguntas 11 a 20 &bull; 0.5 pts c/u)</div>`;
      for (let i = 10; i < 20; i++) {
        html += this.buildQuestionRowHTML(questions[i]);
      }

      container.innerHTML = html;
      this.highlightFocusedQuestion();
    }

    buildQuestionRowHTML(q) {
      const selectedOpt = this.currentAnswers[q.n] || '';
      const hasTema = this.currentTema === 'A' || this.currentTema === 'B';
      const correctExpected = hasTema ? ((this.currentTema === 'B') ? q.temaB : q.temaA) : null;
      const isFocused = q.n === this.focusedQuestion;
      const isAnswered = !!selectedOpt;
      const isCorrect = hasTema && selectedOpt === correctExpected;

      let scoreFeedback = '';
      if (isAnswered) {
        if (!hasTema) {
          scoreFeedback = '<span class="score-chip chip-pending" title="Elegí Tema A o B para calcular puntaje">Sin Tema</span>';
        } else {
          scoreFeedback = isCorrect ? '<span class="score-chip chip-correct">+0.5</span>' : '<span class="score-chip chip-incorrect">0.0</span>';
        }
      }

      return `
        <div class="answer-grid-row ${isFocused ? 'focused' : ''} ${isAnswered ? 'answered' : ''}" data-q="${q.n}" onclick="window.app.setFocusedQuestion(${q.n})">
          <div class="row-num">#${q.n}</div>
          <div class="row-info">
            <span class="row-topic">${q.topic}</span>
            <span class="row-criterion text-muted">${q.criterion}</span>
          </div>
          <div class="options-group">
            ${['A', 'B', 'C', 'D'].map(opt => `
              <button type="button" class="opt-btn ${selectedOpt === opt ? 'selected' : ''}" 
                onclick="event.stopPropagation(); window.app.setQuestionAnswer(${q.n}, '${opt}'); window.app.focusNextQuestion();">
                ${opt}
              </button>
            `).join('')}
          </div>
          <div class="row-feedback">
            ${scoreFeedback}
          </div>
        </div>
      `;
    }

    setFocusedQuestion(n) {
      this.focusedQuestion = n;
      this.highlightFocusedQuestion();
    }

    // --- VISTA DE AUDITORÍA (SOLO DIRECTIVOS) ---

    setAuditQuickFilter(filterType) {
      const select = document.getElementById('auditStatusFilter');
      if (select) {
        select.value = filterType;
      }
      this.renderAuditView();
    }

    goToDiscrepancies() {
      this.switchTab('auditoria');
      this.setAuditQuickFilter('discrepancy');
      const table = document.getElementById('view-auditoria');
      if (table) {
        table.scrollIntoView({ behavior: 'smooth' });
      }
    }

    renderAuditView() {
      const summary = window.AuditManager.getAuditSummary();

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('auditKpiTotal', summary.total);
      setEl('auditKpiMatched', summary.matchedCount);
      setEl('auditKpiDiscrepancies', summary.discrepancyCount);
      setEl('auditKpiSingle', summary.singleCount);
      setEl('auditKpiPending', summary.pendingCount);
      setEl('auditKpiResolved', summary.resolvedCount);

      // Sincronizar contadores de los chips de acceso rápido
      setEl('chipCountTotal', summary.total);
      setEl('chipCountDiscrepancy', summary.discrepancyCount);
      setEl('chipCountMatched', summary.matchedCount + summary.resolvedCount);
      setEl('chipCountSingle', summary.singleCount);
      setEl('chipCountPending', summary.pendingCount);

      // Badge de alerta en la pestaña superior de navegación
      const navBadge = document.getElementById('navAuditoriaBadge');
      if (navBadge) {
        navBadge.textContent = summary.discrepancyCount;
        navBadge.style.display = summary.discrepancyCount > 0 ? 'inline-block' : 'none';
      }

      const tableBody = document.getElementById('auditTableBody');
      if (!tableBody) return;

      const searchVal = (document.getElementById('auditSearchInput') && document.getElementById('auditSearchInput').value) || '';
      const aulaVal = (document.getElementById('auditAulaFilter') && document.getElementById('auditAulaFilter').value) || 'all';
      const statusVal = (document.getElementById('auditStatusFilter') && document.getElementById('auditStatusFilter').value) || 'all';

      // Sincronizar estado visual de los chips rápidos
      const chipIds = {
        'all': 'chipAuditAll',
        'discrepancy': 'chipAuditDiscrepancy',
        'matched': 'chipAuditMatched',
        'single': 'chipAuditSingle',
        'pending': 'chipAuditPending'
      };
      Object.keys(chipIds).forEach(k => {
        const chip = document.getElementById(chipIds[k]);
        if (chip) {
          if (k === statusVal) {
            chip.classList.add('active');
          } else {
            chip.classList.remove('active');
          }
        }
      });

      // Sincronizar estado visual de los KPIs clickeables
      const kpiMap = {
        'all': 'auditKpiTotal',
        'discrepancy': 'auditKpiDiscrepancies',
        'matched': 'auditKpiMatched',
        'single': 'auditKpiSingle',
        'pending': 'auditKpiPending'
      };
      document.querySelectorAll('#view-auditoria .kpi-card-clickable').forEach(c => c.classList.remove('active-kpi-filter'));
      if (kpiMap[statusVal]) {
        const kpiEl = document.getElementById(kpiMap[statusVal]);
        if (kpiEl && kpiEl.closest('.kpi-card-clickable')) {
          kpiEl.closest('.kpi-card-clickable').classList.add('active-kpi-filter');
        }
      }

      const items = window.AuditManager.filterStudents(statusVal, searchVal, aulaVal);

      if (items.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No se encontraron estudiantes para los filtros seleccionados.</td></tr>';
        return;
      }

      let html = '';
      items.forEach((item, index) => {
        const s = item.student;
        const a = item.audit;

        let actionBtn = '';
        if (a.status === 'discrepancia') {
          actionBtn = `<button class="btn btn-sm btn-danger-pill" onclick="window.AuditManager.openDiscrepancyModal('${s.id}')">⚖️ Resolver Discrepancia</button>`;
        } else if (a.status === 'carga_simple') {
          const sub = a.submissions[0];
          actionBtn = `
            <div class="d-flex gap-1 justify-content-end align-items-center">
              <button type="button" class="btn btn-sm btn-secondary-pill" onclick="window.AuditManager.openDiscrepancyModal('${s.id}')">Ver / Modificar</button>
              <button type="button" class="btn btn-sm btn-danger-pill" onclick="window.AuditManager.confirmDeleteSubmission('${s.id}', '${sub.preceptorUid}', '${sub.preceptorName}')" title="Anular y borrar esta carga errónea de ${sub.preceptorName}">🗑️ Anular</button>
            </div>
          `;
        } else if (a.submissions.length > 0) {
          actionBtn = `
            <div class="d-flex gap-1 justify-content-end align-items-center">
              <button type="button" class="btn btn-sm btn-secondary-pill" onclick="window.AuditManager.openDiscrepancyModal('${s.id}')">Ver Detalle</button>
              <button type="button" class="btn btn-sm btn-danger-pill" onclick="window.AuditManager.confirmResetStudentExam('${s.id}')" title="Anular y reiniciar examen">🗑️ Anular</button>
            </div>
          `;
        } else {
          actionBtn = `<button class="btn btn-sm btn-light-pill" onclick="window.app.switchTab('carga'); window.app.selectStudent('${s.id}');">Cargar</button>`;
        }

        const scoreDisplay = (a && typeof a.scoreTotal === 'number' && !isNaN(a.scoreTotal)) ? `<strong>${a.scoreTotal.toFixed(1)}</strong> / 10` : '-';

        html += `
          <tr class="${a.status === 'discrepancia' ? 'row-discrepancy' : ''}">
            <td class="text-center text-muted">${index + 1}</td>
            <td><strong>${s.apellido}, ${s.nombre}</strong></td>
            <td>${s.dni}</td>
            <td class="text-center"><span class="badge badge-aula">A${s.aula}</span></td>
            <td><small>${s.assignedName1} y ${s.assignedName2}</small></td>
            <td class="text-center"><span class="status-badge ${a.badgeClass}">${a.badgeText}</span></td>
            <td class="text-center">${a.loadsCount} / 2</td>
            <td class="text-center">${scoreDisplay}</td>
            <td class="text-end">${actionBtn}</td>
          </tr>
        `;
      });

      tableBody.innerHTML = html;
    }

    // --- VISTA DE ESTADÍSTICAS (SOLO DIRECTIVOS) ---

    renderAnalyticsView() {
      const stats = window.AnalyticsEngine.computeAllStats();

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('statAvgTotal', stats.avgTotal);
      setEl('statAvgMath', `${stats.avgMath} / 5.0`);
      setEl('statAvgLang', `${stats.avgLang} / 5.0`);
      setEl('statPassRate', `${stats.passRate}%`);
      setEl('statEvaluatedCount', `${stats.evaluatedCount} de ${stats.presentCount} presentes`);

      window.AnalyticsEngine.renderCharts();

      // Tabla de preguntas
      const qTable = document.getElementById('pedagogicalQuestionsTableBody');
      if (qTable) {
        let qHtml = '';
        stats.questionStats.forEach(q => {
          const badgeClass = q.successRate < 45 ? 'pill-danger' : (q.successRate < 70 ? 'pill-warning' : 'pill-success');
          qHtml += `
            <tr>
              <td class="text-center"><strong>P${q.n}</strong></td>
              <td>${q.subject}</td>
              <td><strong>${q.topic}</strong></td>
              <td><small class="text-muted">${q.criterion}</small></td>
              <td class="text-center"><strong>${q.successRate}%</strong> (${q.correctCount}/${q.total})</td>
              <td class="text-center"><span class="status-pill ${badgeClass}">${q.difficultyLabel}</span></td>
            </tr>
          `;
        });
        qTable.innerHTML = qHtml;
      }

      // Tabla de escuelas de procedencia
      const schoolTable = document.getElementById('schoolRankingTableBody');
      if (schoolTable) {
        let sHtml = '';
        stats.schoolStats.slice(0, 15).forEach((sc, idx) => {
          sHtml += `
            <tr>
              <td class="text-center text-muted">${idx + 1}</td>
              <td><strong>${sc.name}</strong></td>
              <td class="text-center">${sc.total}</td>
              <td class="text-center">${sc.evaluated}</td>
              <td class="text-center">${sc.avgScore !== null ? `<strong>${sc.avgScore.toFixed(2)}</strong>` : '-'}</td>
              <td class="text-center">${sc.passRate}%</td>
            </tr>
          `;
        });
        schoolTable.innerHTML = sHtml;
      }
    }

    // --- VISTA DE PADRÓN COMPLETO ---

    renderStudentsDirectory() {
      const tableBody = document.getElementById('directoryTableBody');
      if (!tableBody) return;

      const q = (document.getElementById('dirSearchInput') && document.getElementById('dirSearchInput').value.trim().toLowerCase()) || '';
      const aula = (document.getElementById('dirAulaFilter') && document.getElementById('dirAulaFilter').value) || 'all';
      const status = (document.getElementById('dirStatusFilter') && document.getElementById('dirStatusFilter').value) || 'all';
      const attend = (document.getElementById('dirAttendFilter') && document.getElementById('dirAttendFilter').value) || 'all';
      const school = (document.getElementById('dirSchoolFilter') && document.getElementById('dirSchoolFilter').value) || 'all';

      let students = window.DataService.getStudents();

      if (aula !== 'all') students = students.filter(s => s.aula === aula);
      if (attend !== 'all') {
        const isPres = attend === 'presente';
        students = students.filter(s => s.asistio === isPres);
      }
      if (school !== 'all') students = students.filter(s => s.escuela_origen === school);

      if (status === 'need_second') {
        students = students.filter(s => window.DataService.getSubmissionsForStudent(s.id).length === 1);
      } else if (status === 'zero_loads') {
        students = students.filter(s => window.DataService.getSubmissionsForStudent(s.id).length === 0);
      } else if (status === 'completed') {
        students = students.filter(s => window.DataService.getSubmissionsForStudent(s.id).length >= 2);
      }

      if (q) {
        students = students.filter(s => {
          return s.apellido.toLowerCase().includes(q) ||
                 s.nombre.toLowerCase().includes(q) ||
                 String(s.dni).includes(q) ||
                 (s.familiar && s.familiar.toLowerCase().includes(q)) ||
                 (s.escuela_origen && s.escuela_origen.toLowerCase().includes(q));
        });
      }

      const totalCountEl = document.getElementById('dirTotalCount');
      if (totalCountEl) totalCountEl.textContent = `${students.length} estudiantes`;

      if (students.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No se encontraron estudiantes para los filtros seleccionados.</td></tr>';
        return;
      }

      let html = '';
      students.forEach((s, idx) => {
        const subs = window.DataService.getSubmissionsForStudent(s.id);
        const audit = window.DataService.getStudentAuditStatus(s.id);
        const scoreStr = (audit && typeof audit.scoreTotal === 'number' && !isNaN(audit.scoreTotal)) ? `<strong>${audit.scoreTotal.toFixed(1)}</strong>` : '<span class="text-muted">-</span>';
        const cleanPhone = String(s.telefono || '').replace(/\D/g, '');

        let loadsBadge = '';
        if (subs.length === 0) {
          loadsBadge = '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8;">⏳ 0 de 2</span>';
        } else if (subs.length === 1) {
          loadsBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">⚡ 1/2 (${subs[0].preceptorName})</span>`;
        } else {
          loadsBadge = `<span class="badge badge-matched">✅ 2/2 (${subs.map(x => x.preceptorName).join(' + ')})</span>`;
        }

        html += `
          <tr>
            <td class="text-center text-muted">${idx + 1}</td>
            <td><strong>${s.apellido}, ${s.nombre}</strong></td>
            <td>${s.dni}</td>
            <td class="text-center"><span class="badge badge-aula">A${s.aula}</span></td>
            <td class="text-center">${loadsBadge}</td>
            <td class="text-center">
              <span class="status-pill ${s.asistio ? 'pill-success' : 'pill-danger'}">
                ${s.asistio ? 'Presente' : 'Ausente'}
              </span>
            </td>
            <td><small>${s.escuela_origen || 'No especificada'}</small></td>
            <td class="text-center">${scoreStr}</td>
            <td class="text-end">
              ${cleanPhone ? `
                <a href="https://wa.me/549${cleanPhone}" target="_blank" class="btn btn-icon btn-sm btn-success-subtle me-1" title="WhatsApp">
                  💬
                </a>
                <a href="tel:${cleanPhone}" class="btn btn-icon btn-sm btn-info-subtle me-1" title="Llamar">
                  📞
                </a>
              ` : ''}
              <button type="button" class="btn btn-sm btn-primary" onclick="window.app.jumpToGradeStudent('${s.id}')">
                🚀 Cargar
              </button>
            </td>
          </tr>
        `;
      });

      tableBody.innerHTML = html;
    }

    // --- VISTA DE EXPORTACIÓN ---

    renderExportView() {
      const previewBody = document.getElementById('exportPreviewTableBody');
      if (!previewBody) return;

      const consolidated = window.DataService.getConsolidatedResults();
      let html = '';

      const sorted = [...consolidated].sort((a, b) => (b.finalScore || -1) - (a.finalScore || -1));

      sorted.forEach((item, index) => {
        const s = item.student;
        const scoreDisplay = item.finalScore !== null ? item.finalScore.toFixed(1) : (s.asistio ? 'Pendiente' : 'Ausente');
        const mathDisplay = item.finalMath !== null ? item.finalMath.toFixed(1) : '-';
        const langDisplay = item.finalLang !== null ? item.finalLang.toFixed(1) : '-';

        html += `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td><strong>${s.apellido}, ${s.nombre}</strong></td>
            <td>${s.dni}</td>
            <td class="text-center">${s.aula}</td>
            <td class="text-center">${s.asistio ? 'Presente' : 'Ausente'}</td>
            <td>${s.escuela_origen || '-'}</td>
            <td class="text-center">${mathDisplay}</td>
            <td class="text-center">${langDisplay}</td>
            <td class="text-center"><strong>${scoreDisplay}</strong></td>
            <td class="text-center">${item.isPassed ? 'Aprobado' : (item.finalScore !== null ? 'Desaprobado' : '-')}</td>
          </tr>
        `;
      });

      previewBody.innerHTML = html;
    }

    exportToCSV() {
      const consolidated = window.DataService.getConsolidatedResults();
      const questions = window.EXAM_CONFIG.questions;

      const headers = [
        'Orden', 'ID', 'Apellido', 'Nombre', 'DNI', 'Aula', 'Asistio',
        'Preceptor_Asignado_1', 'Preceptor_Asignado_2',
        'Escuela de Origen', 'Tutor Familiar', 'Telefono', 'Email',
        'Tema Examen', 'Nota Matematica (max 5)', 'Nota Lengua (max 5)',
        'Nota Final (max 10)', 'Estado Aprobacion'
      ];

      for (let i = 1; i <= 20; i++) {
        headers.push(`P${i}_Resp`);
      }

      const rows = [headers];
      const sorted = [...consolidated].sort((a, b) => (b.finalScore || -1) - (a.finalScore || -1));

      sorted.forEach((item, index) => {
        const s = item.student;
        const row = [
          index + 1,
          s.id,
          `"${s.apellido}"`,
          `"${s.nombre}"`,
          s.dni,
          s.aula,
          s.asistio ? 'SI' : 'NO',
          `"${s.assignedName1}"`,
          `"${s.assignedName2}"`,
          `"${s.escuela_origen || ''}"`,
          `"${s.familiar || ''}"`,
          `"${s.telefono || ''}"`,
          `"${s.email || ''}"`,
          item.tema || '',
          item.finalMath !== null ? item.finalMath : '',
          item.finalLang !== null ? item.finalLang : '',
          item.finalScore !== null ? item.finalScore : '',
          item.isPassed === true ? 'APROBADO' : (item.isPassed === false ? 'DESAPROBADO' : '')
        ];

        for (let i = 1; i <= 20; i++) {
          row.push((item.answers && item.answers[i]) || '');
        }

        rows.push(row);
      });

      const csvContent = '\uFEFF' + rows.map(e => e.join(';')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Examen_Ingreso_2027_Resultados_Oficiales_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('Archivo CSV generado y descargado correctamente', 'success');
    }

    printOfficialActa() {
      window.print();
    }

    // --- UTILIDADES Y FILTROS ---

    populateClassroomFilters() {
      const aulas = window.DataService.getAulas();
      const selects = ['studentAulaFilter', 'auditAulaFilter', 'dirAulaFilter', 'myProgressAulaFilter'];

      selects.forEach(selectId => {
        const el = document.getElementById(selectId);
        if (el) {
          const curVal = el.value || 'all';
          el.innerHTML = '<option value="all">Todas las Aulas</option>' +
            aulas.map(a => `<option value="${a}" ${curVal === a ? 'selected' : ''}>Aula ${a}</option>`).join('');
        }
      });
    }

    populateSchoolFilters() {
      const schools = window.DataService.getEscuelas();
      const el = document.getElementById('dirSchoolFilter');
      if (el) {
        el.innerHTML = '<option value="all">Todas las Escuelas de Origen</option>' +
          schools.map(sc => `<option value="${sc.name}">${sc.name} (${sc.count})</option>`).join('');
      }
    }

    updateUserProfileUI() {
      const cur = window.DataService.getCurrentUser();
      const profileNameEl = document.getElementById('navUserProfileName');
      const profileRoleBadge = document.getElementById('navUserProfileRole');
      const navAvatar = document.getElementById('navUserAvatar');

      if (!cur) return;

      if (profileNameEl) profileNameEl.textContent = cur.name;
      if (navAvatar) navAvatar.textContent = cur.name.charAt(0);
      if (profileRoleBadge) {
        profileRoleBadge.textContent = cur.role.toUpperCase();
        profileRoleBadge.className = `badge ${cur.isAdmin ? 'badge-primary' : 'badge-preceptor'}`;
      }

      // Control estricto de visibilidad de pestañas según rol institucional
      const navBtnCarga = document.getElementById('navBtnCarga');
      const navBtnMiProgreso = document.getElementById('navBtnMiProgreso');
      const navBtnMonitorPreceptores = document.getElementById('navBtnMonitorPreceptores');
      const navBtnAuditoria = document.getElementById('navBtnAuditoria');
      const navBtnEstadisticas = document.getElementById('navBtnEstadisticas');
      const navBtnEstudiantes = document.getElementById('navBtnEstudiantes');
      const navBtnExportar = document.getElementById('navBtnExportar');

      if (cur.isAdmin) {
        // Director y Vicedirección: ven TODO el sistema
        if (navBtnCarga) navBtnCarga.style.display = 'flex';
        if (navBtnMiProgreso) navBtnMiProgreso.style.display = 'none';
        if (navBtnMonitorPreceptores) navBtnMonitorPreceptores.style.display = 'flex';
        if (navBtnAuditoria) navBtnAuditoria.style.display = 'flex';
        if (navBtnEstadisticas) navBtnEstadisticas.style.display = 'flex';
        if (navBtnEstudiantes) navBtnEstudiantes.style.display = 'flex';
        if (navBtnExportar) navBtnExportar.style.display = 'flex';
      } else {
        // Preceptores: solo ven su carga, su dashboard personal de carga y el padrón de contactos
        if (navBtnCarga) navBtnCarga.style.display = 'flex';
        if (navBtnMiProgreso) navBtnMiProgreso.style.display = 'flex';
        if (navBtnEstudiantes) navBtnEstudiantes.style.display = 'flex';
        if (navBtnMonitorPreceptores) navBtnMonitorPreceptores.style.display = 'none';
        if (navBtnAuditoria) navBtnAuditoria.style.display = 'none';
        if (navBtnEstadisticas) navBtnEstadisticas.style.display = 'none';
        if (navBtnExportar) navBtnExportar.style.display = 'none';

        if (['monitor-preceptores', 'auditoria', 'estadisticas', 'exportar'].includes(this.currentTab)) {
          this.switchTab('mi-progreso');
        }
      }
    }

    jumpToGradeStudent(studentId) {
      this.switchTab('carga');
      this.selectStudent(studentId);
      this.scrollSelectedStudentIntoView();
    }

    // --- DASHBOARD PERSONAL: MI PROGRESO DE CARGA (PRECEPTORES) ---

    renderMiProgresoView() {
      const cur = window.DataService.getCurrentUser();
      if (!cur) return;

      const progress = window.DataService.getPreceptorProgress(cur.uid);
      if (!progress) return;

      const nameEl = document.getElementById('myProgressPreceptorName');
      const percentLbl = document.getElementById('myProgressPercentLabel');
      const ratioLbl = document.getElementById('myProgressRatioLabel');
      const barFill = document.getElementById('myProgressBarFill');

      if (nameEl) nameEl.textContent = cur.name;
      if (percentLbl) percentLbl.textContent = `${progress.percent}%`;
      if (ratioLbl) {
        if (progress.unsyncedCount > 0) {
          ratioLbl.innerHTML = `<strong>${progress.loadedCount}</strong> de ${progress.totalAssigned} exámenes evaluados <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); margin-left: 6px;">⚠️ ${progress.unsyncedCount} por subir a la nube</span>`;
        } else {
          ratioLbl.textContent = `${progress.loadedCount} de ${progress.totalAssigned} exámenes evaluados`;
        }
      }
      if (barFill) {
        barFill.style.width = `${progress.percent}%`;
        barFill.className = `progress-bar-fill ${progress.percent >= 100 ? 'success' : (progress.percent > 0 ? '' : 'warning')}`;
      }

      const kpiAssigned = document.getElementById('myKpiAssigned');
      const kpiLoaded = document.getElementById('myKpiLoaded');
      const kpiPending = document.getElementById('myKpiPending');
      const kpiMatched = document.getElementById('myKpiMatched');

      if (kpiAssigned) kpiAssigned.textContent = progress.totalAssigned;
      if (kpiLoaded) {
        kpiLoaded.textContent = progress.loadedCount;
        if (progress.unsyncedCount > 0) {
          kpiLoaded.title = `${progress.unsyncedCount} exámenes guardados en esta PC aún no sincronizados con Firebase. Presioná 'Sincronizar Nube' para subirlos.`;
        } else {
          kpiLoaded.title = 'Todos tus exámenes están sincronizados en Firebase Firestore.';
        }
      }
      if (kpiPending) kpiPending.textContent = progress.pendingCount;
      if (kpiMatched) kpiMatched.textContent = progress.matchedWithPartner;

      // Filtros de tabla
      const searchInput = document.getElementById('myProgressSearchInput');
      const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const aulaFilter = document.getElementById('myProgressAulaFilter');
      const selectedAula = aulaFilter ? aulaFilter.value : 'all';
      const statusFilter = document.getElementById('myProgressStatusFilter');
      const selectedStatus = statusFilter ? statusFilter.value : 'all';

      let list = progress.studentDetails;

      if (selectedAula !== 'all') {
        list = list.filter(item => item.student.aula === selectedAula);
      }

      if (selectedStatus === 'pending_me') {
        list = list.filter(item => !item.isLoadedByMe);
      } else if (selectedStatus === 'loaded_me') {
        list = list.filter(item => item.isLoadedByMe);
      } else if (selectedStatus === 'matched') {
        list = list.filter(item => item.matchStatus === 'coincidente');
      } else if (selectedStatus === 'discrepancy') {
        list = list.filter(item => item.matchStatus === 'discrepancia');
      }

      if (q) {
        list = list.filter(item => {
          const s = item.student;
          return s.apellido.toLowerCase().includes(q) ||
                 s.nombre.toLowerCase().includes(q) ||
                 String(s.dni).includes(q);
        });
      }

      const countBadge = document.getElementById('myProgressCountBadge');
      if (countBadge) countBadge.textContent = `${list.length} de ${progress.totalAssigned} asignados`;

      const tbody = document.getElementById('myProgressTableBody');
      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No se encontraron estudiantes para los filtros seleccionados</td></tr>`;
        return;
      }

      let html = '';
      list.forEach(item => {
        const s = item.student;
        const myScoreBadge = item.isLoadedByMe
          ? (item.isSyncedInCloud === false
              ? `<span class="status-pill pill-warning" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);" title="Guardado en este navegador. Falta subir a Firebase.">💾 En PC (Pendiente)</span>`
              : `<span class="status-pill pill-success" title="Sincronizado en Firebase Firestore">✅ Cargado</span>`)
          : `<span class="status-pill pill-warning">⏳ Pendiente</span>`;

        const partnerScoreBadge = item.isLoadedByPartner
          ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">✅ Cargó (${item.partnerScore !== null ? item.partnerScore.toFixed(1) : '-'} pts)</span>`
          : `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8;">⏳ Falta cargar</span>`;

        let dualBadge = '';
        if (item.matchStatus === 'coincidente') {
          dualBadge = `<span class="badge badge-matched">✅ Coincidente (100%)</span>`;
        } else if (item.matchStatus === 'discrepancia') {
          dualBadge = `<span class="badge badge-discrepancy">⚠️ Discrepancia</span>`;
        } else if (item.matchStatus === 'partner_pending') {
          dualBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">⏳ Esperando colega</span>`;
        } else if (item.matchStatus === 'my_pending') {
          dualBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">⏳ Pendiente tu carga</span>`;
        } else {
          dualBadge = `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8;">⏳ Sin iniciar</span>`;
        }

        html += `
          <tr>
            <td class="text-center">${s.nro}</td>
            <td><strong>${s.apellido}, ${s.nombre}</strong></td>
            <td>${s.dni}</td>
            <td class="text-center"><span class="badge-aula">Aula ${s.aula}</span></td>
            <td class="text-center">${myScoreBadge}</td>
            <td class="text-center"><strong>${item.isLoadedByMe && item.myScore !== null ? item.myScore.toFixed(1) : '-'}</strong></td>
            <td>${item.partnerName}</td>
            <td class="text-center">${partnerScoreBadge}<br>${dualBadge}</td>
            <td class="text-end">
              <button type="button" class="btn ${item.isLoadedByMe ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="window.app.jumpToGradeStudent('${s.id}')">
                ${item.isLoadedByMe ? '✏️ Ver / Editar' : '🚀 Cargar Ahora'}
              </button>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
    }

    // --- MONITOR INSTITUCIONAL DE PRECEPTORES (DIRECCIÓN / VICEDIRECCIÓN) ---

    renderMonitorPreceptoresView() {
      const allProgress = window.DataService.getAllPreceptorsProgress();
      if (!allProgress || allProgress.length === 0) return;

      const totalNeeded = window.DataService.getTotalLoadsNeeded();
      const totalExams = window.DataService.getTotalExamsTaken();
      const totalDone = allProgress.reduce((sum, p) => sum + (p ? p.loadedCount : 0), 0);
      const globalPercent = Math.round((totalDone / totalNeeded) * 100);

      const allStudents = window.DataService.getStudents();
      let doubleCompleteCount = 0;
      let discrepanciesCount = 0;

      allStudents.forEach(st => {
        const audit = window.DataService.getStudentAuditStatus(st.id);
        if (audit.loadsCount >= 2) doubleCompleteCount++;
        if (audit.status === 'discrepancia') discrepanciesCount++;
      });

      const kpiTotalDone = document.getElementById('monitorKpiTotalDone');
      const kpiGlobalPercent = document.getElementById('monitorKpiGlobalPercent');
      const kpiDoubleComplete = document.getElementById('monitorKpiDoubleComplete');
      const kpiDiscrepancies = document.getElementById('monitorKpiDiscrepancies');

      if (kpiTotalDone) kpiTotalDone.textContent = `${totalDone} de ${totalNeeded}`;
      if (kpiGlobalPercent) kpiGlobalPercent.textContent = `${globalPercent}%`;
      if (kpiDoubleComplete) kpiDoubleComplete.textContent = `${doubleCompleteCount} de ${totalExams} (${Math.round((doubleCompleteCount / totalExams) * 100)}%)`;
      const kpiTotalNeeded = document.getElementById('monitorKpiTotalNeeded');
      if (kpiTotalNeeded) kpiTotalNeeded.textContent = totalNeeded;
      if (kpiDiscrepancies) kpiDiscrepancies.textContent = discrepanciesCount;

      const navBadge = document.getElementById('navAuditoriaBadge');
      if (navBadge) {
        navBadge.textContent = discrepanciesCount;
        navBadge.style.display = discrepanciesCount > 0 ? 'inline-block' : 'none';
      }

      const cardsContainer = document.getElementById('preceptorsCardsContainer');
      const selectedPreceptorFilter = document.getElementById('monitorPreceptorSelect') ? document.getElementById('monitorPreceptorSelect').value : 'all';

      if (cardsContainer) {
        cardsContainer.innerHTML = allProgress.map(p => {
          if (!p) return '';
          const initial = p.preceptor.name.charAt(0);
          const isSelected = selectedPreceptorFilter === p.preceptor.uid;

          return `
            <div class="preceptor-card ${isSelected ? 'active-filter' : ''}" onclick="window.app.filterMonitorByPreceptor('${p.preceptor.uid}')" title="Clic para filtrar listado">
              <div class="preceptor-card-header">
                <div class="preceptor-avatar-large" style="background: ${p.preceptor.color || '#8b5cf6'};">
                  ${initial}
                </div>
                <div class="preceptor-meta">
                  <div class="preceptor-name">${p.preceptor.name}</div>
                  <div class="preceptor-email">${p.preceptor.email}</div>
                </div>
              </div>

              <div class="progress-widget">
                <div class="progress-header">
                  <span>Progreso: <strong style="color: var(--color-accent);">${p.percent}%</strong></span>
                  <span style="color: var(--text-muted); font-size: 0.72rem;">${p.loadedCount}/${p.totalAssigned}</span>
                </div>
                <div class="progress-bar-track">
                  <div class="progress-bar-fill ${p.percent >= 100 ? 'success' : ''}" style="width: ${p.percent}%;"></div>
                </div>
              </div>

              <div class="preceptor-stats-pills">
                <div class="stat-mini-pill">
                  <span class="stat-mini-val" style="color: #34d399;">${p.loadedCount}</span>
                  <span class="stat-mini-lbl">Cargados</span>
                </div>
                <div class="stat-mini-pill">
                  <span class="stat-mini-val" style="color: #fbbf24;">${p.pendingCount}</span>
                  <span class="stat-mini-lbl">Pendientes</span>
                </div>
                <div class="stat-mini-pill">
                  <span class="stat-mini-val" style="color: #c084fc;">${p.matchedWithPartner}</span>
                  <span class="stat-mini-lbl">Coincidentes</span>
                </div>
                <div class="stat-mini-pill">
                  <span class="stat-mini-val" style="color: #f87171;">${p.discrepancyWithPartner}</span>
                  <span class="stat-mini-lbl">Discrepancias</span>
                </div>
              </div>

              <button type="button" class="btn btn-secondary btn-sm w-100 mt-1" style="font-size: 0.75rem;">
                🔍 ${isSelected ? 'Quitar Filtro' : `Filtrar Alumnos (${p.totalAssigned})`}
              </button>
            </div>
          `;
        }).join('');
      }

      this.renderPreceptorsChart(allProgress);
      this.renderMonitorPreceptoresTable();
    }

    filterMonitorByPreceptor(uid) {
      const select = document.getElementById('monitorPreceptorSelect');
      if (select) {
        select.value = select.value === uid ? 'all' : uid;
        this.renderMonitorPreceptoresView();
      }
    }

    renderPreceptorsChart(allProgress) {
      const canvas = document.getElementById('chartPreceptorsProgress');
      if (!canvas) return;

      if (window.chartPreceptorsInstance) {
        window.chartPreceptorsInstance.destroy();
      }

      const labels = allProgress.map(p => p.preceptor.name);
      const dataLoaded = allProgress.map(p => p.loadedCount);
      const dataPending = allProgress.map(p => p.pendingCount);

      const ctx = canvas.getContext('2d');
      window.chartPreceptorsInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Exámenes Evaluados',
              data: dataLoaded,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              borderColor: '#10b981',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'Exámenes Pendientes',
              data: dataPending,
              backgroundColor: 'rgba(245, 158, 11, 0.45)',
              borderColor: '#f59e0b',
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { family: 'Outfit', weight: '600' } }
            },
            y: {
              stacked: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', stepSize: 10 }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { color: '#f1f5f9', font: { family: 'Outfit', size: 12 } }
            },
            tooltip: {
              callbacks: {
                afterBody: (context) => {
                  const idx = context[0].dataIndex;
                  const prog = allProgress[idx];
                  return `Avance: ${prog.percent}% (${prog.loadedCount} de ${prog.totalAssigned})`;
                }
              }
            }
          }
        }
      });
    }

    renderMonitorPreceptoresTable() {
      const selectPreceptor = document.getElementById('monitorPreceptorSelect');
      const selectedUid = selectPreceptor ? selectPreceptor.value : 'all';

      const selectStatus = document.getElementById('monitorStatusFilter');
      const selectedStatus = selectStatus ? selectStatus.value : 'all';

      const searchInput = document.getElementById('monitorSearchInput');
      const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

      let students = window.DataService.getStudents();

      if (selectedUid !== 'all') {
        students = students.filter(s => s.assignedUid1 === selectedUid || s.assignedUid2 === selectedUid);
      }

      if (q) {
        students = students.filter(s => {
          return s.apellido.toLowerCase().includes(q) ||
                 s.nombre.toLowerCase().includes(q) ||
                 String(s.dni).includes(q);
        });
      }

      if (selectedStatus !== 'all') {
        students = students.filter(s => {
          const audit = window.DataService.getStudentAuditStatus(s.id);
          const subs = audit.submissions;

          if (selectedStatus === 'loaded') {
            if (selectedUid !== 'all') {
              return subs.some(x => x.preceptorUid === selectedUid);
            }
            return subs.length > 0;
          } else if (selectedStatus === 'pending') {
            if (selectedUid !== 'all') {
              return !subs.some(x => x.preceptorUid === selectedUid);
            }
            return subs.length < 2;
          } else if (selectedStatus === 'discrepancy') {
            return audit.status === 'discrepancia';
          } else if (selectedStatus === 'matched') {
            return audit.status === 'coincidente';
          }
          return true;
        });
      }

      const countBadge = document.getElementById('monitorTableCountBadge');
      if (countBadge) countBadge.textContent = `${students.length} exámenes`;

      const tbody = document.getElementById('monitorDetailTableBody');
      if (!tbody) return;

      if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No se encontraron registros con los filtros aplicados.</td></tr>`;
        return;
      }

      let html = '';
      students.forEach(st => {
        const audit = window.DataService.getStudentAuditStatus(st.id);
        const sub1 = audit.submissions.find(x => x.preceptorUid === st.assignedUid1);
        const sub2 = audit.submissions.find(x => x.preceptorUid === st.assignedUid2);

        const sub1Badge = sub1
          ? `<span class="status-pill pill-success">✅ Nota: ${sub1.scoreTotal.toFixed(1)}</span>`
          : `<span class="status-pill pill-warning">⏳ Pendiente</span>`;

        const sub2Badge = sub2
          ? `<span class="status-pill pill-success">✅ Nota: ${sub2.scoreTotal.toFixed(1)}</span>`
          : `<span class="status-pill pill-warning">⏳ Pendiente</span>`;

        let matchBadge = '';
        if (audit.status === 'coincidente') {
          matchBadge = `<span class="badge badge-matched">✅ Coincidente (${typeof audit.scoreTotal === 'number' ? audit.scoreTotal.toFixed(1) : '-'})</span>`;
        } else if (audit.status === 'discrepancia') {
          matchBadge = `<span class="badge badge-discrepancy">⚠️ Discrepancia (${audit.discrepancyCount})</span>`;
        } else if (audit.status === 'resuelta') {
          matchBadge = `<span class="badge badge-resolved">⚖️ Resuelta (${typeof audit.scoreTotal === 'number' ? audit.scoreTotal.toFixed(1) : '-'})</span>`;
        } else if (audit.status === 'carga_simple') {
          matchBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">📝 Carga Simple (1/2)</span>`;
        } else {
          matchBadge = `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8;">⏳ Sin Cargar (0/2)</span>`;
        }

        const canAudit = audit.status === 'discrepancia';

        html += `
          <tr class="${canAudit ? 'row-discrepancy' : ''}">
            <td class="text-center">${st.nro}</td>
            <td><strong>${st.apellido}, ${st.nombre}</strong></td>
            <td>${st.dni}</td>
            <td class="text-center"><span class="badge-aula">Aula ${st.aula}</span></td>
            <td><strong>${st.assignedName1}</strong></td>
            <td class="text-center">${sub1Badge}</td>
            <td><strong>${st.assignedName2}</strong></td>
            <td class="text-center">${sub2Badge}</td>
            <td class="text-center">${matchBadge}</td>
            <td class="text-end">
              ${canAudit ? `
                <button type="button" class="btn btn-sm btn-danger-pill" onclick="window.AuditManager.openDiscrepancyModal('${st.id}')">
                  ⚖️ Resolver Discrepancia
                </button>
              ` : `
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.app.jumpToGradeStudent('${st.id}')">
                  ✏️ Ver
                </button>
              `}
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
    }

    updateFirebaseStatusBadge(detail) {
      const badge = document.getElementById('firebaseStatusBadge');
      if (badge) {
        if (detail.status === 'online') {
          badge.textContent = '🟢 Online (Firestore)';
          badge.className = 'status-pill pill-success';
          badge.title = detail.message;
        } else if (detail.status === 'quota-exceeded') {
          badge.textContent = '⚠️ Cuota Firebase Agotada';
          badge.className = 'status-pill pill-danger';
          badge.title = 'Cuota diaria gratuita (Spark) de Firebase alcanzada. Actualizar a Plan Blaze en Firebase Console para continuar ilimitado.';
        } else if (detail.status === 'locked') {
          badge.textContent = '🔒 Reglas bloqueadas en Firebase';
          badge.className = 'status-pill pill-danger';
          badge.title = 'Faltan habilitar las Reglas en Firebase Console (pestaña Reglas)';
        } else if (detail.status === 'connecting') {
          badge.textContent = '🟡 Conectando...';
          badge.className = 'status-pill pill-warning';
        } else {
          badge.textContent = '🔴 Desconectado';
          badge.className = 'status-pill pill-danger';
        }
      }
      this.updateSyncButtonState();
    }

    updateSyncButtonState() {
      const btn = document.getElementById('btnForceSync');
      if (!btn || btn.disabled) return;

      const unsyncedTotal = window.FirebaseSyncService && window.FirebaseSyncService.getUnsyncedLocalCount
        ? window.FirebaseSyncService.getUnsyncedLocalCount()
        : 0;

      if (unsyncedTotal > 0) {
        btn.innerHTML = `☁️ Sincronizar Nube <span class="badge" style="background: #ef4444; color: #ffffff; padding: 2px 7px; border-radius: 999px; margin-left: 5px; font-weight: 700;">${unsyncedTotal}</span>`;
        btn.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.4)';
        btn.title = `Hay ${unsyncedTotal} examen(es) guardados en esta PC que aún no se subieron a Firebase. Hacé clic para subirlos ahora.`;
      } else {
        btn.innerHTML = '☁️ Sincronizar Nube';
        btn.style.boxShadow = '';
        btn.title = 'Subir inmediatamente todas las calificaciones guardadas en esta computadora a Firebase Firestore';
      }
    }

    async triggerManualSync() {
      const btn = document.getElementById('btnForceSync');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Subiendo a la nube...';
      }

      this.showToast('Verificando exámenes con Firebase Firestore y sincronizando...', 'info');

      try {
        const res = await window.FirebaseSyncService.syncAllLocalToCloud({ forceCheckServer: true });
        if (res.quotaExceeded) {
          this.showToast(`⚠️ Cuota diaria de Firebase agotada (Spark Plan). Los datos quedan seguros en tu PC. Para sincronizar ya mismo se debe activar el Plan Blaze en Firebase Console.`, 'danger');
        } else if (res.synced > 0) {
          this.showToast(`✅ ¡Éxito! Se subieron y sincronizaron ${res.synced} examen(es) a Firebase Firestore en la nube.`, 'success');
        } else if (res.allUpToDate) {
          this.showToast(`ℹ️ Todo al día: todos los exámenes de esta computadora ya están sincronizados en Firebase.`, 'info');
        } else if (res.failed > 0) {
          this.showToast(`🔒 Hubo un problema al subir (${res.failed} fallaron). Revisá permisos o conexión.`, 'danger');
        } else {
          this.showToast(`ℹ️ Todo al día: no hay exámenes pendientes de subir en esta computadora.`, 'info');
        }
      } catch (e) {
        if (e.message && (e.message.includes('Quota exceeded') || e.message.includes('resource-exhausted'))) {
          this.showToast(`⚠️ Cuota diaria de Firebase agotada (Spark Plan). Es necesario habilitar Plan Blaze en Firebase Console.`, 'danger');
        } else {
          this.showToast(`Error al sincronizar: ${e.message}`, 'danger');
        }
      } finally {
        if (btn) {
          btn.disabled = false;
        }
        this.updateSyncButtonState();
        this.renderAll();
      }
    }

    showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `custom-toast toast-${type} animate-slide-in`;
      toast.innerHTML = `
        <div class="toast-body">
          <span>${message}</span>
        </div>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 400);
      }, 3500);
    }

    renderAll() {
      this.updateSyncButtonState();
      if (this.currentTab === 'carga') {
        this.renderStudentSearchList();
        this.renderSelectedStudentCard();
        this.renderAnswerSheet();
        this.updateLiveScorecard();
      } else if (this.currentTab === 'mi-progreso') {
        this.renderMiProgresoView();
      } else if (this.currentTab === 'monitor-preceptores') {
        this.renderMonitorPreceptoresView();
      } else if (this.currentTab === 'auditoria') {
        this.renderAuditView();
      } else if (this.currentTab === 'estadisticas') {
        this.renderAnalyticsView();
      } else if (this.currentTab === 'estudiantes') {
        this.renderStudentsDirectory();
      } else if (this.currentTab === 'exportar') {
        this.renderExportView();
      }
    }

    handleImportBackupFile(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          this.showToast('Importando archivo de respaldo y sincronizando con Firebase...', 'info');
          const res = await window.FirebaseSyncService.importLocalBackup(content);
          if (res.success) {
            this.showToast(`✅ Se importaron ${res.count} exámenes exitosamente a esta PC y a la nube.`, 'success');
            this.renderAll();
          } else {
            this.showToast(`Error al importar: ${res.error}`, 'danger');
          }
        } catch (err) {
          this.showToast(`Error leyendo archivo: ${err.message}`, 'danger');
        } finally {
          event.target.value = '';
        }
      };
      reader.readAsText(file);
    }
  }

  window.app = new AppController();

  document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
  });
})();
