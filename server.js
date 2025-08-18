const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5050;

app.use(cors());
app.use(express.json());

// 🧪 Mock job cache
let jobCache = [];

// 🧪 Mock IBM Quantum job fetcher
async function fetchJobsFromIBM() {
    console.log('⚠ Using mock IBM Quantum job data');
    const jobs = [
        {
            id: 'job001',
            status: 'COMPLETED',
            backend: 'ibmq_qasm_simulator',
            submit_time: '2025-08-15T10:00:00Z',
            completion_time: '2025-08-15T10:05:00Z',
            user: 'pavithra',
            queued_time: null,
            running_time: 300
        },
        {
            id: 'job002',
            status: 'RUNNING',
            backend: 'ibmq_lima',
            submit_time: '2025-08-16T13:00:00Z',
            completion_time: null,
            user: 'pavithra',
            queued_time: '2025-08-16T13:01:00Z',
            running_time: null
        },
        {
            id: 'job003',
            status: 'QUEUED',
            backend: 'ibmq_belem',
            submit_time: '2025-08-16T14:00:00Z',
            completion_time: null,
            user: 'pavithra',
            queued_time: '2025-08-16T14:01:00Z',
            running_time: null
        },
        {
            id: 'job004',
            status: 'ERROR',
            backend: 'ibmq_manila',
            submit_time: '2025-08-16T15:00:00Z',
            completion_time: null,
            user: 'pavithra',
            queued_time: null,
            running_time: null
        }
    ];

    // Manually adding 50 extra jobs
    for (let i = 5; i <= 54; i++) {
        jobs.push({
            id: `job00${i}`,
            status: i % 4 === 0 ? 'COMPLETED' : i % 4 === 1 ? 'RUNNING' : i % 4 === 2 ? 'QUEUED' : 'ERROR',
            backend: `ibmq_backend_${i}`,
            submit_time: `2025-08-16T${10 + Math.floor(i / 6)}:${i % 60}:00Z`,
            completion_time: i % 4 === 0 ? `2025-08-16T${10 + Math.floor(i / 6)}:${i % 60 + 5}:00Z` : null,
            user: 'pavithra',
            queued_time: i % 4 === 2 ? `2025-08-16T${10 + Math.floor(i / 6)}:${i % 60 - 1}:00Z` : null,
            running_time: i % 4 === 1 ? 300 : null
        });
    }

    return jobs;
}

// 🔁 Refresh job cache every 60 seconds
async function refreshCache() {
    jobCache = await fetchJobsFromIBM();
    console.log('✅ Cache updated at', new Date().toISOString());
}
setInterval(refreshCache, 60000);
refreshCache();

// 📦 GET all jobs
app.get('/api/jobs', (req, res) => {
    res.json({
        success: true,
        jobs: jobCache
    });
});

// 📦 GET job details by ID
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;
        const job = jobCache.find(j => j.id === jobId);

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const detailedJob = {
            ...job,
            parameters: 'OPENQASM 2.0; qreg q[2]; h q[0]; cx q[0],q[1];',
            shots: 1024,
            results: {
                counts: { '00': 512, '11': 512 },
                probabilities: { '00': 0.5, '11': 0.5 }
            },
            queue_position: 2,
            estimated_start_time: '2025-08-16T13:05:00Z'
        };

        res.json({
            success: true,
            job: detailedJob
        });
    } catch (error) {
        console.error('Error fetching job details:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching job details'
        });
    }
});

// 🩺 Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        cacheSize: jobCache.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send(`
        <h2>🧪 IBM Quantum Dashboard API</h2>
        <p>Use <code>/api/jobs</code> to fetch mock job data.</p>
        <p>Use <code>/api/jobs/:id</code> to get job details.</p>
        <p>Use <code>/health</code> to check server status.</p>
    `);
});

// 🚀 Start server
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
