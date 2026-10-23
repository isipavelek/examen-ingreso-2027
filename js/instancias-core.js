/**
 * Lógica compartida de las instancias del ingreso 2027 (2/10, PdL 16/10, Matemática 23/10, PdL 30/10).
 * La usan el sistema del personal (EST/index.html, Resumen general) y la página de instancias (EST/instancias.html).
 */

(function () {
  const CFG = window.PDL_CONFIG;
  const round2 = n => Math.round(n * 100) / 100;
  // Puntajes exactos (B⁻ de 0,75 = 0,5625): solo se quita el ruido de punto flotante
  const exact = n => Math.round(n * 10000) / 10000;
  const fmtPts = n => n.toFixed(2).replace('.', ',');

  // Rúbrica de cada tipo de examen, en un mismo formato:
  //   items: [{ id, seccion, criterio, max, niveles: [{ key, label, pts, desc }] }]
  //   notaExacta(suma): nota sin redondear (la usa el orden de mérito); nota(suma): la que se muestra (2 decimales)
  //   coleccion: dónde se guardan las correcciones; campoPublico: campo en student_results
  const RUBRICAS = {
    pdl: {
      tipo: 'pdl',
      materia: 'Prácticas del Lenguaje',
      coleccion: 'pdl_grades',
      campoPublico: 'pdl',
      usaTema: true,
      porCalificacion: false,
      secciones: CFG.secciones,
      items: CFG.items.map(it => ({
        id: it.id,
        seccion: it.seccion,
        criterio: it.criterio,
        guia: it.guia || null,
        max: it.niveles[0].pts,
        niveles: it.niveles.map(lv => ({ key: String(lv.pts), label: `${fmtPts(lv.pts)} pts`, pts: lv.pts, desc: lv.desc }))
      })),
      notaExacta: suma => suma,
      nota: suma => round2(suma)
    },
    mat: {
      tipo: 'mat',
      materia: 'Matemática',
      coleccion: 'mat_grades',
      campoPublico: 'mat',
      usaTema: false,
      porCalificacion: true, // B / B⁻ / R / M / NR sobre el puntaje de cada ejercicio
      secciones: [{ id: 'E', titulo: 'Ejercicios', max: round2(CFG.matematica.items.reduce((s, it) => s + it.puntaje, 0)) }],
      items: CFG.matematica.items.map(it => ({
        id: it.id,
        seccion: 'E',
        criterio: `Ejercicio ${it.id}`,
        tema: it.tema || '',
        max: it.puntaje,
        niveles: CFG.matematica.calificaciones.map(c => ({
          key: c.id, label: c.label, nombre: c.nombre, pts: exact(it.puntaje * c.factor), desc: c.desc
        }))
      })),
      // Nota a partir de la suma exacta; la escala es de 1 a 10 (se muestra con 2 decimales)
      notaExacta: suma => Math.min(10, Math.max(1, suma)),
      nota: suma => round2(Math.min(10, Math.max(1, suma)))
    }
  };

  const InstanciasCore = {
    getInstancias() {
      return CFG.instancias;
    },

    getInstancia(id) {
      return CFG.instancias.find(i => i.id === id) || null;
    },

    getRubrica(tipo) {
      return RUBRICAS[tipo] || null;
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

    // Nivel elegido en cada ítem ({ itemId: key }) a partir de una corrección guardada.
    // Las de PdL anteriores guardaban solo los puntajes: el nivel se deduce del puntaje.
    nivelesDeGrade(rubrica, grade) {
      if (!grade) return {};
      if (grade.niveles) return { ...grade.niveles };
      const sel = {};
      rubrica.items.forEach(it => {
        const v = grade.puntajes ? grade.puntajes[it.id] : undefined;
        if (typeof v === 'number') {
          const lv = it.niveles.find(l => l.pts === v);
          if (lv) sel[it.id] = lv.key;
        }
      });
      return sel;
    },

    // Puntaje por ítem y por sección, suma exacta y nota final de una corrección por rúbrica
    computeScores(rubrica, niveles) {
      const secs = {};
      rubrica.secciones.forEach(s => { secs[s.id] = 0; });
      const puntajes = {};
      let completos = 0;
      rubrica.items.forEach(it => {
        const lv = niveles ? it.niveles.find(l => l.key === niveles[it.id]) : null;
        if (lv) {
          puntajes[it.id] = lv.pts;
          secs[it.seccion] += lv.pts;
          completos++;
        }
      });
      Object.keys(secs).forEach(k => { secs[k] = exact(secs[k]); });
      // Suma exacta de los puntajes; cada rúbrica define cómo se redondea la nota final
      const suma = exact(Object.values(secs).reduce((a, b) => a + b, 0));
      return { secs, puntajes, suma, notaExacta: rubrica.notaExacta(suma), nota: rubrica.nota(suma), completos, completo: completos === rubrica.items.length };
    },

    // Presentismo en una instancia: 'presente' | 'ausente' | 'sin_registrar'.
    // Una corrección ya empezada cuenta como presente y una marcada ausente, como ausente.
    presencia(instId, grade, asistencia) {
      const inst = this.getInstancia(instId);
      if (inst && inst.tipo !== 'mc' && grade) {
        if (grade.ausente) return 'ausente';
        if (grade.tema || grade.itemsCompletos > 0) return 'presente';
      }
      if (asistencia && typeof asistencia.asistio === 'boolean') return asistencia.asistio ? 'presente' : 'ausente';
      return 'sin_registrar';
    },

    // Estado de corrección: 'pendiente' | 'en_progreso' | 'corregido' | 'ausente'
    estadoGrade(grade, asistencia) {
      if (grade) return grade.ausente ? 'ausente' : (grade.estado || 'en_progreso');
      return (asistencia && asistencia.asistio === false) ? 'ausente' : 'pendiente';
    },

    estadoPdl(grade, asistencia) {
      return this.estadoGrade(grade, asistencia);
    },

    // Nota exacta (sin redondear) de una corrección terminada
    notaExactaDe(rubrica, grade) {
      return this.computeScores(rubrica, this.nivelesDeGrade(rubrica, grade)).notaExacta;
    },

    // Orden de mérito del ingreso: promedio de PdL (16/10 o 30/10, según su cronograma) y Matemática 23/10
    // con todos los decimales. Entran los primeros 'cupo'; si hay empate en el último lugar, decide Dirección
    // (decisiones: { studentId: true | false }). Si le falta corregir alguna nota queda 'incompleto';
    // si estuvo ausente en alguno de los dos exámenes, 'ausente' (no ingresa).
    //   estado: 'ingresa' | 'no_ingresa' | 'empate' (falta decidir) | 'ingresa_dir' | 'no_ingresa_dir' | 'incompleto' | 'ausente'
    ordenDeMerito({ roster, pdlGrades, matGrades, asistencia, decisiones }) {
      const cupo = (CFG.ingreso && CFG.ingreso.cupo) || 81;
      const pdlR = RUBRICAS.pdl;
      const matR = RUBRICAS.mat;
      // Las notas son múltiplos de 1/80: con 6 decimales se compara sin ruido de punto flotante
      const exacto6 = n => Math.round(n * 1e6) / 1e6;
      const filas = roster.map(st => {
        const pg = (pdlGrades && pdlGrades[st.id]) || null;
        const mg = (matGrades && matGrades[st.id]) || null;
        const pdlEstado = this.estadoGrade(pg, (asistencia[st.fecha] || {})[st.id]);
        const matEstado = this.estadoGrade(mg, (asistencia['23-10'] || {})[st.id]);
        const pdl = pdlEstado === 'corregido' ? this.notaExactaDe(pdlR, pg) : null;
        const mat = matEstado === 'corregido' ? this.notaExactaDe(matR, mg) : null;
        const completo = pdl !== null && mat !== null;
        const ausente = pdlEstado === 'ausente' || matEstado === 'ausente';
        return { st, pdlEstado, matEstado, pdl, mat, completo, promedio: completo ? exacto6((pdl + mat) / 2) : null, puesto: null, estado: ausente ? 'ausente' : 'incompleto' };
      });

      const completos = filas.filter(f => f.completo).sort((a, b) => b.promedio - a.promedio ||
        a.st.apellido.localeCompare(b.st.apellido, 'es', { sensitivity: 'base' }) || a.st.nombre.localeCompare(b.st.nombre, 'es', { sensitivity: 'base' }));
      // Puesto con empates compartidos (1, 2, 2, 4...)
      completos.forEach((f, i) => { f.puesto = (i > 0 && f.promedio === completos[i - 1].promedio) ? completos[i - 1].puesto : i + 1; });

      let corte = null;
      let lugaresEmpate = 0;
      let empatados = [];
      if (completos.length <= cupo) {
        completos.forEach(f => { f.estado = 'ingresa'; });
      } else {
        corte = completos[cupo - 1].promedio;
        const arriba = completos.filter(f => f.promedio > corte).length;
        empatados = completos.filter(f => f.promedio === corte);
        lugaresEmpate = cupo - arriba;
        const entranTodos = arriba + empatados.length <= cupo;
        completos.forEach(f => {
          if (f.promedio > corte) f.estado = 'ingresa';
          else if (f.promedio < corte) f.estado = 'no_ingresa';
          else if (entranTodos) f.estado = 'ingresa';
          else {
            const d = decisiones ? decisiones[f.st.id] : undefined;
            f.estado = d === true ? 'ingresa_dir' : (d === false ? 'no_ingresa_dir' : 'empate');
          }
        });
        if (entranTodos) { empatados = []; lugaresEmpate = 0; }
      }
      const elegidos = empatados.filter(f => f.estado === 'ingresa_dir').length;
      const sinNota = filas.filter(f => !f.completo);
      const incompletos = sinNota.filter(f => f.estado === 'incompleto');
      return {
        cupo,
        corte,
        filas: [...completos, ...sinNota],
        completos: completos.length,
        incompletos: incompletos.length,
        ausentes: sinNota.length - incompletos.length,
        ingresan: completos.filter(f => f.estado === 'ingresa' || f.estado === 'ingresa_dir').length,
        empatados: empatados.length,
        lugaresEmpate,
        elegidos,
        faltaDecidir: empatados.length > 0 && empatados.some(f => f.estado === 'empate'),
        // Con más elegidos que lugares, Dirección tiene que desmarcar a alguien
        excedido: elegidos > lugaresEmpate,
        // Se puede publicar la condición final cuando no falta corregir nada y el empate está resuelto
        listoParaPublicar: roster.length > 0 && incompletos.length === 0 && !(empatados.length > 0 && empatados.some(f => f.estado === 'empate')) && elegidos <= lugaresEmpate
      };
    },

    // Barra para moverse entre instancias. Dirección ve todas; cada profesor, las de su materia.
    // Los links llevan a cada página; onSelect permite resolver dentro de la misma página
    // (devolver true evita la navegación).
    renderInstanceBar(container, { active, isAdmin, materia, onSelect }) {
      if (!container) return;
      const items = CFG.instancias
        .filter(i => isAdmin || i.tipo === materia)
        .map(i => ({ id: i.id, label: `${i.icono} ${i.titulo}`, hint: i.detalle, href: i.tipo === 'mc' ? 'index.html' : `instancias.html?fecha=${i.id}` }));
      if (isAdmin) {
        items.push({ id: 'merito', label: '🏆 Orden de mérito', hint: `Promedio de PdL y Matemática: ingresan los mejores ${(CFG.ingreso && CFG.ingreso.cupo) || 81}`, href: 'index.html#merito' });
        items.push({ id: 'general', label: '📊 Resumen general', hint: 'Todas las instancias juntas', href: 'index.html#general' });
      }

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
