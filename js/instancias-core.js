/**
 * Lógica compartida de las instancias del ingreso 2027 (2/10, PdL 16/10, Matemática 23/10, PdL 30/10).
 * La usan el sistema del personal (EST/index.html, Resumen general) y la página de instancias (EST/instancias.html).
 */

(function () {
  const CFG = window.PDL_CONFIG;
  const round2 = n => Math.round(n * 100) / 100;

  const InstanciasCore = {
    getInstancias() {
      return CFG.instancias;
    },

    getInstancia(id) {
      return CFG.instancias.find(i => i.id === id) || null;
    },

    // Estudiantes convocados: PdL según su fecha; Matemática 23/10, todos los que pasan
    rosterFor(roster, instId) {
      const inst = this.getInstancia(instId);
      if (!inst) return [];
      if (inst.tipo === 'mat') return roster;
      return roster.filter(s => s.fecha === instId);
    },

    // Toma de lista ('instance_attendance/{encuentroId}_{studentId}') agrupada por instancia:
    // { '16-10': { studentId: { asistio, por, en } }, ... }
    asistenciaPorInstancia(attendDocs) {
      const porEncuentro = {};
      CFG.instancias.forEach(i => { if (i.encuentroId) porEncuentro[i.encuentroId] = i.id; });
      const result = {};
      Object.values(attendDocs || {}).forEach(d => {
        const instId = d && porEncuentro[d.encuentroId];
        if (!instId || typeof d.presente !== 'boolean') return;
        if (!result[instId]) result[instId] = {};
        result[instId][d.studentId] = { asistio: d.presente, por: d.updatedBy, en: d.updatedAt };
      });
      return result;
    },

    // Fecha de PdL que le toca a un estudiante del padrón
    pdlFechaDe(roster, studentId) {
      const st = roster.find(s => s.id === studentId);
      return st ? st.fecha : null;
    },

    // Totales por sección y nota final de una corrección por rúbrica
    computeScores(puntajes) {
      const secs = {};
      CFG.secciones.forEach(s => { secs[s.id] = 0; });
      let completos = 0;
      CFG.items.forEach(it => {
        const v = puntajes ? puntajes[it.id] : undefined;
        if (typeof v === 'number') {
          secs[it.seccion] += v;
          completos++;
        }
      });
      Object.keys(secs).forEach(k => { secs[k] = round2(secs[k]); });
      const nota = round2(Object.values(secs).reduce((a, b) => a + b, 0));
      return { secs, nota, completos, completo: completos === CFG.items.length };
    },

    // Presentismo en una instancia: 'presente' | 'ausente' | 'sin_registrar'.
    // En PdL, una corrección ya empezada cuenta como presente y una marcada ausente, como ausente.
    presencia(instId, grade, asistencia) {
      const inst = this.getInstancia(instId);
      if (inst && inst.tipo === 'pdl' && grade) {
        if (grade.ausente) return 'ausente';
        if (grade.tema || grade.itemsCompletos > 0) return 'presente';
      }
      if (asistencia && typeof asistencia.asistio === 'boolean') return asistencia.asistio ? 'presente' : 'ausente';
      return 'sin_registrar';
    },

    // Estado de corrección de PdL: 'pendiente' | 'en_progreso' | 'corregido' | 'ausente'
    estadoPdl(grade, asistencia) {
      if (grade) return grade.ausente ? 'ausente' : (grade.estado || 'en_progreso');
      return (asistencia && asistencia.asistio === false) ? 'ausente' : 'pendiente';
    },

    // Barra para moverse entre instancias. Los links llevan a cada página; onSelect permite
    // resolver dentro de la misma página (devolver true evita la navegación).
    renderInstanceBar(container, { active, isAdmin, onSelect }) {
      if (!container) return;
      const items = CFG.instancias
        .filter(i => isAdmin || i.tipo === 'pdl')
        .map(i => ({ id: i.id, label: `${i.icono} ${i.titulo}`, hint: i.detalle, href: i.tipo === 'mc' ? 'index.html' : `instancias.html?fecha=${i.id}` }));
      if (isAdmin) items.push({ id: 'general', label: '📊 Resumen general', hint: 'Todas las instancias juntas', href: 'index.html#general' });

      container.innerHTML = items.map(it => `
        <a class="instance-chip ${it.id === active ? 'active' : ''}" href="${it.href}" data-inst="${it.id}" title="${it.hint}">${it.label}</a>`).join('');
      container.style.display = items.length > 1 ? '' : 'none';
      container.querySelectorAll('.instance-chip').forEach(a => {
        a.addEventListener('click', e => {
          if (onSelect && onSelect(a.getAttribute('data-inst')) === true) e.preventDefault();
        });
      });
    }
  };

  window.InstanciasCore = InstanciasCore;
})();
