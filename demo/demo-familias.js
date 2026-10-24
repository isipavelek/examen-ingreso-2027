/**
 * DEMO local (no se publica): simula la consulta con DNI con estudiantes inventados, para ver
 * cómo ven las familias la corrección de PdL y Matemática. Reemplaza Firebase por datos de ejemplo
 * armados con las rúbricas reales (data/pdlConfig.js + js/instancias-core.js).
 */
(function () {
  const Core = window.InstanciasCore;
  const pdlR = Core.getRubrica('pdl');
  const matR = Core.getRubrica('mat');

  // Mismo formato que publica Dirección (instancias.js → buildPublicResult)
  function publicPdl(nivelesPorItem, fecha, fechaTexto) {
    const niveles = {};
    pdlR.items.forEach((it, i) => { niveles[it.id] = it.niveles[nivelesPorItem[i] || 0].key; });
    const sc = Core.computeScores(pdlR, niveles);
    return {
      fecha, fechaTexto, estado: 'evaluado', tema: 'A', nota: sc.nota,
      secciones: pdlR.secciones.map(s => ({ id: s.id, titulo: s.titulo, nota: sc.secs[s.id], max: s.max })),
      items: pdlR.items.map(it => ({ id: it.id, seccion: it.seccion, criterio: it.criterio, puntaje: sc.puntajes[it.id], max: it.max }))
    };
  }

  function publicMat(califs) {
    const niveles = {};
    matR.items.forEach((it, i) => { niveles[it.id] = califs[i]; });
    const sc = Core.computeScores(matR, niveles);
    return {
      fecha: '23-10', fechaTexto: 'Viernes 23 de octubre', estado: 'evaluado', nota: sc.nota,
      items: matR.items.map(it => {
        const lv = it.niveles.find(l => l.key === niveles[it.id]);
        return { id: it.id, tema: it.tema, calificacion: lv.label, nombre: lv.nombre, puntaje: lv.pts, max: it.max };
      })
    };
  }

  // Primer examen (multiple choice 2/10): algunas preguntas de ejemplo con su resultado
  const preguntasMC = n => Array.from({ length: 20 }, (_, i) => ({
    n: i + 1, materia: i < 10 ? 'Matemática' : 'Prácticas del Lenguaje', contenido: `Contenido de ejemplo ${i + 1}`,
    respuesta: 'ABCD'[i % 4], correcta: i < n
  }));
  const primerExamen = (notaFinal, mat, leng, pasa = true) => ({
    estado: 'evaluado', tema: 'B', notaFinal, notaMatematica: mat, notaLengua: leng, pasa, preguntas: preguntasMC(Math.round(notaFinal * 2))
  });

  const EJEMPLOS = {
    '11111111': {
      descripcion: 'PdL corregido y publicado · Matemática aún sin corregir',
      doc: {
        dni: '11111111', apellido: 'Ejemplo', nombre: 'Lucía (inventado)', cronograma: 'general',
        ...primerExamen(7.5, 3.5, 4),
        pdl: publicPdl([0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0], '16-10', 'Viernes 16 de octubre')
      }
    },
    '22222222': {
      descripcion: 'Los dos corregidos · condición final: ingresa',
      doc: {
        dni: '22222222', apellido: 'Ejemplo', nombre: 'Tomás (inventado)', cronograma: 'alternativo',
        ...primerExamen(6, 3, 3),
        pdl: publicPdl([0, 0, 1, 2, 1, 0, 1, 0, 2, 0, 1, 0, 1, 1], '30-10', 'Viernes 30 de octubre'),
        mat: publicMat(['B', 'B-', 'B', 'R', 'B', 'B', 'M', 'B-', 'R', 'B', 'NR']),
        ingreso: { ingresa: true }
      }
    },
    '44444444': {
      descripcion: 'Los dos corregidos · condición final: no ingresa',
      doc: {
        dni: '44444444', apellido: 'Ejemplo', nombre: 'Joaquín (inventado)', cronograma: 'general',
        ...primerExamen(5.5, 2.5, 3),
        pdl: publicPdl([1, 2, 1, 2, 1, 1, 2, 0, 1, 2, 1, 1, 2, 1], '16-10', 'Viernes 16 de octubre'),
        mat: publicMat(['B-', 'R', 'M', 'B', 'R', 'M', 'NR', 'R', 'M', 'B-', 'R']),
        ingreso: { ingresa: false }
      }
    },
    '55555555': {
      descripcion: 'No pasó el multiple choice',
      doc: {
        dni: '55555555', apellido: 'Ejemplo', nombre: 'Martina (inventado)', cronograma: 'general',
        ...primerExamen(3.5, 2, 1.5, false)
      }
    },
    '33333333': {
      descripcion: 'Pasó a la 2da instancia · ningún examen corregido todavía',
      doc: {
        dni: '33333333', apellido: 'Ejemplo', nombre: 'Valentina (inventado)', cronograma: 'general',
        ...primerExamen(8, 4, 4)
      }
    }
  };

  // Firebase simulado: solo la lectura de 'student_results/{dni}' que hace alumno.js
  window.firebase = {
    apps: [],
    initializeApp() { this.apps.push({}); },
    firestore: () => ({
      collection: () => ({
        doc: dni => ({
          get: async () => {
            const ej = EJEMPLOS[dni];
            return { exists: !!ej, data: () => (ej ? JSON.parse(JSON.stringify(ej.doc)) : undefined) };
          }
        })
      })
    })
  };

  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.innerHTML = `
      <div class="demo-bar-title">🧪 DEMO con estudiantes inventados — así lo ve la familia con el DNI</div>
      <div class="demo-bar-buttons">
        ${Object.entries(EJEMPLOS).map(([dni, ej]) => `<button type="button" class="btn btn-secondary btn-sm" data-dni="${dni}">DNI ${dni}<br><small>${ej.descripcion}</small></button>`).join('')}
      </div>`;
    document.body.prepend(bar);
    bar.querySelectorAll('button[data-dni]').forEach(btn => {
      btn.addEventListener('click', () => {
        const back = document.getElementById('btnLogout');
        if (document.getElementById('resultView').style.display !== 'none') back.click();
        document.getElementById('dniInput').value = btn.getAttribute('data-dni');
        document.getElementById('btnDniSubmit').click();
      });
    });
    // vista-familias.html#22222222 abre directo ese ejemplo
    const dni = window.location.hash.slice(1);
    const btn = dni && bar.querySelector(`button[data-dni="${dni}"]`);
    if (btn) setTimeout(() => btn.click(), 50);
  });
})();
