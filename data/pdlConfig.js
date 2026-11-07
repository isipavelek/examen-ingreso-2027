/**
 * Segunda instancia del Ingreso 2027: PdL 16/10 y 30/10, Matemática 23/10.
 * Rúbricas oficiales (Examen 16-10/Rúbrica.pdf y Examen 23-10/..._Criterios.pdf) y cuentas de los profesores.
 * Las respuestas esperadas NO van acá (el sitio y el repositorio son públicos): Dirección las sube a
 * Firebase desde Publicación (ver 'Examen 23-10/respuestas_matematica.json', fuera del repositorio).
 */
window.PDL_CONFIG = {
  // Profesores de PdL: solo acceden a la corrección de PdL (EST/instancias.html).
  // Crear cada cuenta en Firebase Console > Authentication, copiar su UID acá
  // y también en firestore.rules (función isProfesorPdl).
  profesores: [
    { uid: "unXa7nmvUUaO6m4TWyVS57sh6Bu2", name: "Matias Demaro", email: "matias.demaro@inspt.utn.edu.ar", color: "#a855f7" },
    { uid: "gMq0OP0avdYqcU78JjE7SBH7uh23", name: "Alexis Tagliavini", email: "alexis.tagliavini@inspt.utn.edu.ar", color: "#ec4899" }
  ],

  // Profesores de Matemática: solo acceden a la corrección de Matemática 23/10.
  // Reemplazar cada UID, nombre y correo (y los UID en firestore.rules, función isProfesorMat).
  // Las cuentas que todavía tienen el UID de ejemplo (MAT_PROF_...) no aparecen en el inicio de sesión.
  profesoresMat: [
    { uid: "Ek3ZgDKrRehA7fvvdf27LLGnb8o2", name: "Prof Mat1", email: "profmat1@gmail.com" },
    { uid: "yNuJfF5xrrMaTyjqFvKvfYb0DR72", name: "Prof Mat2", email: "profmat2@gmail.com" },
    { uid: "LBuXuiDLIyYhJX3FdoXHmWUcTYI3", name: "Prof Mat3", email: "profmat3@gmail.com" },
    { uid: "AsE3I8RHS2bAK923LDkQnyNGnMH2", name: "Prof Mat4", email: "profmat4@gmail.com" },
    { uid: "zrFqOLTgNOSWA3WBcqw9HHQ3Wfo2", name: "Prof Mat5", email: "profmat5@gmail.com" }
  ],

  // PdL 30/10 (Examen 30-10/EXAMEN PdL EST 2027 V2.pdf): tema único, "La intrusa" de Pedro Orgambide.
  // 15 ítems numerados como en la hoja: 1a–1f comprensión (0,50 c/u), 2a–2f gramática (0,50 c/u),
  // 3a–3c producción escrita (0,50 · 2,50 · 1,00). Total 10. El 'criterio' es el tema evaluado que ven las familias;
  // 'guia' es una orientación para los profesores (no se publica a las familias).
  pdl3010: {
    secciones: [
      // 'numero': como se numeran las consignas en la hoja del examen (1, 2, 3)
      { id: "A", numero: "1", titulo: "Comprensión lectora", max: 3.0 },
      { id: "B", numero: "2", titulo: "Gramática, Normativa y Ortografía", max: 3.0 },
      { id: "C", numero: "3", titulo: "Producción Escrita / Redacción", max: 4.0 }
    ],
    items: [
      {
        id: "1a", seccion: "A", criterio: "Persona gramatical y género del texto",
        niveles: [
          { pts: 0.5, desc: "Identifica la 1.ª persona (narrador protagonista) y el género (narrativo / cuento)" },
          { pts: 0.25, desc: "Identifica solo uno de los dos elementos" },
          { pts: 0, desc: "Incorrecto o no responde" }
        ],
        guia: "1.ª persona (narra González, el protagonista) • texto narrativo / cuento"
      },
      {
        id: "1b", seccion: "A", criterio: "Referencia pronominal",
        niveles: [
          { pts: 0.5, desc: "Identifica el pronombre con que se nombra a “la intrusa”" },
          { pts: 0, desc: "Incorrecto o no responde" }
        ],
        guia: "“ella” (también se acepta “ésa”)"
      },
      {
        id: "1c", seccion: "A", criterio: "Relación título e idea central / sentido global",
        niveles: [
          { pts: 0.5, desc: "Explica que “la intrusa” es la computadora y que parece hablar de una mujer o rival" },
          { pts: 0.25, desc: "Responde solo una de las dos partes o de forma vaga" },
          { pts: 0, desc: "Sin fundamentación o errónea" }
        ],
        guia: "El título alude a la computadora que llegó a la oficina; el protagonista habla como si fuera una mujer (una rival)"
      },
      {
        id: "1d", seccion: "A", criterio: "Caracterización y motivación del personaje",
        niveles: [
          { pts: 0.5, desc: "Describe el carácter del protagonista y explica por qué rechazaba a “la intrusa”" },
          { pts: 0.25, desc: "Responde solo una de las dos partes o de forma incompleta" },
          { pts: 0, desc: "Incorrecto" }
        ],
        guia: "Ordenado, cumplidor, orgulloso de su trabajo y apegado a sus principios; la rechazaba porque lo desplazaba y terminó reemplazándolo"
      },
      {
        id: "1e", seccion: "A", criterio: "Comprensión literal del desenlace",
        niveles: [
          { pts: 0.5, desc: "Responde completo y preciso según el texto" },
          { pts: 0.25, desc: "Respuesta incompleta o con imprecisiones menores" },
          { pts: 0, desc: "Incorrecto o descontextualizado" }
        ],
        guia: "La insultó y la golpeó con un fierro (la rompió)"
      },
      {
        id: "1f", seccion: "A", criterio: "Situación comunicativa del relato",
        niveles: [
          { pts: 0.5, desc: "Ubica el momento: declara ante el juez, después de haber destruido la computadora" },
          { pts: 0.25, desc: "Ubicación parcial o imprecisa" },
          { pts: 0, desc: "Incorrecto" }
        ],
        guia: "Después de los hechos, cuando González declara ante el juez (en el juicio), tras haber roto la computadora"
      },
      {
        id: "2a", seccion: "B", criterio: "Pluralización morfológica y ortográfica",
        niveles: [
          { pts: 0.5, desc: "Plural correcto con ortografía precisa" },
          { pts: 0.25, desc: "Plural correcto con error ortográfico" },
          { pts: 0, desc: "Error o sin responder" }
        ],
        guia: "jueces (la z cambia a c)"
      },
      {
        id: "2b", seccion: "B", criterio: "Identificación de sustantivos abstractos",
        niveles: [
          { pts: 0.5, desc: "2 sustantivos abstractos pertinentes del texto" },
          { pts: 0.25, desc: "Solo 1 correcto o extraídos fuera del texto" },
          { pts: 0, desc: "Ninguno correcto" }
        ],
        guia: "Ej.: culpa, conducta, exageración, principios, apetito, servicios, carrera, vida"
      },
      {
        id: "2c", seccion: "B", criterio: "Reconocimiento de adjetivos numerales",
        niveles: [
          { pts: 0.5, desc: "Identifica y extrae un adjetivo numeral del texto" },
          { pts: 0, desc: "Incorrecto o de otra clase" }
        ],
        guia: "veinte (años); también primero (ordinal)"
      },
      {
        id: "2d", seccion: "B", criterio: "Separación en sílabas",
        niveles: [
          { pts: 0.5, desc: "Separa sin errores" },
          { pts: 0, desc: "Con errores" }
        ],
        guia: "con-duc-ta"
      },
      {
        id: "2e", seccion: "B", criterio: "Léxico: sinónimos contextuales",
        niveles: [
          { pts: 0.5, desc: "2 sinónimos precisos y adecuados" },
          { pts: 0.25, desc: "Solo 1 sinónimo adecuado" },
          { pts: 0, desc: "Erróneos o sin sinónimos" }
        ],
        guia: "apetito → hambre, ganas de comer • alcahuetería → chisme, soplo, delación"
      },
      {
        id: "2f", seccion: "B", criterio: "Acentuación y reglas ortográficas",
        niveles: [
          { pts: 0.5, desc: "Justifica la ausencia de tilde y enuncia la regla" },
          { pts: 0.25, desc: "Regla incompleta" },
          { pts: 0, desc: "Incorrecto" }
        ],
        guia: "ex-tran-je-ra es grave terminada en vocal: las graves llevan tilde solo si no terminan en n, s o vocal"
      },
      {
        id: "3a", seccion: "C", criterio: "Título y persona gramatical entre paréntesis",
        niveles: [
          { pts: 0.5, desc: "Título pertinente y persona indicada entre paréntesis" },
          { pts: 0.25, desc: "Solo el título o solo la persona" },
          { pts: 0, desc: "Omite ambos" }
        ]
      },
      {
        id: "3b", seccion: "C", criterio: "Desarrollo narrativo, coherencia y extensión (mín. 15 renglones)",
        niveles: [
          { pts: 2.5, desc: "Excelente: 15+ renglones, original, fluida, buen vocabulario y ortografía" },
          { pts: 1.75, desc: "Bueno: 12 a 14 renglones, buena coherencia, leves errores" },
          { pts: 1, desc: "En proceso: 8 a 11 renglones o falencias notorias" },
          { pts: 0, desc: "Insuficiente: menos de 8 renglones, incomprensible o fuera de tema" }
        ]
      },
      {
        id: "3c", seccion: "C", criterio: "Estructura narrativa explicitada (introducción, nudo, desenlace)",
        niveles: [
          { pts: 1, desc: "Señala los tres momentos" },
          { pts: 0.5, desc: "Señala solo 2 de las 3 partes" },
          { pts: 0, desc: "No identifica la estructura" }
        ]
      }
    ]
  },

  // Ingreso: entran los mejores 'cupo' estudiantes según el promedio de PdL y Matemática (2da instancia).
  // No hay nota de aprobación por examen. Si hay empate en el último lugar, decide Dirección.
  ingreso: {
    cupo: 81
  },

  // Matemática 23/10: cada ítem se califica B / B⁻ / R / M / NR sobre su puntaje.
  // Nota del examen: suma exacta de los puntajes (se muestra con 2 decimales), de 1 a 10.
  // 'tema' es lo evaluado en cada ejercicio (lo ven las familias); las consignas no se publican.
  matematica: {
    calificaciones: [
      { id: "B", label: "B", nombre: "Bien", factor: 1, desc: "Planteo correcto, desarrollo coherente y resultado final correcto. También si lo resuelve bien con conceptos no vistos." },
      { id: "B-", label: "B⁻", nombre: "Bien menos", factor: 0.75, desc: "Planteo y desarrollo correctos con errores menores de cálculo, o error de arrastre con procedimiento correcto." },
      { id: "R", label: "R", nombre: "Regular", factor: 0.5, desc: "Planteo correcto al inicio pero incompleto, o con errores algebraicos o numéricos relevantes." },
      { id: "M", label: "M", nombre: "Mal", factor: 0, desc: "Errores conceptuales graves, procedimiento incorrecto." },
      { id: "NR", label: "NR", nombre: "No resuelve", factor: 0, desc: "En blanco, sin intento, o resultado sin ningún desarrollo ni justificación." }
    ],
    items: [
      { id: "1a", ejercicio: "1", puntaje: 0.75, tema: "Operaciones combinadas con números naturales" },
      { id: "1b", ejercicio: "1", puntaje: 0.75, tema: "Operaciones con fracciones" },
      { id: "2a", ejercicio: "2", puntaje: 0.5, tema: "Múltiplos comunes" },
      { id: "2b", ejercicio: "2", puntaje: 0.5, tema: "Porcentaje" },
      { id: "3a", ejercicio: "3", puntaje: 0.75, tema: "Proporcionalidad directa" },
      { id: "3b", ejercicio: "3", puntaje: 0.75, tema: "Proporcionalidad directa" },
      { id: "4", ejercicio: "4", puntaje: 1, tema: "Ángulos" },
      { id: "5", ejercicio: "5", puntaje: 1, tema: "Fracción de una cantidad (problema)" },
      { id: "6", ejercicio: "6", puntaje: 1, tema: "Resolución de problemas con operaciones" },
      { id: "7", ejercicio: "7", puntaje: 1, tema: "Perímetro de figuras" },
      { id: "8", ejercicio: "8", puntaje: 2, tema: "Área y perímetro de figuras" }
    ]
  },

  // Instancias del ingreso. 'mc': examen múltiple choice (sistema del personal, EST/index.html);
  // 'pdl' y 'mat': segunda instancia (EST/instancias.html) para los que pasan. 'rubrica' indica una rúbrica
  // propia de esa fecha (PdL 30/10 tuvo otro examen); si no está, se usa la del tipo. 'encuentroId' es el encuentro
  // de la toma de lista (EXAM_CONFIG.encuentros / 'instance_attendance'): el presentismo es uno solo.
  instancias: [
    { id: "02-10", tipo: "mc", icono: "📝", titulo: "Ingreso 2/10", detalle: "Múltiple choice • Matemática y PdL", fechaTexto: "Viernes 2 de octubre" },
    { id: "16-10", encuentroId: "pdl_16_10", tipo: "pdl", icono: "📖", titulo: "PdL 16/10", detalle: "Prácticas del Lenguaje • cronograma general", fechaTexto: "Viernes 16 de octubre" },
    { id: "23-10", encuentroId: "mat_23_10", tipo: "mat", icono: "📐", titulo: "Matemática 23/10", detalle: "Matemática • todos los que pasan", fechaTexto: "Viernes 23 de octubre" },
    { id: "30-10", encuentroId: "pdl_30_10", tipo: "pdl", rubrica: "pdl3010", icono: "📖", titulo: "PdL 30/10", detalle: "Prácticas del Lenguaje • cronograma alternativo • tema único", fechaTexto: "Viernes 30 de octubre" }
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
