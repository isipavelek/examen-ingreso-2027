# Sistema de Gestión, Doble Carga y Analíticas del Examen de Ingreso 2027
### Escuela Secundaria Técnica – UTN – San Miguel

Aplicación web oficial conectada en tiempo real a **Google Firebase Firestore & Firebase Authentication**. Permite la carga ágil de exámenes, el esquema balanceado de **doble carga cruzada entre preceptores**, auditoría de discrepancias y analíticas pedagógicas en vivo.

---

## 🔐 Autenticación Exclusiva con Firebase Auth

El acceso está estrictamente protegido por **Firebase Authentication**. Cada miembro del personal ingresa con su cuenta y contraseña registrada:

| Cargo / Nombre | UID Oficial de Firebase | Email Institucional | Permisos y Vistas |
| :--- | :--- | :--- | :--- |
| **Director General** | `uNHF999HedgtuI5BQDpOOH1eBD03` | `ipavelek@gmail.com` | **Acceso Total Directivo:** Carga, Monitor de Preceptores, Auditoría de Doble Carga, Resolución de Discrepancias, Estadísticas Pedagógicas, Exportación y Padrón. |
| **Vicedirección** | `laVFIzdRPWPFUvPWBdGcZIlZPSA2` | `santiago.poggio@inspt.utn.edu.ar` | **Acceso Total Directivo:** Idem Dirección. |
| **Cecilia** | `1OaYaghiGSTs0YAiKaRjIKJfk4g2` | `est.sanmiguel@inspt.utn.edu.ar` | **Preceptoría:** Carga de sus 125 exámenes asignados, Dashboard "Mi Progreso" y Padrón de Contactos. |
| **Adrian** | `5fqlfqIFCHUwY2RfBK10HcoFu2H2` | `adrian.escudero@inspt.utn.edu.ar` | **Preceptoría:** Carga de sus 124 exámenes asignados, Dashboard "Mi Progreso" y Padrón de Contactos. |
| **Benhamin** | `UQj5suJsRmfbHlj7bm7nx5VOf692` | `benhamin.gimenez@inspt.utn.edu.ar` | **Preceptoría:** Carga de sus 124 exámenes asignados, Dashboard "Mi Progreso" y Padrón de Contactos. |
| **Geraldine** | `d57D2kOpFWS8vMLVOBPWFb7kn2q1` | `geraldine.crousaz@inspt.utn.edu.ar` | **Preceptoría:** Carga de sus 124 exámenes asignados, Dashboard "Mi Progreso" y Padrón de Contactos. |
| **Karen** | `M4uLZtXQO7ezGS5M8vRd0lF9Vxj2` | `karen.pereira@inspt.utn.edu.ar` | **Preceptoría:** Carga de sus 124 exámenes asignados, Dashboard "Mi Progreso" y Padrón de Contactos. |

---

## 👥 Esquema Oficial de Doble Carga Cruzada

Para corroborar la corrección humana sin sobrecargar al equipo:
1. **Cada examen físico es cargado de manera independiente por DOS preceptores distintos.**
2. La carga de los 311 estudiantes se distribuye equitativamente en parejas rotativas:
   - **Cecilia:** 125 evaluaciones
   - **Adrian:** 124 evaluaciones
   - **Benhamin:** 124 evaluaciones
   - **Geraldine:** 124 evaluaciones
   - **Karen:** 124 evaluaciones
   *(Total: 622 evaluaciones = 311 estudiantes &times; 2 cargas independientes).*
3. Al iniciar sesión, el preceptor ve por defecto la vista **🎯 Mis Asignados (Doble Carga)** con su porción asignada, aunque también puede conmutar a **📋 Todos los Estudiantes** si necesita colaborar en otra aula.
4. **Detección Automática de Discrepancias:**
   - Si ambas cargas coinciden al 100%: Aparece la etiqueta verde **✅ Carga Coincidente**.
   - Si discrepan en alguna pregunta: Aparece la etiqueta roja **⚠️ Discrepancia**. La Dirección visualiza las dos cargas en paralelo y define la nota oficial verificada en el papel.

---

## ⚡ Carga Ágil con Atajos de Teclado (Ultra-Fast Entry)

- **Marcar respuesta:** Teclas `A`, `B`, `C` o `D` (o números `1`, `2`, `3`, `4`). Se marca y el foco avanza automáticamente a la siguiente pregunta.
- **Navegar preguntas:** Flechas `▲ Arriba` / `▼ Abajo`.
- **Borrar respuesta:** Tecla `Retroceso` o `Supr`.
- **Pregunta en blanco:** Tecla `Espacio`.
- **Guardar y pasar al siguiente alumno:** Tecla `Enter`.
- **Cambiar Tema A / B:** Teclas `Alt + A` o `Alt + B`.
- **Marcar Ausente:** Botón directo "Ausente".

---

## 🔒 Cierre de la Carga del Multiple Choice

Con `cargaMultipleChoiceCerrada: true` en `data/examConfig.js` los preceptores ya no ven **Carga Ágil** ni **Mi Progreso** y no pueden guardar, anular ni subir cargas. Dirección y Vicedirección conservan el acceso para corregir. Las reglas de `firestore.rules` acompañan el cierre: solo Dirección escribe en `exam_submissions`, `deleted_submissions` y `students_attendance`.

---

