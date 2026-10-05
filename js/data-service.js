/**
 * Data Service - Examen de Ingreso 2027
 * Escuela Secundaria Técnica – UTN – San Miguel
 * Gestión centralizada de datos y motor de doble carga cruzada en Firestore.
 */

(function () {
  class DataService {
    constructor() {
      this.students = window.INITIAL_STUDENTS || [];
      // Cargar respaldo local previo de localStorage
      let localSubs = [];
      try {
        localSubs = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
      } catch (e) {}
      this.submissions = localSubs;
      this.resolutions = {}; // studentId -> resolution object
      this.currentUserProfile = null;
      this.listeners = new Set();
      this.init();
    }

    init() {
      // Inicializar atributos auxiliares en estudiantes
      this.students.forEach(st => {
        const pair = window.FirebaseSyncService.getAssignedPreceptorsForStudent ? window.FirebaseSyncService.getAssignedPreceptorsForStudent(st.nro) : [];
        st.assignedPreceptors = pair;
        st.assignedUid1 = pair[0] ? pair[0].uid : '';
        st.assignedName1 = pair[0] ? pair[0].name : '';
        st.assignedUid2 = pair[1] ? pair[1].uid : '';
        st.assignedName2 = pair[1] ? pair[1].name : '';
      });
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    notify() {
      this.listeners.forEach(fn => {
        try { fn(); } catch (err) { console.error('Listener error:', err); }
      });
    }

    setCurrentUserProfile(profile) {
      this.currentUserProfile = profile;
      this.notify();
    }

    getCurrentUser() {
      return this.currentUserProfile;
    }

    isAdmin() {
      return this.currentUserProfile && (this.currentUserProfile.isAdmin === true);
    }

    // Cantidad real de exámenes rendidos (hojas físicas a corregir)
    getTotalExamsTaken() {
      return 223;
    }

    getTotalLoadsNeeded() {
      return this.getTotalExamsTaken() * 2;
    }

    // --- MÉTODOS DE SINCRONIZACIÓN FIRESTORE ---

    setSubmissionsFromCloud(cloudSubs) {
      const map = new Map();
      // 1. Cargar locales
      (this.submissions || []).forEach(s => {
        if (s && s.studentId && s.preceptorUid) {
          map.set(`${s.studentId}_${s.preceptorUid}`, s);
        }
      });
      // 2. Unir y sobreescribir con los de la nube
      (cloudSubs || []).forEach(s => {
        if (s && s.studentId && s.preceptorUid) {
          map.set(`${s.studentId}_${s.preceptorUid}`, s);
        }
      });
      this.submissions = Array.from(map.values());
      this.notify();
    }

    setResolutionsFromCloud(cloudRes) {
      this.resolutions = cloudRes || {};
      this.notify();
    }

    setAttendanceFromCloud(attendMap) {
      if (!attendMap) return;
      let changed = false;
      this.students.forEach(s => {
        if (attendMap[s.id] !== undefined && s.asistio !== attendMap[s.id]) {
          s.asistio = attendMap[s.id];
          s.asistio_original = attendMap[s.id] ? 'si' : 'no';
          changed = true;
        }
      });
      if (changed) this.notify();
    }

    // --- ACCESO A ESTUDIANTES ---

    getStudents() {
      return this.students;
    }

    getStudentById(id) {
      return this.students.find(s => s.id === id);
    }

    getStudentByDni(dni) {
      if (!dni) return null;
      const clean = String(dni).replace(/\D/g, '');
      return this.students.find(s => String(s.dni).replace(/\D/g, '') === clean);
    }

    // Retorna los alumnos asignados al preceptor logueado
    getMyAssignedStudents() {
      if (!this.currentUserProfile || this.currentUserProfile.isAdmin) {
        return this.students;
      }
      const myUid = this.currentUserProfile.uid;
      return this.students.filter(s => s.assignedUid1 === myUid || s.assignedUid2 === myUid);
    }

    async updateStudentAttendance(studentId, asistio) {
      const student = this.getStudentById(studentId);
      if (student) {
        student.asistio = !!asistio;
        student.asistio_original = asistio ? 'si' : 'no';
        this.notify();
        await window.FirebaseSyncService.pushAttendance(studentId, !!asistio);
        return true;
      }
      return false;
    }

    getAulas() {
      const setAulas = new Set();
      this.students.forEach(s => {
        if (s.aula) setAulas.add(s.aula);
      });
      return Array.from(setAulas).sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
    }

    getEscuelas() {
      const map = {};
      this.students.forEach(s => {
        const esc = s.escuela_origen || 'No especificada';
        map[esc] = (map[esc] || 0) + 1;
      });
      return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }

    // --- CÁLCULO DE CALIFICACIÓN ---

    calculateScore(tema, answers) {
      if (!window.EXAM_CONFIG || !window.EXAM_CONFIG.questions) {
        return { scoreMath: 0, scoreLang: 0, scoreTotal: 0, correctCount: 0, details: [] };
      }

      const questions = window.EXAM_CONFIG.questions;

      if (!tema || (tema !== 'A' && tema !== 'B')) {
        return {
          scoreMath: null,
          scoreLang: null,
          scoreTotal: null,
          correctCount: 0,
          totalQuestions: questions.length,
          hasTema: false,
          details: questions.map(q => ({
            n: q.n,
            subject: q.subject,
            topic: q.topic,
            criterion: q.criterion,
            expected: null,
            answered: (answers[q.n] || '').trim().toUpperCase(),
            isCorrect: false,
            points: 0
          }))
        };
      }

      let scoreMath = 0;
      let scoreLang = 0;
      let correctCount = 0;
      const details = [];

      questions.forEach(q => {
        const key = (tema === 'B') ? q.temaB : q.temaA;
        const studentAns = (answers[q.n] || '').trim().toUpperCase();
        const isCorrect = studentAns === key;
        const points = isCorrect ? (window.EXAM_CONFIG.pointsPerQuestion || 0.5) : 0;

        if (q.n <= 10) {
          if (isCorrect) scoreMath += points;
        } else {
          if (isCorrect) scoreLang += points;
        }

        if (isCorrect) correctCount++;

        details.push({
          n: q.n,
          subject: q.subject,
          topic: q.topic,
          criterion: q.criterion,
          expected: key,
          answered: studentAns,
          isCorrect,
          points
        });
      });

      scoreMath = Math.round(scoreMath * 100) / 100;
      scoreLang = Math.round(scoreLang * 100) / 100;
      const scoreTotal = Math.round((scoreMath + scoreLang) * 100) / 100;

      return {
        scoreMath,
        scoreLang,
        scoreTotal,
        correctCount,
        totalQuestions: questions.length,
        hasTema: true,
        details
      };
    }

    // --- CARGA DE EXAMEN A FIRESTORE ---

    async saveExamSubmission({ studentId, tema, answers, isAbsent = false, notes = '' }) {
      const student = this.getStudentById(studentId);
      if (!student) throw new Error('Estudiante no encontrado');

      const userProfile = this.currentUserProfile;
      if (!userProfile) throw new Error('No hay usuario autenticado en Firebase');

      if (!isAbsent && (!tema || (tema !== 'A' && tema !== 'B'))) {
        throw new Error('Debés seleccionar Tema A o Tema B para guardar la calificación.');
      }

      // Actualizar asistencia
      if (isAbsent) {
        student.asistio = false;
        student.asistio_original = 'no';
      } else {
        student.asistio = true;
        student.asistio_original = 'si';
      }

      const scoreData = isAbsent ? { scoreMath: 0, scoreLang: 0, scoreTotal: 0, correctCount: 0 } : this.calculateScore(tema, answers);

      const submissionRecord = {
        studentId,
        studentDni: student.dni,
        studentName: `${student.apellido}, ${student.nombre}`,
        aula: student.aula,
        preceptorUid: userProfile.uid,
        preceptorName: userProfile.name,
        timestamp: new Date().toISOString(),
        tema,
        answers: isAbsent ? {} : answers,
        scoreMath: scoreData.scoreMath,
        scoreLang: scoreData.scoreLang,
        scoreTotal: scoreData.scoreTotal,
        correctCount: scoreData.correctCount,
        isAbsent,
        notes
      };

      // 1. Guardar de inmediato en memoria local de la app para actualización instantánea
      const existingIdx = this.submissions.findIndex(s => s.studentId === studentId && s.preceptorUid === userProfile.uid);
      if (existingIdx >= 0) {
        this.submissions[existingIdx] = submissionRecord;
      } else {
        this.submissions.push(submissionRecord);
      }
      this.notify();

      // 2. Persistir local y en la nube
      const cloudResult = await window.FirebaseSyncService.pushSubmission(submissionRecord);
      window.FirebaseSyncService.pushAttendance(studentId, student.asistio);

      return {
        ...submissionRecord,
        ...cloudResult
      };
    }

    getSubmissionsForStudent(studentId) {
      return this.submissions.filter(s => s.studentId === studentId);
    }

    // --- RESOLUCIÓN MANUAL POR PARTE DEL DIRECTOR ---

    async resolveDiscrepancy(studentId, officialData) {
      const calc = this.calculateScore(officialData.tema, officialData.answers);
      const resRecord = {
        studentId,
        tema: officialData.tema,
        answers: officialData.answers,
        scoreMath: calc.scoreMath,
        scoreLang: calc.scoreLang,
        scoreTotal: calc.scoreTotal,
        correctCount: calc.correctCount,
        resolvedBy: this.currentUserProfile ? this.currentUserProfile.name : 'Dirección',
        resolvedByUid: this.currentUserProfile ? this.currentUserProfile.uid : '',
        timestamp: new Date().toISOString(),
        notes: officialData.notes || 'Resolución oficial verificada con examen físico'
      };

      await window.FirebaseSyncService.pushResolution(studentId, resRecord);
      return resRecord;
    }

    // --- MOTOR DE AUDITORÍA Y DOBLE CARGA CRUZADA ---

    getStudentAuditStatus(studentId) {
      const student = this.getStudentById(studentId);
      if (!student) return null;

      // 1. Si el Director ya la resolvió oficialmente
      if (this.resolutions[studentId]) {
        const res = this.resolutions[studentId];
        return {
          status: 'resuelta',
          badgeText: 'Discrepancia Resuelta',
          badgeClass: 'badge-resolved',
          officialTema: res.tema,
          officialAnswers: res.answers,
          scoreTotal: res.scoreTotal,
          scoreMath: res.scoreMath,
          scoreLang: res.scoreLang,
          loadsCount: this.getSubmissionsForStudent(studentId).length,
          discrepancyCount: 0,
          discrepantQuestions: [],
          submissions: this.getSubmissionsForStudent(studentId)
        };
      }

      const subs = this.getSubmissionsForStudent(studentId);
      if (subs.length === 0) {
        return {
          status: 'sin_cargar',
          badgeText: student.asistio ? 'Sin Cargar' : 'Ausente (Pendiente)',
          badgeClass: 'badge-pending',
          loadsCount: 0,
          discrepancyCount: 0,
          discrepantQuestions: [],
          submissions: [],
          scoreTotal: null,
          scoreMath: null,
          scoreLang: null
        };
      }

      if (subs.length === 1) {
        const s = subs[0];
        return {
          status: 'carga_simple',
          badgeText: `Carga Simple (${s.preceptorName})`,
          badgeClass: 'badge-single',
          officialTema: s.tema,
          officialAnswers: s.answers,
          scoreTotal: s.scoreTotal,
          scoreMath: s.scoreMath,
          scoreLang: s.scoreLang,
          loadsCount: 1,
          discrepancyCount: 0,
          discrepantQuestions: [],
          submissions: subs
        };
      }

      // Si hay 2 o más cargas, comparamos
      const first = subs[0];
      let hasDiscrepancy = false;
      const discrepantQuestions = [];

      // Chequear si difieren en Tema (A vs B)
      const temaMismatch = subs.some(s => s.tema !== first.tema);
      if (temaMismatch) {
        hasDiscrepancy = true;
      }

      // Chequear cada una de las 20 preguntas
      for (let n = 1; n <= 20; n++) {
        const ansMap = {};
        subs.forEach(s => {
          const val = (s.answers && s.answers[n]) ? s.answers[n] : '-';
          ansMap[s.preceptorUid] = { preceptorName: s.preceptorName, answer: val };
        });

        const distinctAnswers = new Set(Object.values(ansMap).map(x => x.answer));
        if (distinctAnswers.size > 1) {
          hasDiscrepancy = true;
          discrepantQuestions.push({
            questionNumber: n,
            answersByPreceptor: ansMap
          });
        }
      }

      if (hasDiscrepancy) {
        return {
          status: 'discrepancia',
          badgeText: `⚠️ Discrepancia (${discrepantQuestions.length} preg.)`,
          badgeClass: 'badge-discrepancy',
          loadsCount: subs.length,
          discrepancyCount: discrepantQuestions.length,
          discrepantQuestions,
          temaMismatch,
          submissions: subs,
          scoreTotal: null
        };
      }

      // ¡Coincidencia perfecta en la Doble Carga!
      return {
        status: 'coincidente',
        badgeText: '✅ Carga Coincidente',
        badgeClass: 'badge-matched',
        officialTema: first.tema,
        officialAnswers: first.answers,
        scoreTotal: first.scoreTotal,
        scoreMath: first.scoreMath,
        scoreLang: first.scoreLang,
        loadsCount: subs.length,
        discrepancyCount: 0,
        discrepantQuestions: [],
        submissions: subs
      };
    }

    getConsolidatedResults() {
      return this.students.map(student => {
        const audit = this.getStudentAuditStatus(student.id);
        let finalScore = null;
        let finalMath = null;
        let finalLang = null;
        let tema = null;
        let answers = null;

        if (audit.status === 'coincidente' || audit.status === 'resuelta' || audit.status === 'carga_simple') {
          finalScore = audit.scoreTotal;
          finalMath = audit.scoreMath;
          finalLang = audit.scoreLang;
          tema = audit.officialTema;
          answers = audit.officialAnswers;
        }

        return {
          student,
          audit,
          finalScore,
          finalMath,
          finalLang,
          tema,
          answers,
          isPassed: finalScore !== null ? finalScore >= 6.0 : null
        };
      });
    }

    // --- MONITOREO DE PROGRESO DE PRECEPTORES (REPARTICIÓN POR CANTIDAD) ---

    getPreceptorProgress(preceptorUid) {
      const pList = window.FirebaseSyncService.getPreceptorsList();
      const preceptor = pList.find(p => p.uid === preceptorUid);
      if (!preceptor) return null;

      // Meta por cantidad: 223 exámenes rendidos × 2 cargas = 446, repartidas exactamente entre los preceptores
      const count = pList.length || 7;
      const totalLoads = this.getTotalLoadsNeeded();
      const base = Math.floor(totalLoads / count);
      const remainder = totalLoads % count;
      const pIdx = pList.findIndex(p => p.uid === preceptorUid);
      const targetQuota = base + (pIdx < remainder ? 1 : 0);
      const mySubs = this.submissions.filter(s => s.preceptorUid === preceptorUid);
      const myLoadedStudentIds = new Set(mySubs.map(s => s.studentId));

      let matchedWithPartner = 0;
      let discrepancyWithPartner = 0;
      let partnerPending = 0;

      const studentDetails = this.students.map(st => {
        const subs = this.getSubmissionsForStudent(st.id);
        const mySub = subs.find(s => s.preceptorUid === preceptorUid);
        const otherSubs = subs.filter(s => s.preceptorUid !== preceptorUid);
        const isLoadedByMe = !!mySub;
        const audit = this.getStudentAuditStatus(st.id);

        let matchStatus = 'unloaded';
        let partnerName = '-';
        let partnerScore = null;

        if (otherSubs.length > 0) {
          partnerName = otherSubs.map(x => x.preceptorName).join(', ');
          partnerScore = otherSubs[0].scoreTotal;
        }

        if (isLoadedByMe && otherSubs.length > 0) {
          if (audit.status === 'coincidente') {
            matchStatus = 'coincidente';
            matchedWithPartner++;
          } else if (audit.status === 'discrepancia') {
            matchStatus = 'discrepancia';
            discrepancyWithPartner++;
          } else {
            matchStatus = audit.status;
          }
        } else if (isLoadedByMe && otherSubs.length === 0) {
          matchStatus = 'partner_pending';
          partnerPending++;
        } else if (!isLoadedByMe && otherSubs.length === 1) {
          matchStatus = 'needs_second_load';
        } else if (!isLoadedByMe && otherSubs.length >= 2) {
          matchStatus = 'already_completed_by_others';
        } else {
          matchStatus = 'unloaded';
        }

        return {
          student: st,
          isLoadedByMe,
          myScore: mySub ? mySub.scoreTotal : null,
          partnerName,
          partnerScore,
          loadsCount: subs.length,
          matchStatus
        };
      });

      const loadedCount = myLoadedStudentIds.size;
      const pendingCount = Math.max(0, targetQuota - loadedCount);
      const percent = Math.min(100, Math.round((loadedCount / targetQuota) * 100));

      return {
        preceptor,
        targetQuota,
        totalAssigned: targetQuota,
        loadedCount,
        pendingCount,
        percent,
        matchedWithPartner,
        discrepancyWithPartner,
        partnerPending,
        studentDetails
      };
    }

    getAllPreceptorsProgress() {
      const pList = window.FirebaseSyncService.getPreceptorsList();
      return pList.map(p => this.getPreceptorProgress(p.uid));
    }
  }

  window.DataService = new DataService();
})();
