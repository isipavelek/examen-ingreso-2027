/**
 * Corrección del Examen de Prácticas del Lenguaje (16/10 y 30/10) - Ingreso 2027
 * Rúbrica oficial (Examen 16-10/Rúbrica.pdf) y cuentas de los profesores de PdL.
 */
window.PDL_CONFIG = {
  // Profesores de PdL: solo acceden a la corrección de PdL (EST/pdl.html).
  // Crear cada cuenta en Firebase Console > Authentication, copiar su UID acá
  // y también en firestore.rules (función isProfesorPdl).
  profesores: [
    { uid: "unXa7nmvUUaO6m4TWyVS57sh6Bu2", name: "Matias Demaro", email: "matias.demaro@inspt.utn.edu.ar", color: "#a855f7" },
    { uid: "gMq0OP0avdYqcU78JjE7SBH7uh23", name: "Alexis Tagliavini", email: "alexis.tagliavini@inspt.utn.edu.ar", color: "#ec4899" }
  ],

  // Instancias del ingreso. 'mc': examen múltiple choice (sistema del personal, EST/index.html);
  // 'pdl' y 'mat': segunda instancia (EST/instancias.html) para los que pasan. 'encuentroId' es el encuentro
  // de la toma de lista (EXAM_CONFIG.encuentros / 'instance_attendance'): el presentismo es uno solo.
  instancias: [
    { id: "02-10", tipo: "mc", icono: "📝", titulo: "Ingreso 2/10", detalle: "Múltiple choice • Matemática y PdL", fechaTexto: "Viernes 2 de octubre" },
    { id: "16-10", encuentroId: "pdl_16_10", tipo: "pdl", icono: "📖", titulo: "PdL 16/10", detalle: "Prácticas del Lenguaje • cronograma general", fechaTexto: "Viernes 16 de octubre" },
    { id: "23-10", encuentroId: "mat_23_10", tipo: "mat", icono: "📐", titulo: "Matemática 23/10", detalle: "Matemática • todos los que pasan", fechaTexto: "Viernes 23 de octubre" },
    { id: "30-10", encuentroId: "pdl_30_10", tipo: "pdl", icono: "📖", titulo: "PdL 30/10", detalle: "Prácticas del Lenguaje • cronograma alternativo", fechaTexto: "Viernes 30 de octubre" }
  ],

  secciones: [
    { id: "A", titulo: "Comprensión y Análisis Lector", max: 3.0 },
    { id: "B", titulo: "Gramática, Normativa y Ortografía", max: 3.0 },
    { id: "C", titulo: "Producción Escrita / Redacción", max: 4.0 }
  ],

  // Cada ítem: niveles de mayor a menor puntaje. Opcional: 'guia: { A: '...', B: '...' }' con una
  // orientación de respuesta por tema (no se publica mientras el examen pueda volver a tomarse).
  items: [
    {
      id: "A1", seccion: "A", criterio: "Persona gramatical y género del texto",
      niveles: [
        { pts: 0.6, desc: "Identifica 3.ª persona y género (narrativo / cuento / relato)" },
        { pts: 0.3, desc: "Identifica solo uno de los dos elementos" },
        { pts: 0, desc: "Incorrecto o no responde" }
      ]
    },
    {
      id: "A2", seccion: "A", criterio: "Comprensión literal de hechos o causas",
      niveles: [
        { pts: 0.6, desc: "Responde completo y preciso según la lectura" },
        { pts: 0.3, desc: "Incompleta o con imprecisiones menores" },
        { pts: 0, desc: "Incorrecto o descontextualizado" }
      ]
    },
    {
      id: "A3", seccion: "A", criterio: "Relación título e idea central / sentido global",
      niveles: [
        { pts: 0.6, desc: "Vincula con coherencia el título con el tema principal" },
        { pts: 0.3, desc: "Explicación vaga o parcial" },
        { pts: 0, desc: "Sin fundamentación o errónea" }
      ]
    },
    {
      id: "A4", seccion: "A", criterio: "Causa-efecto o motivación del personaje",
      niveles: [
        { pts: 0.6, desc: "Explica claramente el motivo o la causa" },
        { pts: 0.3, desc: "Menciona el motivo de forma incompleta" },
        { pts: 0, desc: "Incorrecto" }
      ]
    },
    {
      id: "A5", seccion: "A", criterio: "Interpretación de desenlace o relación conceptual",
      niveles: [
        { pts: 0.6, desc: "Articula adecuadamente la conclusión o relación" },
        { pts: 0.3, desc: "Comprensión parcial del cierre" },
        { pts: 0, desc: "Incorrecto" }
      ]
    },
    {
      id: "B1", seccion: "B", criterio: "Pluralización morfológica y ortográfica",
      niveles: [
        { pts: 0.5, desc: "Plural correcto con ortografía precisa" },
        { pts: 0.25, desc: "Parcialmente correcto" },
        { pts: 0, desc: "Error o sin responder" }
      ]
    },
    {
      id: "B2", seccion: "B", criterio: "Identificación de sustantivos abstractos",
      niveles: [
        { pts: 0.5, desc: "2 sustantivos abstractos pertinentes del texto" },
        { pts: 0.25, desc: "Solo 1 correcto o extraídos fuera del texto" },
        { pts: 0, desc: "Ninguno correcto" }
      ]
    },
    {
      id: "B3", seccion: "B", criterio: "Reconocimiento de adjetivos (numeral / calificativo)",
      niveles: [
        { pts: 0.5, desc: "Identifica la clase pedida según el tema" },
        { pts: 0, desc: "Incorrecto o de otra clase" }
      ]
    },
    {
      id: "B4", seccion: "B", criterio: "Separación en sílabas (diptongos e hiatos)",
      niveles: [
        { pts: 0.5, desc: "Separa sin errores" },
        { pts: 0.25, desc: "Separación parcialmente correcta" },
        { pts: 0, desc: "Con errores" }
      ]
    },
    {
      id: "B5", seccion: "B", criterio: "Léxico: antónimos contextuales",
      niveles: [
        { pts: 0.5, desc: "2 antónimos precisos y adecuados" },
        { pts: 0.25, desc: "Solo 1 antónimo adecuado" },
        { pts: 0, desc: "Erróneos o sin antónimos" }
      ]
    },
    {
      id: "B6", seccion: "B", criterio: "Acentuación, monosílabos y reglas ortográficas",
      niveles: [
        { pts: 0.5, desc: "Justifica la tilde y enuncia la regla" },
        { pts: 0.25, desc: "Regla incompleta" },
        { pts: 0, desc: "Incorrecto" }
      ]
    },
    {
      id: "C1", seccion: "C", criterio: "Título y persona gramatical entre paréntesis",
      niveles: [
        { pts: 0.5, desc: "Título pertinente y persona indicada entre paréntesis" },
        { pts: 0.25, desc: "Solo el título o solo la persona" },
        { pts: 0, desc: "Omite ambos" }
      ]
    },
    {
      id: "C2", seccion: "C", criterio: "Desarrollo narrativo, coherencia y extensión (mín. 15 renglones)",
      niveles: [
        { pts: 2.5, desc: "Excelente: 15+ renglones, original, fluida, buen vocabulario y ortografía" },
        { pts: 1.75, desc: "Bueno: 12 a 14 renglones, buena coherencia, leves errores" },
        { pts: 1, desc: "En proceso: 8 a 11 renglones o falencias notorias" },
        { pts: 0, desc: "Insuficiente: menos de 8 renglones, incomprensible o fuera de tema" }
      ]
    },
    {
      id: "C3", seccion: "C", criterio: "Estructura narrativa explicitada (introducción, nudo, desenlace)",
      niveles: [
        { pts: 1, desc: "Señala los tres momentos" },
        { pts: 0.5, desc: "Señala solo 2 de las 3 partes" },
        { pts: 0, desc: "No identifica la estructura" }
      ]
    }
  ]
};
