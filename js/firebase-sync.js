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
      this.cloudDocIds = new Set();
      this.cloudDocMap = new Map();
      this.latestCloudSubmissions = [];
      this.hasReceivedInitialCloudSubmissions = false;
      this._isSyncing = false;
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

    withTimeout(promise, ms = 7000) {
      return Promise.race([
        promise,
        new Promise((_, reject) => {
          const timer = setTimeout(() => {
            const err = new Error(`Tiempo de espera agotado con Firestore (${ms / 1000}s)`);
            err.code = 'timeout';
            reject(err);
          }, ms);
          if (promise && typeof promise.finally === 'function') {
            promise.finally(() => clearTimeout(timer));
          }
        })
      ]);
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
        } else if (err && (err.code === 'resource-exhausted' || (err.message && (err.message.includes('Quota exceeded') || err.message.includes('resource-exhausted'))))) {
          this.syncStatus = 'quota-exceeded';
          this.statusMessage = '⚠️ Cuota diaria de Firebase agotada (Spark Plan). Es necesario Plan Blaze.';
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
          this.cloudDocIds = new Set();
          this.cloudDocMap = new Map();
          snapshot.forEach(doc => {
            const data = doc.data();
            cloudSubs.push(data);
            this.cloudDocIds.add(doc.id);
            this.cloudDocMap.set(doc.id, data);
          });
          this.latestCloudSubmissions = cloudSubs;
          this.hasReceivedInitialCloudSubmissions = true;
          window.DataService.setSubmissionsFromCloud(cloudSubs);

          // Auto-sincronizar cualquier examen de esta PC que falte en Firestore
          this.autoSyncMissingLocalExams();
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

      // 4. Escuchar anulaciones y eliminaciones de exámenes para propagar entre PCs
      try {
        this.unsubscribeDeleted = this.db.collection('deleted_submissions')
          .onSnapshot(snapshot => {
            snapshot.forEach(doc => {
              this.purgeDeletedLocally(doc.id);
            });
          }, err => {
            console.warn('Colección deleted_submissions:', err.message);
          });
      } catch (delErr) {
        console.warn('No se pudo inicializar listener de deleted_submissions:', delErr);
      }

      // 5. Intentar sincronizar en segundo plano periódicamente si hay exámenes locales pendientes
      this.autoSyncMissingLocalExams();
      if (!this.syncInterval) {
        this.syncInterval = setInterval(() => {
          if (this.syncStatus !== 'quota-exceeded') {
            this.autoSyncMissingLocalExams();
          }
        }, 45000);
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

        // Si fue guardado nuevamente, remover de la lista negra de anulados
        let deletedList = JSON.parse(localStorage.getItem('deleted_exam_submissions') || '[]');
        const docId = submission.id || `${submission.studentId}_${submission.preceptorUid}`;
        if (deletedList.includes(docId)) {
          deletedList = deletedList.filter(id => id !== docId);
          localStorage.setItem('deleted_exam_submissions', JSON.stringify(deletedList));
        }
      } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
      }
    }

    purgeDeletedLocally(docId) {
      try {
        let deletedList = JSON.parse(localStorage.getItem('deleted_exam_submissions') || '[]');
        if (!deletedList.includes(docId)) {
          deletedList.push(docId);
          localStorage.setItem('deleted_exam_submissions', JSON.stringify(deletedList));
        }

        let localList = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
        const updatedLocal = localList.filter(s => {
          const id = s.id || `${s.studentId}_${s.preceptorUid}`;
          return id !== docId;
        });
        localStorage.setItem('saved_exam_submissions', JSON.stringify(updatedLocal));

        let queue = JSON.parse(localStorage.getItem('pending_cloud_sync_queue') || '[]');
        const updatedQueue = queue.filter(s => {
          const id = s.id || `${s.studentId}_${s.preceptorUid}`;
          return id !== docId;
        });
        localStorage.setItem('pending_cloud_sync_queue', JSON.stringify(updatedQueue));

        if (this.cloudDocIds) this.cloudDocIds.delete(docId);
        if (this.cloudDocMap) this.cloudDocMap.delete(docId);
      } catch (e) {
        console.warn('Error en purgeDeletedLocally:', e);
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

    autoSyncMissingLocalExams() {
      if (this._isSyncing || !this.db || !this.hasReceivedInitialCloudSubmissions) return;
      try {
        const unsyncedCount = this.getUnsyncedLocalCount();
        const queue = JSON.parse(localStorage.getItem('pending_cloud_sync_queue') || '[]');
        if (unsyncedCount > 0 || queue.length > 0) {
          console.log(`[FirebaseSync] Sincronizando en segundo plano ${unsyncedCount} exámenes locales pendientes...`);
          this.syncAllLocalToCloud().then(res => {
            if (res.synced > 0 && window.app && window.app.showToast) {
              window.app.showToast(`✅ Se sincronizaron automáticamente ${res.synced} examen(es) pendientes a Firebase Firestore en la nube.`, 'success');
            }
          }).catch(err => {
            console.warn('[FirebaseSync] Error en auto-sync de fondo:', err);
          });
        }
      } catch (e) {
        console.warn('Error en autoSyncMissingLocalExams:', e);
      }
    }

    hasCloudSubmission(studentId, preceptorUid) {
      const docId = `${studentId}_${preceptorUid}`;
      return this.cloudDocIds ? this.cloudDocIds.has(docId) : false;
    }

    getUnsyncedLocalCount(preceptorUid = null) {
      try {
        const localSaved = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
        if (!this.cloudDocIds) return 0;
        return localSaved.filter(item => {
          if (!item) return false;
          if (preceptorUid && item.preceptorUid !== preceptorUid) return false;
          const id = item.id || `${item.studentId}_${item.preceptorUid}`;
          return !this.cloudDocIds.has(id);
        }).length;
      } catch (e) {
        return 0;
      }
    }

    async flushPendingQueue() {
      return await this.syncAllLocalToCloud();
    }

    async syncAllLocalToCloud(options = {}) {
      if (!this.db) {
        return { count: 0, synced: 0, failed: 0, error: 'Firestore no conectado' };
      }
      if (this._isSyncing) {
        return { count: 0, synced: 0, failed: 0, inProgress: true };
      }
      this._isSyncing = true;
      try {
        // 1. Obtener los IDs que REALMENTE existen en Firestore en la nube
        let cloudDocIds = this.cloudDocIds;
        let cloudDocMap = this.cloudDocMap;

        // Si aún no recibimos snapshot o se fuerza consulta directa al servidor:
        if (!this.hasReceivedInitialCloudSubmissions || !cloudDocIds || cloudDocIds.size === 0 || options.forceCheckServer) {
          try {
            const snap = await this.withTimeout(this.db.collection('exam_submissions').get(), 10000);
            cloudDocIds = new Set();
            cloudDocMap = new Map();
            snap.forEach(doc => {
              cloudDocIds.add(doc.id);
              cloudDocMap.set(doc.id, doc.data());
            });
            this.cloudDocIds = cloudDocIds;
            this.cloudDocMap = cloudDocMap;
            this.hasReceivedInitialCloudSubmissions = true;
          } catch (e) {
            console.warn('No se pudo consultar exam_submissions directamente desde Firestore:', e);
            if (!cloudDocIds) cloudDocIds = new Set();
            if (!cloudDocMap) cloudDocMap = new Map();
          }
        }

        // 2. Leer las copias locales de este navegador
        const localSaved = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
        const pendingQueue = JSON.parse(localStorage.getItem('pending_cloud_sync_queue') || '[]');

        const toSyncMap = new Map();

        // A. Agregar elementos pendientes en cola
        const deletedDocIds = JSON.parse(localStorage.getItem('deleted_exam_submissions') || '[]');
        pendingQueue.forEach(item => {
          if (item) {
            const id = item.id || `${item.studentId}_${item.preceptorUid}`;
            if (deletedDocIds.includes(id)) return; // Nunca resucitar examen anulado
            toSyncMap.set(id, { ...item, id });
          }
        });

        // B. Comparar lo guardado en este navegador contra lo que Firestore REALMENTE tiene en la nube
        localSaved.forEach(item => {
          if (item) {
            const id = item.id || `${item.studentId}_${item.preceptorUid}`;
            if (deletedDocIds.includes(id)) return; // Nunca resucitar examen anulado
            const existsInCloud = cloudDocIds.has(id);
            if (!existsInCloud) {
              toSyncMap.set(id, { ...item, id });
            } else {
              const cloudDoc = cloudDocMap.get(id);
              if (cloudDoc) {
                const localTs = item.timestamp ? new Date(item.timestamp).getTime() : 0;
                const cloudTs = cloudDoc.timestamp ? new Date(cloudDoc.timestamp).getTime() : 0;
                if (localTs > cloudTs) {
                  toSyncMap.set(id, { ...item, id });
                }
              }
            }
          }
        });

        if (toSyncMap.size === 0) {
          localStorage.setItem('pending_cloud_sync_queue', '[]');
          return { count: 0, synced: 0, failed: 0, allUpToDate: true };
        }

        // 3. Subir a Firestore por lotes (WriteBatch)
        const itemsToSync = Array.from(toSyncMap.values());
        const CHUNK_SIZE = 100;
        let syncedCount = 0;
        const failedItems = [];
        let lastError = null;
        let quotaExceeded = false;

        for (let i = 0; i < itemsToSync.length; i += CHUNK_SIZE) {
          const chunk = itemsToSync.slice(i, i + CHUNK_SIZE);
          const batch = this.db.batch();

          chunk.forEach(item => {
            const docRef = this.db.collection('exam_submissions').doc(item.id);
            batch.set(docRef, item, { merge: true });

            if (item.studentId) {
              const attendRef = this.db.collection('students_attendance').doc(item.studentId);
              batch.set(attendRef, {
                studentId: item.studentId,
                asistio: !item.isAbsent,
                updatedBy: item.preceptorName || 'Preceptor',
                updatedByUid: item.preceptorUid || '',
                updatedAt: item.timestamp || new Date().toISOString()
              }, { merge: true });
            }
          });

          try {
            await this.withTimeout(batch.commit(), 15000);
            syncedCount += chunk.length;
            chunk.forEach(item => {
              cloudDocIds.add(item.id);
              cloudDocMap.set(item.id, item);
            });
          } catch (batchErr) {
            console.warn('Error en batch commit de Firestore, reintentando individualmente:', batchErr);
            lastError = batchErr;
            if (batchErr.code === 'resource-exhausted' || (batchErr.message && batchErr.message.includes('Quota exceeded'))) {
              quotaExceeded = true;
              failedItems.push(...chunk);
              this.syncStatus = 'quota-exceeded';
              this.statusMessage = '⚠️ Cuota diaria de Firebase agotada (Spark Plan)';
              this.triggerStatusChange();
              break;
            }

            // Fallback a escritura individual para el chunk si falló el lote
            for (const item of chunk) {
              try {
                await this.withTimeout(this.db.collection('exam_submissions').doc(item.id).set(item, { merge: true }), 5000);
                syncedCount++;
                cloudDocIds.add(item.id);
                cloudDocMap.set(item.id, item);
              } catch (singleErr) {
                failedItems.push(item);
                lastError = singleErr;
              }
            }
          }
        }

        // Actualizar cola de pendientes solo con los que realmente fallaron
        localStorage.setItem('pending_cloud_sync_queue', JSON.stringify(failedItems));

        if (syncedCount > 0) {
          this.syncStatus = 'online';
          this.statusMessage = `🟢 Online (${syncedCount} exámenes sincronizados en la nube)`;
          this.triggerStatusChange();
        }

        return {
          count: toSyncMap.size,
          synced: syncedCount,
          failed: failedItems.length,
          lastError,
          quotaExceeded
        };
      } catch (err) {
        console.error('Error en syncAllLocalToCloud:', err);
        return { error: err.message };
      } finally {
        this._isSyncing = false;
      }
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
        await this.withTimeout(this.db.collection('exam_submissions').doc(docId).set(submission, { merge: true }), 7000);
        this.removeFromPendingSyncQueue(docId);
        if (this.cloudDocIds) this.cloudDocIds.add(docId);
        if (this.cloudDocMap) this.cloudDocMap.set(docId, submission);
        return { docId, localOnly: false, success: true };
      } catch (err) {
        console.error('Error escribiendo en Firestore:', err);
        this.addToPendingSyncQueue(submission);
        const quotaExceeded = err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota exceeded'));
        if (quotaExceeded) {
          this.syncStatus = 'quota-exceeded';
          this.statusMessage = '⚠️ Cuota diaria de Firebase agotada (Spark Plan)';
          this.triggerStatusChange();
        }
        return { docId, localOnly: true, error: err.message, quotaExceeded };
      }
    }

    async deleteSubmission(studentId, preceptorUid) {
      const docId = `${studentId}_${preceptorUid}`;
      this.purgeDeletedLocally(docId);

      if (!this.db) {
        return { success: true, localOnly: true };
      }

      try {
        await this.withTimeout(this.db.collection('exam_submissions').doc(docId).delete(), 7000);

        try {
          await this.withTimeout(this.db.collection('deleted_submissions').doc(docId).set({
            docId,
            studentId,
            preceptorUid,
            deletedAt: new Date().toISOString(),
            deletedBy: this.currentProfile ? this.currentProfile.name : 'Dirección'
          }), 4000);
        } catch (delErr) {
          console.warn('Colección deleted_submissions no disponible:', delErr.message);
        }

        return { success: true };
      } catch (err) {
        console.error('Error eliminando examen en Firestore:', err);
        return { success: false, error: err.message };
      }
    }

    async resetStudentExam(studentId) {
      const subs = window.DataService.getSubmissionsForStudent(studentId);
      for (const s of subs) {
        await this.deleteSubmission(studentId, s.preceptorUid);
      }

      if (this.db) {
        try {
          await this.withTimeout(this.db.collection('exam_resolutions').doc(studentId).delete(), 7000);
        } catch (e) {
          console.warn('Error borrando resolución:', e);
        }
      }

      return { success: true };
    }

    exportLocalBackup() {
      try {
        const localList = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
        const queue = JSON.parse(localStorage.getItem('pending_cloud_sync_queue') || '[]');
        const userName = this.currentProfile ? this.currentProfile.name.toLowerCase() : 'preceptor';
        const data = {
          version: '2027.1',
          exportedAt: new Date().toISOString(),
          userName: this.currentProfile ? this.currentProfile.name : 'Usuario',
          userUid: this.currentUser ? this.currentUser.uid : '',
          submissionsCount: localList.length,
          savedSubmissions: localList,
          pendingQueue: queue
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `respaldo_evaluaciones_${userName}_${localList.length}_examenes.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.app && window.app.showToast) {
          window.app.showToast(`💾 Descargado respaldo local con ${localList.length} exámenes.`, 'success');
        }
        return { success: true, count: localList.length };
      } catch (e) {
        console.error('Error al exportar respaldo local:', e);
        if (window.app && window.app.showToast) {
          window.app.showToast(`Error al exportar respaldo: ${e.message}`, 'danger');
        }
        return { success: false, error: e.message };
      }
    }

    async importLocalBackup(fileContent) {
      try {
        const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
        const incoming = parsed.savedSubmissions || (Array.isArray(parsed) ? parsed : []);
        if (!Array.isArray(incoming) || incoming.length === 0) {
          throw new Error('El archivo no contiene exámenes válidos.');
        }

        const localList = JSON.parse(localStorage.getItem('saved_exam_submissions') || '[]');
        const map = new Map();
        localList.forEach(s => {
          if (s) {
            const id = s.id || `${s.studentId}_${s.preceptorUid}`;
            map.set(id, s);
          }
        });
        incoming.forEach(s => {
          if (s) {
            const id = s.id || `${s.studentId}_${s.preceptorUid}`;
            map.set(id, { ...s, id });
          }
        });

        const merged = Array.from(map.values());
        localStorage.setItem('saved_exam_submissions', JSON.stringify(merged));

        // Refrescar memoria local en DataService
        if (window.DataService) {
          window.DataService.submissions = merged;
          window.DataService.notify();
        }

        // Subir inmediatamente a Firestore
        const syncResult = await this.syncAllLocalToCloud({ forceCheckServer: true });
        if (window.app && window.app.showToast) {
          window.app.showToast(`✅ Se importaron ${incoming.length} exámenes y se subieron a Firebase.`, 'success');
        }
        return { success: true, count: merged.length, syncResult };
      } catch (e) {
        console.error('Error al importar respaldo local:', e);
        if (window.app && window.app.showToast) {
          window.app.showToast(`Error al importar respaldo: ${e.message}`, 'danger');
        }
        return { success: false, error: e.message };
      }
    }

    async pushResolution(studentId, resolutionData) {
      if (!this.db) throw new Error('Base de datos Firestore no conectada.');
      try {
        await this.withTimeout(this.db.collection('exam_resolutions').doc(studentId).set(resolutionData, { merge: true }), 7000);
      } catch (err) {
        console.warn('Error guardando resolución:', err);
      }
    }

    async pushAttendance(studentId, asistio) {
      if (!this.db) return;
      try {
        await this.withTimeout(this.db.collection('students_attendance').doc(studentId).set({
          studentId,
          asistio,
          updatedBy: this.currentProfile ? this.currentProfile.name : 'Usuario',
          updatedByUid: this.currentUser ? this.currentUser.uid : '',
          updatedAt: new Date().toISOString()
        }, { merge: true }), 5000);
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