## 🗓️ Toma de Lista de los Encuentros (Próxima Instancia)

Pestaña **Asistencia Encuentros**, disponible para preceptores, Dirección y Vicedirección:

- Tres encuentros definidos en `encuentros` de `data/examConfig.js`: PdL 16/10 (cronograma general), Matemática 23/10 (todos los que pasan) y PdL 30/10 (cronograma alternativo). Por defecto se abre el encuentro de hoy o el próximo.
- La lista son los estudiantes que **pasan** y les corresponde ese encuentro. Con *Buscar en todo el padrón* se puede registrar a alguien que no figura en la lista.
- Búsqueda por apellido, nombre (sin importar tildes) o DNI. Si queda un solo resultado, `Enter` lo marca **Presente** y limpia el buscador.
- Tocar de nuevo el estado marcado lo desmarca (vuelve a *Sin tomar*).
- Cada registro queda en Firestore (`instance_attendance/{encuentro}_{estudiante}`) con quién lo marcó y a qué hora, y se ve al instante en todas las PCs y celulares.
- **Descargar asistencia (Excel)**: una hoja por encuentro.

---

## ☁️ Conexión con Firebase Firestore

- **Proyecto:** `exingutn2027`
- Todas las lecturas y escrituras van directamente a Firestore en tiempo real (`exam_submissions`, `exam_resolutions`, `students_attendance`).
- No requiere configuración manual: las credenciales oficiales ya están protegidas y activas en el sistema.
- Cualquier examen guardado en una notebook se actualiza inmediatamente en las pantallas de las demás notebooks conectadas y en el panel central de la Dirección.

---

## 🧭 Acceso único y navegación por instancias

Todos ingresan por **`EST/index.html`** y el sistema deriva a cada uno:

| Usuario | A dónde va |
| :--- | :--- |
| **Preceptores** | Sistema principal (carga del 2/10, Mi Progreso, Padrón). |
| **Profesores de PdL** (Matias Demaro, Alexis Tagliavini) | `EST/instancias.html`: solo PdL 16/10 y PdL 30/10. |
| **Dirección y Vicedirección** | Sistema principal, con una barra para moverse entre **Ingreso 2/10 · PdL 16/10 · Matemática 23/10 · PdL 30/10 · Resumen general**. |

**Cada fecha de la 2da instancia** (`EST/instancias.html?fecha=16-10`, `23-10`, `30-10`) tiene:
- **Presentismo:** es la misma toma de lista de *Asistencia Encuentros* (`instance_attendance`): lo que marcan los preceptores se ve acá y en el Resumen general, y Dirección también puede marcarlo desde esta pestaña. Los profesores de PdL no toman presentismo: solo corrigen, y un examen corregido cuenta como presente.
- **PdL – Corrección por rúbrica:** se pica el nivel de cada uno de los 14 ítems y la nota se arma sola (atajos: `↑/↓` ítem, `1–4` nivel, `0` cero, `A/B` tema, `Enter` terminar).
- **PdL – Resultados:** tabla con nota por sección y planilla Excel.
- **Estadísticas de la instancia:** en PdL, distribución de notas, secciones, ítem por ítem, tema y corrector; en Matemática 23/10, presentismo (su corrección todavía no está cargada).
- **PdL – Publicación (solo Dirección):** se habilita recién cuando todos los exámenes de la fecha están corregidos o ausentes; después los profesores no pueden modificar esa fecha.

**Resumen general** (Dirección): tarjetas por instancia, recorrido de los estudiantes (inscriptos → presentes 2/10 → pasan → presentes y corregidos en 2da instancia), promedio por instancia y la trayectoria de cada estudiante. Las estadísticas particulares del 2/10 siguen en *Estadísticas Pedagógicas*.

**Padrón de la 2da instancia:** lo envía Dirección desde *Actas y Exportación → 📖 Enviar padrón de la 2da instancia* (los que pasan; los del cronograma alternativo rinden PdL el 30/10; todos rinden Matemática el 23/10).

**Corregir datos de un estudiante (solo Dirección):** en *Padrón y Contactos → ✏️ Editar datos* se cambian nombre, DNI, aula, escuela y contacto. Se guarda en `student_overrides` sobre el padrón original (se puede volver al original). Las notas, cargas, condición, correcciones y presentismo quedan vinculados al ID interno del estudiante; si ya tenía resultado publicado, pasa al DNI nuevo. Las listas de Dirección de la configuración (pasa por Dirección, cronograma alternativo) siguen usando el DNI original.

**Profesores de PdL:** su UID, nombre y correo están en `data/pdlConfig.js` y en `firestore.rules` (función `isProfesorPdl`). Si cambian, actualizar ambos y volver a publicar las reglas.

---

## 🚀 Cómo Abrir la Aplicación

- **Estudiantes:** la página principal (`index.html`, la raíz del sitio) es la consulta de resultados con DNI.
- **Personal (Dirección, Vicedirección, Preceptores y Profesores de PdL):** ingresan por `/EST/` (`EST/index.html`). Con un servidor local: [**http://localhost:8080/EST/**](http://localhost:8080/EST/).

1. Abrí `EST/index.html` en tu navegador habitual, o la dirección `/EST/` del sitio publicado.
2. Verás la pantalla de inicio de sesión de Firebase.
3. Hacé clic en tu nombre o ingresá tu correo y contraseña para acceder.
