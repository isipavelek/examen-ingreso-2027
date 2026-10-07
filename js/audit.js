/**
 * Audit & Dual-Entry Engine - Examen de Ingreso 2027
 * Escuela Secundaria Técnica - UTN - San Miguel
 * Validación cruzada entre perfiles de carga, detección y resolución de discrepancias.
 */

(function () {
  class AuditManager {
    constructor() {
      this.selectedStudentId = null;
      this.currentFilter = 'all'; // 'all' | 'discrepancy' | 'matched' | 'single' | 'pending'
    }

    getAuditSummary() {
      const students = window.DataService.getStudents();
      let matchedCount = 0;
      let discrepancyCount = 0;
      let singleCount = 0;
      let pendingCount = 0;
      let resolvedCount = 0;

      students.forEach(s => {
        const audit = window.DataService.getStudentAuditStatus(s.id);
        if (audit.status === 'coincidente') matchedCount++;
        else if (audit.status === 'discrepancia') discrepancyCount++;
        else if (audit.status === 'carga_simple') singleCount++;
        else if (audit.status === 'resuelta') resolvedCount++;
        else pendingCount++;
      });

      return {
        total: students.length,
        matchedCount,
        discrepancyCount,
        singleCount,
        pendingCount,
        resolvedCount,
        completedValidated: matchedCount + resolvedCount
      };
    }

    filterStudents(filterType, searchQuery = '', aulaFilter = '') {
      let list = window.DataService.getStudents().map(s => {
        return {
          student: s,
          audit: window.DataService.getStudentAuditStatus(s.id)
        };
      });

      if (filterType && filterType !== 'all') {
        if (filterType === 'discrepancy') {
          list = list.filter(item => item.audit.status === 'discrepancia');
        } else if (filterType === 'matched') {
          list = list.filter(item => item.audit.status === 'coincidente' || item.audit.status === 'resuelta');
        } else if (filterType === 'single') {
          list = list.filter(item => item.audit.status === 'carga_simple');
        } else if (filterType === 'pending') {
          list = list.filter(item => item.audit.status === 'sin_cargar');
        }
      }

      if (aulaFilter && aulaFilter !== 'all') {
        list = list.filter(item => item.student.aula === aulaFilter);
      }

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        list = list.filter(item => {
          const s = item.student;
          return s.apellido.toLowerCase().includes(q) ||
                 s.nombre.toLowerCase().includes(q) ||
                 String(s.dni).includes(q) ||
                 (s.familiar && s.familiar.toLowerCase().includes(q));
        });
      }

      return list;
    }

    openModal(studentId) {
      return this.openDiscrepancyModal(studentId);
    }

    toggleDiffView(onlyDiffs) {
      this.showOnlyDiffs = onlyDiffs;
      if (this.selectedStudentId) {
        this.renderDiffTable(this.selectedStudentId);
      }
      const btnOnly = document.getElementById('btnToggleOnlyDiffs');
      const btnAll = document.getElementById('btnToggleAllQuestions');
      if (btnOnly) btnOnly.className = `diff-toggle-btn ${onlyDiffs ? 'active btn-danger-mode' : ''}`;
      if (btnAll) btnAll.className = `diff-toggle-btn ${!onlyDiffs ? 'active' : ''}`;
    }

    updateOfficialTema(tema) {
      this.officialTema = tema;
      if (this.selectedStudentId) {
        this.renderDiffTable(this.selectedStudentId);
      }
    }

    openDiscrepancyModal(studentId) {
      this.selectedStudentId = studentId;
      this.showOnlyDiffs = true;
      const student = window.DataService.getStudentById(studentId);
      const audit = window.DataService.getStudentAuditStatus(studentId);
      const modal = document.getElementById('modalAuditDiff');
      if (!modal) return;

      const titleEl = document.getElementById('auditModalStudentName');
      const infoEl = document.getElementById('auditModalStudentInfo');
      const badgeEl = document.getElementById('auditModalBadge');
      const compareCardsEl = document.getElementById('auditModalCompareCards');
      const temaAlertEl = document.getElementById('auditModalTemaAlert');

      if (titleEl) titleEl.textContent = `${student.apellido}, ${student.nombre}`;
      if (badgeEl) {
        if (audit.status === 'discrepancia') {
          badgeEl.className = 'status-pill pill-danger';
          badgeEl.textContent = audit.badgeText;
        } else if (audit.status === 'resuelta') {
          badgeEl.className = 'status-pill pill-success';
          badgeEl.textContent = '⚖️ Resuelta por Dirección';
        } else if (audit.status === 'coincidente') {
          badgeEl.className = 'status-pill pill-success';
          badgeEl.textContent = '✅ Carga Coincidente';
        } else {
          badgeEl.className = 'status-pill pill-warning';
          badgeEl.textContent = audit.badgeText;
        }
      }

      if (infoEl) {
        infoEl.innerHTML = `
          <span><strong>DNI:</strong> ${student.dni}</span> &bull; 
          <span><strong>Aula:</strong> Aula ${student.aula}</span> &bull; 
          <span><strong>Nro Ord:</strong> #${student.nro}</span> &bull; 
          <span><strong>Escuela de Origen:</strong> ${student.escuela_origen || 'No especificada'}</span>
        `;
      }

      const subs = audit.submissions;

      // 1. Alerta de Discrepancia de Tema (A vs B)
      if (temaAlertEl) {
        if (subs.length >= 2 && subs[0].tema !== subs[1].tema) {
          this.officialTema = subs[0].tema;
          temaAlertEl.innerHTML = `
            <div class="tema-alert-box">
              <div style="font-weight: 700; color: #f87171; font-size: 0.95rem; margin-bottom: 0.35rem;">
                ⚠️ ALERTA: DISCREPANCIA EN EL TEMA DEL EXAMEN
              </div>
              <p style="font-size: 0.85rem; color: #fca5a5; margin-bottom: 0.5rem;">
                <strong>${subs[0].preceptorName}</strong> cargó <strong>Tema ${subs[0].tema}</strong> y 
                <strong>${subs[1].preceptorName}</strong> cargó <strong>Tema ${subs[1].tema}</strong>.
                Por favor verificá en la hoja física del alumno cuál fue el Tema rendido:
              </p>
              <div class="d-flex align-items-center gap-3">
                <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-main);">Tema Oficial del examen en papel:</span>
                <label style="cursor: pointer; font-size: 0.85rem; color: #60a5fa;">
                  <input type="radio" name="officialTemaRadio" value="A" ${this.officialTema === 'A' ? 'checked' : ''} onchange="window.AuditManager.updateOfficialTema('A')"> <strong>Tema A</strong>
                </label>
                <label style="cursor: pointer; font-size: 0.85rem; color: #c084fc;">
                  <input type="radio" name="officialTemaRadio" value="B" ${this.officialTema === 'B' ? 'checked' : ''} onchange="window.AuditManager.updateOfficialTema('B')"> <strong>Tema B</strong>
                </label>
              </div>
            </div>
          `;
        } else {
          this.officialTema = (subs[0] && subs[0].tema) || 'A';
          temaAlertEl.innerHTML = '';
        }
      }

      // 2. Tarjetas comparativas enfrentadas
      if (compareCardsEl) {
        if (subs.length < 2) {
          compareCardsEl.innerHTML = `
            <div class="p-3 text-muted text-center w-100" style="grid-column: 1 / -1; background: rgba(15, 23, 42, 0.5); border-radius: var(--radius-md);">
              Este alumno tiene ${subs.length} carga(s) registrada(s). Se requieren 2 cargas de distintos preceptores para auditar discrepancias.
            </div>
          `;
        } else {
          const p1 = subs[0];
          const p2 = subs[1];
          const initial1 = p1.preceptorName ? p1.preceptorName.charAt(0) : '1';
          const initial2 = p2.preceptorName ? p2.preceptorName.charAt(0) : '2';

          compareCardsEl.innerHTML = `
            <div class="audit-preceptor-card">
              <div class="audit-preceptor-header">
                <div class="audit-preceptor-avatar" style="background: #10b981;">${initial1}</div>
                <div>
                  <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${p1.preceptorName} (Carga 1)</div>
                  <small class="text-muted">Tema cargado: <strong style="color: #60a5fa;">Tema ${p1.tema}</strong></small>
                </div>
              </div>
              <div class="audit-preceptor-scores">
                <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">Matemática: ${p1.scoreMath !== null ? p1.scoreMath.toFixed(1) : '-'} / 5</span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">Lengua: ${p1.scoreLang !== null ? p1.scoreLang.toFixed(1) : '-'} / 5</span>
                <span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #c084fc; font-weight: 700;">Nota Total: ${p1.scoreTotal !== null ? p1.scoreTotal.toFixed(1) : '-'} / 10</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm mt-1" onclick="window.AuditManager.resolveFast('${studentId}', 0)" title="Acepta todas las respuestas cargadas por ${p1.preceptorName}">
                ✅ Aceptar Todo de ${p1.preceptorName}
              </button>
            </div>

            <div class="audit-preceptor-card">
              <div class="audit-preceptor-header">
                <div class="audit-preceptor-avatar" style="background: #06b6d4;">${initial2}</div>
                <div>
                  <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${p2.preceptorName} (Carga 2)</div>
                  <small class="text-muted">Tema cargado: <strong style="color: #60a5fa;">Tema ${p2.tema}</strong></small>
                </div>
              </div>
              <div class="audit-preceptor-scores">
                <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">Matemática: ${p2.scoreMath !== null ? p2.scoreMath.toFixed(1) : '-'} / 5</span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">Lengua: ${p2.scoreLang !== null ? p2.scoreLang.toFixed(1) : '-'} / 5</span>
                <span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #c084fc; font-weight: 700;">Nota Total: ${p2.scoreTotal !== null ? p2.scoreTotal.toFixed(1) : '-'} / 10</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm mt-1" onclick="window.AuditManager.resolveFast('${studentId}', 1)" title="Acepta todas las respuestas cargadas por ${p2.preceptorName}">
                ✅ Aceptar Todo de ${p2.preceptorName}
              </button>
            </div>
          `;
        }
      }

      // 3. Renderizar tabla comparativa de preguntas
      this.renderDiffTable(studentId);

      // 4. Botones del footer
      const resolutionContainer = document.getElementById('auditResolutionControls');
      if (resolutionContainer) {
        const name1 = subs[0] ? subs[0].preceptorName : 'Carga 1';
        const name2 = subs[1] ? subs[1].preceptorName : 'Carga 2';
        resolutionContainer.innerHTML = `
          <button type="button" class="btn btn-secondary me-2" onclick="window.AuditManager.closeModal()">
            Cancelar
          </button>
          <button type="button" class="btn btn-secondary me-2" onclick="window.AuditManager.resolveFast('${studentId}', 0)">
            Aceptar todo de ${name1}
          </button>
          <button type="button" class="btn btn-secondary me-2" onclick="window.AuditManager.resolveFast('${studentId}', 1)">
            Aceptar todo de ${name2}
          </button>
          <button type="button" class="btn btn-primary" onclick="window.AuditManager.saveManualResolution('${studentId}')">
            ⚖️ Confirmar Selección y Guardar Nota Oficial
          </button>
        `;
      }

      modal.classList.add('active');
    }

    renderDiffTable(studentId) {
      const audit = window.DataService.getStudentAuditStatus(studentId);
      if (!audit) return;

      const tableBody = document.getElementById('auditDiffTableBody');
      if (!tableBody) return;

      const subs = audit.submissions;
      if (subs.length < 2) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Faltan cargas para comparar.</td></tr>`;
        return;
      }

      const p1 = subs[0];
      const p2 = subs[1];
      const questions = window.EXAM_CONFIG.questions;

      const th1 = document.getElementById('thPreceptor1');
      const th2 = document.getElementById('thPreceptor2');
      if (th1) th1.textContent = `${p1.preceptorName} (Tema ${p1.tema})`;
      if (th2) th2.textContent = `${p2.preceptorName} (Tema ${p2.tema})`;

      const diffBadge = document.getElementById('diffCountBadge');
      if (diffBadge) diffBadge.textContent = audit.discrepancyCount;

      const subtitle = document.getElementById('auditDiffSubtitle');
      if (subtitle) {
        subtitle.textContent = this.showOnlyDiffs
          ? `Mostrando las ${audit.discrepancyCount} pregunta(s) con discrepancia de 20 preguntas totales`
          : `Mostrando las 20 preguntas del examen (${audit.discrepancyCount} con discrepancia destacadas en rojo)`;
      }

      let visibleRows = 0;
      let html = '';

      questions.forEach(q => {
        const ans1 = (p1.answers && p1.answers[q.n]) ? String(p1.answers[q.n]).toUpperCase() : '-';
        const ans2 = (p2.answers && p2.answers[q.n]) ? String(p2.answers[q.n]).toUpperCase() : '-';
        const isDiff = ans1 !== ans2 || p1.tema !== p2.tema;

        if (this.showOnlyDiffs && !isDiff && !audit.temaMismatch) {
          return;
        }

        visibleRows++;
        const diffClass = isDiff ? 'row-discrepancy' : 'row-matched';
        const currentOfficialKey = this.officialTema === 'B' ? q.temaB : q.temaA;

        // Opciones para el selector de resolución
        const optionsList = ['A', 'B', 'C', 'D'];
        let selectedOption = ans1;
        if (ans1 === currentOfficialKey) selectedOption = ans1;
        else if (ans2 === currentOfficialKey) selectedOption = ans2;

        let optionsHtml = '';
        if (ans1 !== '-' && !optionsList.includes(ans1)) {
          optionsHtml += `<option value="${ans1}">${ans1} (${p1.preceptorName})</option>`;
        }
        if (ans2 !== '-' && ans2 !== ans1 && !optionsList.includes(ans2)) {
          optionsHtml += `<option value="${ans2}">${ans2} (${p2.preceptorName})</option>`;
        }

        optionsList.forEach(opt => {
          let label = `Opción ${opt}`;
          if (opt === ans1 && opt === ans2) label += ` (Coinciden ambos)`;
          else if (opt === ans1) label += ` (${p1.preceptorName})`;
          else if (opt === ans2) label += ` (${p2.preceptorName})`;
          if (opt === currentOfficialKey) label += ` ★ Clave`;

          optionsHtml += `<option value="${opt}" ${opt === selectedOption ? 'selected' : ''}>${label}</option>`;
        });

        html += `
          <tr class="${diffClass}">
            <td class="text-center font-bold" style="font-size: 0.95rem;">P${q.n}</td>
            <td>
              <div style="font-weight: 600; color: var(--text-main); font-size: 0.85rem;">${q.subject} &bull; ${q.topic}</div>
              <small class="text-muted d-block" style="font-size: 0.75rem;">${q.criterion}</small>
            </td>
            <td class="text-center">
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; font-size: 0.85rem;">
                Tema ${this.officialTema}: ${currentOfficialKey}
              </span>
            </td>
            <td class="text-center ${isDiff ? 'font-bold text-danger' : ''}" style="font-size: 1rem;">
              <span class="status-pill ${ans1 === currentOfficialKey ? 'pill-success' : (isDiff ? 'pill-danger' : 'pill-warning')}">
                ${ans1}
              </span>
            </td>
            <td class="text-center ${isDiff ? 'font-bold text-danger' : ''}" style="font-size: 1rem;">
              <span class="status-pill ${ans2 === currentOfficialKey ? 'pill-success' : (isDiff ? 'pill-danger' : 'pill-warning')}">
                ${ans2}
              </span>
            </td>
            <td class="text-center">
              ${isDiff ? '<span class="status-pill pill-danger">⚠️ Discrepa</span>' : '<span class="status-pill pill-success">✅ Coincide</span>'}
            </td>
            <td class="text-center">
              <select class="form-select form-select-sm resolve-select" data-q="${q.n}" style="min-width: 170px; font-weight: 600; border-color: ${isDiff ? '#f87171' : 'var(--border-subtle)'};">
                ${optionsHtml}
              </select>
            </td>
          </tr>
        `;
      });

      if (visibleRows === 0) {
        html = `<tr><td colspan="7" class="text-center py-4 text-muted">No hay preguntas con discrepancia. Ambos preceptores coincidieron al 100%.</td></tr>`;
      }

      tableBody.innerHTML = html;
    }

    closeModal() {
      const modal = document.getElementById('modalAuditDiff');
      if (modal) modal.classList.remove('active');
    }

    resolveFast(studentId, subIndex) {
      const audit = window.DataService.getStudentAuditStatus(studentId);
      if (!audit || !audit.submissions[subIndex]) return;
      const sub = audit.submissions[subIndex];
      const preceptorName = sub.preceptorName || `Carga ${subIndex + 1}`;
      window.DataService.resolveDiscrepancy(studentId, {
        tema: sub.tema,
        answers: sub.answers,
        notes: `Aceptado completamente de ${preceptorName}`
      });
      this.closeModal();
      window.app.renderAll();
      window.app.showToast(`✅ Discrepancia resuelta usando datos de ${preceptorName}`, 'success');
    }

    saveManualResolution(studentId) {
      const selects = document.querySelectorAll('.resolve-select');
      const answers = {};
      selects.forEach(sel => {
        const q = sel.getAttribute('data-q');
        answers[q] = sel.value;
      });

      const audit = window.DataService.getStudentAuditStatus(studentId);
      const selectedTemaRadio = document.querySelector('input[name="officialTemaRadio"]:checked');
      const tema = selectedTemaRadio ? selectedTemaRadio.value : (this.officialTema || (audit.submissions[0] && audit.submissions[0].tema) || 'A');

      const notesInput = document.getElementById('auditResolutionNotes');
      const notes = (notesInput && notesInput.value.trim()) || 'Resolución oficial verificada con examen físico por Dirección';

      window.DataService.resolveDiscrepancy(studentId, {
        tema,
        answers,
        notes
      });

      this.closeModal();
      window.app.renderAll();
      window.app.showToast('✅ Nota oficial confirmada y guardada con éxito en Firebase Firestore', 'success');
    }
  }

  window.AuditManager = new AuditManager();
})();
