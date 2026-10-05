/**
 * Analytics & Pedagogical Dashboard - Examen de Ingreso 2027
 * Escuela Secundaria Técnica - UTN - San Miguel
 * Estadísticas en tiempo real, gráficos interactivos con Chart.js y matriz de diagnóstico.
 */

(function () {
  class AnalyticsEngine {
    constructor() {
      this.charts = {};
    }

    computeAllStats() {
      const consolidated = window.DataService.getConsolidatedResults();
      const students = window.DataService.getStudents();
      const questions = window.EXAM_CONFIG.questions;

      const totalStudents = students.length;
      const presentCount = students.filter(s => s.asistio).length;
      const absentCount = totalStudents - presentCount;

      // Alumnos evaluados (los que tienen nota final calculada)
      const evaluated = consolidated.filter(c => c.finalScore !== null);
      const evaluatedCount = evaluated.length;

      let sumTotal = 0;
      let sumMath = 0;
      let sumLang = 0;
      let passCount = 0;

      evaluated.forEach(e => {
        sumTotal += e.finalScore;
        sumMath += e.finalMath;
        sumLang += e.finalLang;
        if (e.finalScore >= 6.0) passCount++;
      });

      const avgTotal = evaluatedCount > 0 ? (sumTotal / evaluatedCount).toFixed(2) : '0.00';
      const avgMath = evaluatedCount > 0 ? (sumMath / evaluatedCount).toFixed(2) : '0.00';
      const avgLang = evaluatedCount > 0 ? (sumLang / evaluatedCount).toFixed(2) : '0.00';
      const passRate = evaluatedCount > 0 ? Math.round((passCount / evaluatedCount) * 100) : 0;

      // 1. Análisis pregunta por pregunta
      const questionStats = questions.map(q => {
        let correctCount = 0;
        let answeredTotal = 0;
        const optionsCount = { A: 0, B: 0, C: 0, D: 0, other: 0 };

        evaluated.forEach(e => {
          if (e.answers) {
            const ans = (e.answers[q.n] || '').toUpperCase();
            if (ans) {
              answeredTotal++;
              if (['A', 'B', 'C', 'D'].includes(ans)) {
                optionsCount[ans] = (optionsCount[ans] || 0) + 1;
              } else {
                optionsCount.other++;
              }
              const correctKey = (e.tema === 'B') ? q.temaB : q.temaA;
              if (ans === correctKey) {
                correctCount++;
              }
            }
          }
        });

        const successRate = evaluatedCount > 0 ? Math.round((correctCount / evaluatedCount) * 100) : 0;

        return {
          n: q.n,
          subject: q.subject,
          topic: q.topic,
          criterion: q.criterion,
          correctCount,
          total: evaluatedCount,
          successRate,
          optionsCount,
          difficultyLabel: successRate < 45 ? 'Difícil' : (successRate < 70 ? 'Media' : 'Accesible')
        };
      });

      // 2. Rendimiento por Aula
      const aulas = window.DataService.getAulas();
      const aulaStats = aulas.map(aula => {
        const inAula = consolidated.filter(c => c.student.aula === aula);
        const pres = inAula.filter(c => c.student.asistio).length;
        const ev = inAula.filter(c => c.finalScore !== null);
        const sum = ev.reduce((acc, curr) => acc + curr.finalScore, 0);
        const sumM = ev.reduce((acc, curr) => acc + curr.finalMath, 0);
        const sumL = ev.reduce((acc, curr) => acc + curr.finalLang, 0);
        const pass = ev.filter(c => c.finalScore >= 6.0).length;

        return {
          aula,
          total: inAula.length,
          presentes: pres,
          evaluados: ev.length,
          avgTotal: ev.length > 0 ? (sum / ev.length).toFixed(2) : '0.00',
          avgMath: ev.length > 0 ? (sumM / ev.length).toFixed(2) : '0.00',
          avgLang: ev.length > 0 ? (sumL / ev.length).toFixed(2) : '0.00',
          passRate: ev.length > 0 ? Math.round((pass / ev.length) * 100) : 0
        };
      });

      // 3. Rendimiento por Escuela de Procedencia
      const schoolMap = {};
      consolidated.forEach(c => {
        const esc = (c.student.escuela_origen || 'No especificada').trim();
        if (!schoolMap[esc]) {
          schoolMap[esc] = { name: esc, total: 0, evaluated: 0, sumScore: 0, passed: 0 };
        }
        schoolMap[esc].total++;
        if (c.finalScore !== null) {
          schoolMap[esc].evaluated++;
          schoolMap[esc].sumScore += c.finalScore;
          if (c.finalScore >= 6.0) schoolMap[esc].passed++;
        }
      });

      const schoolStats = Object.values(schoolMap).map(sc => ({
        ...sc,
        avgScore: sc.evaluated > 0 ? +(sc.sumScore / sc.evaluated).toFixed(2) : null,
        passRate: sc.evaluated > 0 ? Math.round((sc.passed / sc.evaluated) * 100) : 0
      })).sort((a, b) => {
        if (b.evaluated !== a.evaluated) return b.evaluated - a.evaluated; // primero los que tienen más alumnos
        return (b.avgScore || 0) - (a.avgScore || 0);
      });

      // 4. Distribución de notas (Histograma)
      const distribution = {
        '0 - 3.5 (Insuficiente)': 0,
        '4 - 5.5 (Regular)': 0,
        '6 - 6.5 (Aprobado Básico)': 0,
        '7 - 8.5 (Bueno / Muy Bueno)': 0,
        '9 - 10 (Sobresaliente)': 0
      };

      evaluated.forEach(e => {
        const s = e.finalScore;
        if (s < 4.0) distribution['0 - 3.5 (Insuficiente)']++;
        else if (s < 6.0) distribution['4 - 5.5 (Regular)']++;
        else if (s < 7.0) distribution['6 - 6.5 (Aprobado Básico)']++;
        else if (s < 9.0) distribution['7 - 8.5 (Bueno / Muy Bueno)']++;
        else distribution['9 - 10 (Sobresaliente)']++;
      });

      return {
        totalStudents,
        presentCount,
        absentCount,
        evaluatedCount,
        passCount,
        failCount: evaluatedCount - passCount,
        passRate,
        avgTotal,
        avgMath,
        avgLang,
        questionStats,
        aulaStats,
        schoolStats,
        distribution
      };
    }

    renderCharts() {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está disponible aún.');
        return;
      }

      const stats = this.computeAllStats();

      // Destruir gráficos anteriores si existían
      Object.keys(this.charts).forEach(k => {
        if (this.charts[k]) this.charts[k].destroy();
      });

      // 1. Gráfico Histograma de Distribución
      const distCanvas = document.getElementById('chartDistribution');
      if (distCanvas) {
        const ctx = distCanvas.getContext('2d');
        const labels = Object.keys(stats.distribution);
        const dataVals = Object.values(stats.distribution);

        this.charts.distribution = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Cantidad de Estudiantes',
              data: dataVals,
              backgroundColor: [
                'rgba(239, 68, 68, 0.75)',
                'rgba(245, 158, 11, 0.75)',
                'rgba(59, 130, 246, 0.75)',
                'rgba(16, 185, 129, 0.75)',
                'rgba(139, 92, 246, 0.75)'
              ],
              borderColor: [
                '#ef4444',
                '#f59e0b',
                '#3b82f6',
                '#10b981',
                '#8b5cf6'
              ],
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } }
            }
          }
        });
      }

      // 2. Gráfico Matemática vs Prácticas del Lenguaje
      const subCanvas = document.getElementById('chartSubjects');
      if (subCanvas) {
        const ctx = subCanvas.getContext('2d');
        this.charts.subjects = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Matemática (Máx 5 pts)', 'Lengua (Máx 5 pts)', 'Total Examen (Máx 10 pts)'],
            datasets: [{
              label: 'Promedio General',
              data: [stats.avgMath, stats.avgLang, stats.avgTotal],
              backgroundColor: ['rgba(6, 182, 212, 0.75)', 'rgba(168, 85, 247, 0.75)', 'rgba(16, 185, 129, 0.75)'],
              borderColor: ['#06b6d4', '#a855f7', '#10b981'],
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 10 } }
          }
        });
      }

      // 3. Gráfico de Rendimiento por Pregunta (% de Acierto)
      const qCanvas = document.getElementById('chartQuestions');
      if (qCanvas) {
        const ctx = qCanvas.getContext('2d');
        const qLabels = stats.questionStats.map(q => `P${q.n}: ${q.topic.substring(0, 16)}...`);
        const qData = stats.questionStats.map(q => q.successRate);
        const qColors = stats.questionStats.map(q => q.n <= 10 ? 'rgba(59, 130, 246, 0.75)' : 'rgba(236, 72, 153, 0.75)');

        this.charts.questions = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: qLabels,
            datasets: [{
              label: '% de Acierto',
              data: qData,
              backgroundColor: qColors,
              borderRadius: 4
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const qObj = stats.questionStats[ctx.dataIndex];
                    return ` Acierto: ${qObj.successRate}% (${qObj.correctCount}/${qObj.total}) - ${qObj.criterion}`;
                  }
                }
              }
            }
          }
        });
      }

      // 4. Gráfico de Promedio por Aula
      const aulaCanvas = document.getElementById('chartAulas');
      if (aulaCanvas) {
        const ctx = aulaCanvas.getContext('2d');
        const labels = stats.aulaStats.map(a => `Aula ${a.aula}`);
        const dataAvg = stats.aulaStats.map(a => a.avgTotal);

        this.charts.aulas = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Promedio de Calificación',
              data: dataAvg,
              backgroundColor: 'rgba(99, 102, 241, 0.75)',
              borderColor: '#6366f1',
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 10 } }
          }
        });
      }
    }
  }

  window.AnalyticsEngine = new AnalyticsEngine();
})();
