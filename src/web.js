// src/web.js
import express from "express";
import db from "./db.js"; // ✅ import the existing db instance

const app = express();

// Serve Dashboard
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>QueueCTL Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  </head>
  <body class="bg-gray-900 text-gray-100 min-h-screen font-sans" id="body">
    <div class="p-6 text-center">
      <div class="flex justify-between items-center max-w-5xl mx-auto">
        <h1 class="text-4xl font-bold mb-2 text-blue-400">QueueCTL Dashboard</h1>
        <button id="themeToggle" class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold">
          🌙 Dark Mode
        </button>
      </div>

      <p class="text-gray-400 mb-6">Monitor background jobs, DLQ, and system performance</p>

      <div class="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-10" id="cards"></div>

      <div class="max-w-3xl mx-auto bg-gray-800 rounded-xl p-4 shadow-xl" id="chartBox">
        <h2 class="text-xl font-semibold text-center mb-4 text-blue-300">Job State Distribution</h2>
        <canvas id="chart" width="400" height="200" style="max-width:500px;margin:auto;"></canvas>
      </div>

      <div id="summary" class="max-w-4xl mx-auto mt-10"></div>

      <div class="mt-8 text-gray-500">
        <a href="/jobs" class="underline hover:text-blue-400">📋 View All Jobs</a> •
        <a href="/dlq" class="underline hover:text-red-400">💀 View DLQ</a>
      </div>
    </div>

    <script>
      let darkMode = true;

      const colors = {
        light: { bg: 'bg-white text-gray-900', chartText: '#111' },
        dark:  { bg: 'bg-gray-900 text-gray-100', chartText: '#fff' }
      };

      function toggleTheme() {
        darkMode = !darkMode;
        const theme = darkMode ? colors.dark : colors.light;
        document.getElementById('body').className = theme.bg + ' min-h-screen font-sans';
        document.getElementById('themeToggle').textContent = darkMode ? '🌙 Dark Mode' : '☀️ Light Mode';
        updateChartTheme();
      }

      document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
        fetchSummary();
        setInterval(fetchSummary, 5000);
      });

      async function fetchSummary() {
        const res = await fetch('/api/summary');
        const data = await res.json();

        const total = data.reduce((acc, s) => acc + s.count, 0);
        const colorMap = { completed: 'green', pending: 'yellow', dead: 'red', failed: 'orange', processing: 'blue' };

        // Cards
        document.getElementById('cards').innerHTML = data.map(s => \`
          <div class="bg-gray-800 p-4 rounded-lg shadow-md hover:scale-105 transition transform duration-300">
            <h3 class="text-lg font-semibold text-\${colorMap[s.state] || 'gray'}-400">\${s.state.toUpperCase()}</h3>
            <p class="text-3xl font-bold mt-2">\${s.count}</p>
          </div>
        \`).join('') + \`
          <div class="bg-gray-800 p-4 rounded-lg shadow-md hover:scale-105 transition transform duration-300">
            <h3 class="text-lg font-semibold text-gray-300">TOTAL</h3>
            <p class="text-3xl font-bold mt-2">\${total}</p>
          </div>
        \`;

        // Donut Chart
        const ctx = document.getElementById('chart').getContext('2d');
        if (window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: data.map(d => d.state),
            datasets: [{
              data: data.map(d => d.count),
              backgroundColor: ['#10B981','#3B82F6','#EF4444','#F59E0B','#8B5CF6'],
              cutout: '65%'
            }]
          },
          options: {
            aspectRatio: 1.5,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: darkMode ? '#fff' : '#000' }
              }
            }
          }
        });

        // Summary Table
        document.getElementById('summary').innerHTML = \`
          <h2 class="text-2xl text-blue-400 font-semibold text-center mb-2">Job Summary</h2>
          <table class="min-w-full bg-gray-800 rounded-lg overflow-hidden">
            <thead class="bg-gray-700">
              <tr><th class="py-2 px-4 text-left">State</th><th class="py-2 px-4">Count</th></tr>
            </thead>
            <tbody>
              \${data.map(s => \`<tr class='hover:bg-gray-700 transition'><td class='py-2 px-4'>\${s.state}</td><td class='py-2 px-4 text-center'>\${s.count}</td></tr>\`).join('')}
            </tbody>
          </table>
        \`;
      }

      function updateChartTheme() {
        if (window.myChart) {
          window.myChart.options.plugins.legend.labels.color = darkMode ? '#fff' : '#000';
          window.myChart.update();
        }
      }
    </script>
  </body>
  </html>
  `);
});

// API Endpoints
app.get("/api/summary", (req, res) => {
  const summary = db.prepare("SELECT state, COUNT(*) AS count FROM jobs GROUP BY state").all();
  res.json(summary);
});

app.get("/jobs", (req, res) => {
  const rows = db.prepare("SELECT * FROM jobs ORDER BY updated_at DESC").all();
  res.send(`
  <html><body style="font-family:sans-serif;background:#111;color:white;padding:30px;">
    <h1>📋 All Jobs</h1>
    <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;background:#1e293b;">
      <tr><th>ID</th><th>Command</th><th>State</th><th>Attempts</th><th>Max Retries</th><th>Updated</th></tr>
      ${rows.map(r => `<tr><td>${r.id}</td><td>${r.command}</td><td>${r.state}</td><td>${r.attempts}</td><td>${r.max_retries}</td><td>${r.updated_at}</td></tr>`).join("")}
    </table>
    <p><a href="/" style="color:#3b82f6;">⬅ Back</a></p>
  </body></html>
  `);
});

app.get("/dlq", (req, res) => {
  const rows = db.prepare("SELECT * FROM dlq ORDER BY failed_at DESC").all();
  if (!rows.length)
    return res.send("<h1 style='text-align:center;font-family:sans-serif;color:gray;'>💀 DLQ Empty</h1><p style='text-align:center;'><a href='/'>Back</a></p>");
  res.send(`
  <html><body style="font-family:sans-serif;background:#111;color:white;padding:30px;">
    <h1>💀 Dead Letter Queue</h1>
    <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;background:#1e293b;">
      <tr><th>ID</th><th>Command</th><th>Attempts</th><th>Reason</th><th>Failed At</th></tr>
      ${rows.map(r => `<tr><td>${r.id}</td><td>${r.command}</td><td>${r.attempts}</td><td>${r.reason}</td><td>${r.failed_at}</td></tr>`).join("")}
    </table>
    <p><a href="/" style="color:#3b82f6;">⬅ Back</a></p>
  </body></html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Dashboard running at http://localhost:${PORT}`));
