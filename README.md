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

## ☁️ Conexión con Firebase Firestore

- **Proyecto:** `exingutn2027`
- Todas las lecturas y escrituras van directamente a Firestore en tiempo real (`exam_submissions`, `exam_resolutions`, `students_attendance`).
- No requiere configuración manual: las credenciales oficiales ya están protegidas y activas en el sistema.
- Cualquier examen guardado en una notebook se actualiza inmediatamente en las pantallas de las demás notebooks conectadas y en el panel central de la Dirección.

---

## 🚀 Cómo Abrir la Aplicación

1. Hacé doble clic en [`index.html`](file:///c:/Users/ipave/Desktop/Examen%20de%20ingreso/index.html) en tu navegador habitual, o abrí [**http://localhost:8080**](http://localhost:8080).
2. Verás la pantalla de inicio de sesión de Firebase.
3. Hacé clic en tu nombre o ingresá tu correo y contraseña para acceder.
