/**
 * Firebase Sync & Real-Time Cloud Service - Examen de Ingreso 2027
 * Escuela Secundaria Técnica – UTN – San Miguel
 * Operación 100% exclusiva con Firebase Authentication y Firestore Database.
 */

(function () {
  // Credenciales permanentes y seguras del proyecto oficial
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCwfFNfxr_r0oow9pEBwWfA2VzBiFEB7U0",
    authDomain: "exingutn2027.firebaseapp.com",
    projectId: "exingutn2027",
    storageBucket: "exingutn2027.firebasestorage.app",
    messagingSenderId: "605495690912",
    appId: "1:605495690912:web:8fe29d22ed6f90e30f6bc5",
    measurementId: "G-PVDTN94KJE"
  };

  // Mapeo oficial y estricto de UIDs provistos por la institución
  const AUTHORIZED_USERS = {
    // Dirección General
    "uNHF999HedgtuI5BQDpOOH1eBD03": {
      uid: "uNHF999HedgtuI5BQDpOOH1eBD03",
      name: "Director General",
      email: "ipavelek@gmail.com",
      role: "director",
      isAdmin: true,
      color: "#3b82f6"
    },
    // Vicedirección
    "laVFIzdRPWPFUvPWBdGcZIlZPSA2": {
      uid: "laVFIzdRPWPFUvPWBdGcZIlZPSA2",
      name: "Santiago Poggio (Vicedirección)",
      email: "santiago.poggio@inspt.utn.edu.ar",
      role: "vicedirector",
      isAdmin: true,
      color: "#6366f1"
    },
    // Preceptores Oficiales (5)
    "1OaYaghiGSTs0YAiKaRjIKJfk4g2": {
      uid: "1OaYaghiGSTs0YAiKaRjIKJfk4g2",
      name: "Cecilia",
      email: "est.sanmiguel@inspt.utn.edu.ar",
      role: "preceptor",
      preceptorIndex: 0,
      isAdmin: false,
      color: "#10b981"
    },
    "5fqlfqIFCHUwY2RfBK10HcoFu2H2": {
      uid: "5fqlfqIFCHUwY2RfBK10HcoFu2H2",
      name: "Adrian",
      email: "adrian.escudero@inspt.utn.edu.ar",
      role: "preceptor",
      preceptorIndex: 1,
      isAdmin: false,
      color: "#06b6d4"
    },
    "UQj5suJsRmfbHlj7bm7nx5VOf692": {
      uid: "UQj5suJsRmfbHlj7bm7nx5VOf692",
      name: "Benhamin",
      email: "benhamin.gimenez@inspt.utn.edu.ar",
      role: "preceptor",
      preceptorIndex: 2,
      isAdmin: false,
      color: "#f59e0b"
    },
    "d57D2kOpFWS8vMLVOBPWFb7kn2q1": {
      uid: "d57D2kOpFWS8vMLVOBPWFb7kn2q1",
      name: "Geraldine",
      email: "geraldine.crousaz@inspt.utn.edu.ar",
      role: "preceptor",
      preceptorIndex: 3,
      isAdmin: false,
      color: "#ec4899"
    },
    "M4uLZtXQO7ezGS5M8vRd0lF9Vxj2": {
      uid: "M4uLZtXQO7ezGS5M8vRd0lF9Vxj2",
      name: "Karen",
      email: "karen.pereira@inspt.utn.edu.ar",
      role: "preceptor",
      preceptorIndex: 4,
      isAdmin: false,
      color: "#8b5cf6"
    },
    "kmKzi7TRkcTFEMnS3BQ3Gq5NDHe2": {
      uid: "kmKzi7TRkcTFEMnS3BQ3Gq5NDHe2",
      name: "Nestor",
      email: "nscuzzarello@rec.utn.edu.ar",
      role: "preceptor",
      preceptorIndex: 5,
      isAdmin: false,
      color: "#14b8a6"
    },
    "yPNVQ9Ct4nVOtzdE9SyXao8fwW12": {
      uid: "yPNVQ9Ct4nVOtzdE9SyXao8fwW12",
      name: "Emilia",
      email: "emilia.caspani@inspt.utn.edu.ar",
      role: "preceptor",
      preceptorIndex: 6,
      isAdmin: false,
      color: "#f43f5e"
    }
  };

  // Lista de 7 preceptores para la distribución equitativa de cargas cruzadas
  const PRECEPTORS_LIST = [
    { uid: "1OaYaghiGSTs0YAiKaRjIKJfk4g2", name: "Cecilia", email: "est.sanmiguel@inspt.utn.edu.ar", color: "#10b981" },
    { uid: "5fqlfqIFCHUwY2RfBK10HcoFu2H2", name: "Adrian", email: "adrian.escudero@inspt.utn.edu.ar", color: "#06b6d4" },
    { uid: "UQj5suJsRmfbHlj7bm7nx5VOf692", name: "Benhamin", email: "benhamin.gimenez@inspt.utn.edu.ar", color: "#f59e0b" },
    { uid: "d57D2kOpFWS8vMLVOBPWFb7kn2q1", name: "Geraldine", email: "geraldine.crousaz@inspt.utn.edu.ar", color: "#ec4899" },
    { uid: "M4uLZtXQO7ezGS5M8vRd0lF9Vxj2", name: "Karen", email: "karen.pereira@inspt.utn.edu.ar", color: "#8b5cf6" },
    { uid: "kmKzi7TRkcTFEMnS3BQ3Gq5NDHe2", name: "Nestor", email: "nscuzzarello@rec.utn.edu.ar", color: "#14b8a6" },
    { uid: "yPNVQ9Ct4nVOtzdE9SyXao8fwW12", name: "Emilia", email: "emilia.caspani@inspt.utn.edu.ar", color: "#f43f5e" }
  ];

  class FirebaseSyncService {
    constructor() {
      this.isInitialized = false;
      this.db = null;
      this.auth = null;
      this.currentUser = null;
      this.currentProfile = null;
      this.syncStatus = 'connecting';
      this.statusMessage = 'Conectando a Firebase Firestore...';
      this.unsubscribeSubmissions = null;
      this.unsubscribeResolutions = null;
      this.unsubscribeAttendance = null;
      this.init();
    }

    init() {
      if (typeof firebase === 'undefined') {
        console.error('Firebase SDK no cargado en el documento.');
        this.syncStatus = 'error';
        this.statusMessage = 'Error: SDK de Firebase no disponible';
        this.triggerStatusChange();
        return;
      }

      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.isInitialized = true;
        this.syncStatus = 'online';
        this.statusMessage = '🟢 Firebase Firestore Conectado';
        this.triggerStatusChange();

        // 1. Escuchar estado de sesión de Firebase Authentication
        this.setupAuthListener();

        // 2. Escuchar cambios de Firestore en tiempo real
        this.setupFirestoreListeners();
      } catch (err) {
        console.error('Error inicializando Firebase:', err);
        this.syncStatus = 'error';
        this.statusMessage = `Error de conexión: ${err.message}`;
        this.triggerStatusChange();
      }
    }

    getPreceptorsList() {
      return PRECEPTORS_LIST;
    }

    getAuthorizedUsers() {
      return AUTHORIZED_USERS;
    }

    // Calcula de forma determinística los 2 preceptores asignados a cada estudiante
    getAssignedPreceptorsForStudent(studentNro) {
      const len = PRECEPTORS_LIST.length || 7;
      const idx1 = (studentNro - 1) % len;
      const idx2 = studentNro % len;
      return [PRECEPTORS_LIST[idx1], PRECEPTORS_LIST[idx2]];
    }

    // --- AUTENTICACIÓN FIREBASE AUTH ---

    setupAuthListener() {
      if (!this.auth) return;
      this.auth.onAuthStateChanged(firebaseUser => {
        this.currentUser = firebaseUser;
        if (firebaseUser) {
          const authData = AUTHORIZED_USERS[firebaseUser.uid];
          if (authData) {
            this.currentProfile = authData;
            console.log('Firebase Auth exitoso:', authData.name, 'UID:', firebaseUser.uid);
            window.DataService.setCurrentUserProfile(authData);
            this.hideLoginModal();
            if (window.app) {
              window.app.onUserLoggedIn(authData);
            }
          } else {
            console.warn('Usuario no autorizado en el sistema:', firebaseUser.uid, firebaseUser.email);
            alert(`El usuario (${firebaseUser.email || firebaseUser.uid}) no está registrado como Director, Vicedirector o Preceptor autorizado.`);
            this.auth.signOut();
            this.showLoginModal();
          }
        } else {
          this.currentProfile = null;
          this.showLoginModal();
        }
        this.triggerAuthChange(this.currentProfile);
      });
    }

    async signIn(email, password) {
      if (!this.auth) throw new Error('Firebase Auth no disponible.');
      const cred = await this.auth.signInWithEmailAndPassword(email, password);
      return cred.user;
    }

    async signOut() {
      if (this.auth) {
        await this.auth.signOut();
        this.currentProfile = null;
        this.showLoginModal();
      }
    }

    showLoginModal() {
      const modal = document.getElementById('firebaseAuthOverlay');
      if (modal) modal.style.display = 'flex';
    }

    hideLoginModal() {
      const modal = document.getElementById('firebaseAuthOverlay');
      if (modal) modal.style.display = 'none';
    }

    // --- LISTENERS EN TIEMPO REAL FIRESTORE ---

    setupFirestoreListeners() {
      if (!this.isInitialized || !this.db) return;

      const handleFirestoreError = (err, context) => {
        console.error(`Error en listener Firestore (${context}):`, err);
        if (err && (err.code === 'permission-denied' || (err.message && err.message.includes('insufficient permissions')))) {
          this.syncStatus = 'locked';
          this.statusMessage = '🔒 Permiso denegado: Faltan publicar las Reglas en Firebase Console';
          this.triggerStatusChange();
        }
      };

      // 1. Escuchar colección de exámenes cargados
      this.unsubscribeSubmissions = this.db.collection('exam_submissions')
        .onSnapshot(snapshot => {
          this.syncStatus = 'online';
          this.statusMessage = '🟢 Firebase Firestore Conectado';
          this.triggerStatusChange();

          const cloudSubs = [];
          snapshot.forEach(doc => {
            cloudSubs.push(doc.data());
          });
          window.DataService.setSubmissionsFromCloud(cloudSubs);
        }, err => handleFirestoreError(err, 'submissions'));

      // 2. Escuchar resoluciones oficiales de la Dirección
      this.unsubscribeResolutions = this.db.collection('exam_resolutions')
        .onSnapshot(snapshot => {
          const cloudRes = {};
          snapshot.forEach(doc => {
            cloudRes[doc.id] = doc.data();
          });
          window.DataService.setResolutionsFromCloud(cloudRes);
        }, err => handleFirestoreError(err, 'resolutions'));

      // 3. Escuchar asistencias de alumnos
      this.unsubscribeAttendance = this.db.collection('students_attendance')
        .onSnapshot(snapshot => {
          const attendMap = {};
          snapshot.forEach(doc => {
            attendMap[doc.id] = doc.data().asistio;
          });
          window.DataService.setAttendanceFromCloud(attendMap);
        }, err => handleFirestoreError(err, 'attendance'));

      // 4. Intentar vaciar cola de exámenes pendientes de sincronización
      this.flushPendingQueue();
      if (!this.syncInterval) {
        this.syncInterval = setInterval(() => this.flushPendingQueue(), 15000);
      }
    }

    // --- ESCRITURA EN FIRESTORE CON COPIA LOCAL DE SEGURIDAD ---

    saveToLocalStorage(submission) {
      try {
        const localList = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
        const existingIdx = localList.findIndex(s => s.studentId === submission.studentId && s.preceptorUid === submission.preceptorUid);
        if (existingIdx >= 0) {
          localList[existingIdx] = submission;
        } else {
          localList.push(submission);
        }
        localStorage.setItem('saved_exam_submissions', JSON.stringify(localList));
      } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
      }
    }

    addToPendingSyncQueue(submission) {
      try {
        const queue = JSON.parse(localStorage.getItem('pending_cloud_sync_queue') || '[]');
        const existingIdx = queue.findIndex(s => s.studentId === submission.studentId && s.preceptorUid === submission.preceptorUid);
        if (existingIdx >= 0) {
          queue[existingIdx] = submission;
        } else {
          queue.push(submission);
        }
        localStorage.setItem('pending_cloud_sync_queue', JSON.stringify(queue));
      } catch (e) {}
    }

    removeFromPendingSyncQueue(docId) {
      try {
        const queue = JSON.parse(localStorage.getItem('pending_cloud_sync_queue') || '[]');
        const filtered = queue.filter(item => item.id !== docId);
        localStorage.setItem('pending_cloud_sync_queue', JSON.stringify(filtered));
      } catch (e) {}
    }

    async flushPendingQueue() {
      if (!this.db) return { count: 0, synced: 0, failed: 0, error: 'Sin conexión a base de datos' };
      try {
        const localSaved = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
        const pendingQueue = JSON.parse(localStorage.getItem('pending_cloud_sync_queue') || '[]');
        
        // Unir todo lo local asegurando que ningún examen quede sin subir
        const toSyncMap = new Map();
        localSaved.forEach(item => { if (item && item.id) toSyncMap.set(item.id, item); });
        pendingQueue.forEach(item => { if (item && item.id) toSyncMap.set(item.id, item); });

        if (toSyncMap.size === 0) return { count: 0, synced: 0, failed: 0 };

        let syncedCount = 0;
        const failed = [];
        let lastError = null;

        for (const [id, item] of toSyncMap.entries()) {
          try {
            await this.db.collection('exam_submissions').doc(id).set(item, { merge: true });
            syncedCount++;
          } catch (e) {
            lastError = e;
            failed.push(item);
          }
        }

        localStorage.setItem('pending_cloud_sync_queue', JSON.stringify(failed));
        
        if (failed.length > 0 && lastError && (lastError.code === 'permission-denied' || lastError.message.includes('insufficient permissions'))) {
          this.syncStatus = 'locked';
          this.statusMessage = '🔒 Permiso denegado: Faltan publicar las Reglas en Firebase Console';
          this.triggerStatusChange();
        } else if (syncedCount > 0) {
          this.syncStatus = 'online';
          this.statusMessage = `🟢 Online (Sincronizados ${syncedCount} exámenes en la nube)`;
          this.triggerStatusChange();
        }

        return { count: toSyncMap.size, synced: syncedCount, failed: failed.length, lastError };
      } catch (e) {
        console.error('Error en flushPendingQueue:', e);
        return { error: e.message };
      }
    }

    async syncAllLocalToCloud() {
      return await this.flushPendingQueue();
    }

    async pushSubmission(submission) {
      const docId = `${submission.studentId}_${submission.preceptorUid}`;
      submission.id = docId;

      // 1. Asegurar copia de seguridad local permanente en el navegador
      this.saveToLocalStorage(submission);

      if (!this.db) {
        this.addToPendingSyncQueue(submission);
        return { docId, localOnly: true, error: 'Firestore no conectado' };
      }

      try {
        await this.db.collection('exam_submissions').doc(docId).set(submission, { merge: true });
        this.removeFromPendingSyncQueue(docId);
        // Sincronizar automáticamente en segundo plano cualquier otro examen pendiente
        setTimeout(() => this.flushPendingQueue(), 100);
        return { docId, localOnly: false, success: true };
      } catch (err) {
        console.error('Error escribiendo en Firestore:', err);
        this.addToPendingSyncQueue(submission);
        return { docId, localOnly: true, error: err.message };
      }
    }

    async pushResolution(studentId, resolutionData) {
      if (!this.db) throw new Error('Base de datos Firestore no conectada.');
      try {
        await this.db.collection('exam_resolutions').doc(studentId).set(resolutionData, { merge: true });
      } catch (err) {
        console.warn('Error guardando resolución:', err);
      }
    }

    async pushAttendance(studentId, asistio) {
      if (!this.db) return;
      try {
        await this.db.collection('students_attendance').doc(studentId).set({
          studentId,
          asistio,
          updatedBy: this.currentProfile ? this.currentProfile.name : 'Usuario',
          updatedByUid: this.currentUser ? this.currentUser.uid : '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('Error guardando asistencia en Firestore:', err);
      }
    }

    triggerStatusChange() {
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('firebase-status-change', {
          detail: { status: this.syncStatus, message: this.statusMessage }
        }));
      }
    }

    triggerAuthChange(profile) {
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('firebase-auth-change', {
          detail: { profile }
        }));
      }
    }
  }

  window.FirebaseSyncService = new FirebaseSyncService();
})();
