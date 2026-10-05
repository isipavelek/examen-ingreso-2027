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

    openDiscrepancyModal(studentId) {
      this.selectedStudentId = studentId;
      const student = window.DataService.getStudentById(studentId);
      const audit = window.DataService.getStudentAuditStatus(studentId);
      const modal = document.getElementById('modalAuditDiff');
      if (!modal) return;

      const titleEl = document.getElementById('auditModalStudentName');
      const infoEl = document.getElementById('auditModalStudentInfo');
      const tableBody = document.getElementById('auditDiffTableBody');
      const resolutionContainer = document.getElementById('auditResolutionControls');

      if (titleEl) titleEl.textContent = `${student.apellido}, ${student.nombre}`;
      if (infoEl) {
        infoEl.innerHTML = `
          <span><strong>DNI:</strong> ${student.dni}</span> &bull; 
          <span><strong>Aula:</strong> ${student.aula}</span> &bull; 
          <span><strong>Escuela:</strong> ${student.escuela_origen || 'No especificada'}</span>
        `;
      }

      // Generar encabezados y filas comparativas
      const subs = audit.submissions;
      let html = '';

      if (subs.length < 2) {
        html = `<tr><td colspan="7" class="text-center py-4 text-muted">Este estudiante cuenta con ${subs.length} carga(s). Se requieren al menos 2 cargas de distintos perfiles para auditar discrepancias.</td></tr>`;
      } else {
        const p1 = subs[0];
        const p2 = subs[1];
        const questions = window.EXAM_CONFIG.questions;

        questions.forEach(q => {
          const ans1 = (p1.answers && p1.answers[q.n]) || '-';
          const ans2 = (p2.answers && p2.answers[q.n]) || '-';
          const isDiff = ans1 !== ans2;
          const diffClass = isDiff ? 'row-discrepancy' : 'row-matched';

          const keyA = q.temaA;
          const keyB = q.temaB;

          html += `
            <tr class="${diffClass}">
              <td class="text-center"><strong>P${q.n}</strong></td>
              <td>
                <div class="topic-name">${q.topic}</div>
                <small class="text-muted d-block">${q.criterion}</small>
              </td>
              <td class="text-center"><span class="badge badge-subtle">A: ${keyA} | B: ${keyB}</span></td>
              <td class="text-center ${isDiff ? 'font-bold text-danger' : ''}">${ans1}</td>
              <td class="text-center ${isDiff ? 'font-bold text-danger' : ''}">${ans2}</td>
              <td class="text-center">
                ${isDiff ? '<span class="status-pill pill-danger">Discrepancia</span>' : '<span class="status-pill pill-success">Coincide</span>'}
              </td>
              <td class="text-center">
                <select class="form-select form-select-sm resolve-select" data-q="${q.n}">
                  <option value="${ans1}">Opción ${p1.preceptorName} (${ans1})</option>
                  <option value="${ans2}" ${isDiff ? 'selected' : ''}>Opción ${p2.preceptorName} (${ans2})</option>
                  <option value="A">Forzar A</option>
                  <option value="B">Forzar B</option>
                  <option value="C">Forzar C</option>
                  <option value="D">Forzar D</option>
                </select>
              </td>
            </tr>
          `;
        });
      }

      if (tableBody) tableBody.innerHTML = html;

      // Botones de acción rápida con nombres de los preceptores
      if (resolutionContainer) {
        const name1 = subs[0] ? subs[0].preceptorName : 'Carga 1';
        const name2 = subs[1] ? subs[1].preceptorName : 'Carga 2';
        resolutionContainer.innerHTML = `
          <button class="btn btn-secondary me-2" onclick="window.AuditManager.resolveFast('${studentId}', 0)">
            Aceptar todo de ${name1}
          </button>
          <button class="btn btn-secondary me-2" onclick="window.AuditManager.resolveFast('${studentId}', 1)">
            Aceptar todo de ${name2}
          </button>
          <button class="btn btn-primary" onclick="window.AuditManager.saveManualResolution('${studentId}')">
            Confirmar Selección y Guardar Nota Oficial
          </button>
        `;
      }

      modal.classList.add('active');
    }

    closeModal() {
      const modal = document.getElementById('modalAuditDiff');
      if (modal) modal.classList.remove('active');
    }

    resolveFast(studentId, subIndex) {
      const audit = window.DataService.getStudentAuditStatus(studentId);
      if (!audit || !audit.submissions[subIndex]) return;
      const sub = audit.submissions[subIndex];
      window.DataService.resolveDiscrepancy(studentId, {
        tema: sub.tema,
        answers: sub.answers,
        notes: `Aceptado completamente del ${sub.profileName}`
      });
      this.closeModal();
      window.app.renderAll();
      window.app.showToast(`Discrepancia resuelta usando datos de ${sub.profileName}`, 'success');
    }

    saveManualResolution(studentId) {
      const selects = document.querySelectorAll('.resolve-select');
      const answers = {};
      selects.forEach(sel => {
        const q = sel.getAttribute('data-q');
        answers[q] = sel.value;
      });

      const audit = window.DataService.getStudentAuditStatus(studentId);
      const tema = (audit.submissions[0] && audit.submissions[0].tema) || 'A';

      window.DataService.resolveDiscrepancy(studentId, {
        tema,
        answers,
        notes: 'Resolución manual verificada por Dirección'
      });

      this.closeModal();
      window.app.renderAll();
      window.app.showToast('Nota oficial confirmada y guardada con éxito', 'success');
    }
  }

  window.AuditManager = new AuditManager();
})();
