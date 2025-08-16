// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration
const IBM_Q_API_KEY = '23cgzFAOma_DyrNUCq8JV1_Ane_9_UZ5scA82OT7LtFK';
const IBM_Q_API_BASE_URL = 'https://api.quantum-computing.ibm.com/api/v2/jobs';
const POLLING_INTERVAL = 60000; // 1 minute

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// In-memory cache
let jobCache = [];
let lastUpdated = null;

// Helper function to fetch jobs from IBM Quantum API
async function fetchJobsFromIBM() {
    try {
        const response = await axios.get(IBM_Q_API_BASE_URL, {
            headers: {
                'Authorization': `Bearer ${IBM_Q_API_KEY}`,
                'Accept': 'application/json'
            },
            params: {
                'limit': 50,
                'order': 'DESC',
                'sort': 'creationDate'
            }
        });

        return response.data.map(job => ({
            id: job.id,
            status: job.status,
            backend: job.backend ? job.backend.name : 'Unknown',
            submit_time: job.creationDate,
            completion_time: job.completionDate,
            user: job.userHandle,
            queued_time: job.queueInfo ? job.queueInfo.estimatedStartTime : null,
            running_time: job.runningTime
        }));

    } catch (error) {
        console.error('Error fetching from IBM Quantum API:', error.message);
        throw error;
    }
}

// Cache update function
async function updateCache() {
    try {
        const jobs = await fetchJobsFromIBM();
        jobCache = jobs;
        lastUpdated = new Date();
        console.log(`Cache updated at ${lastUpdated}`);
        return true;
    } catch (error) {
        console.error('Cache update failed:', error.message);
        return false;
    }
}

// Initialize cache and start polling
updateCache().then(() => {
    setInterval(updateCache, POLLING_INTERVAL);
});

// Routes
app.get('/api/jobs', async (req, res) => {
    try {
        // Get status filter if provided
        const statusFilter = req.query.status ? req.query.status.toUpperCase() : null;

        // Filter jobs if status parameter is provided
        const filteredJobs = statusFilter 
            ? jobCache.filter(job => job.status === statusFilter)
            : jobCache;

        res.json({
            success: true,
            lastUpdated,
            jobs: filteredJobs,
            stats: {
                total: jobCache.length,
                queued: jobCache.filter(job => job.status === 'QUEUED').length,
                running: jobCache.filter(job => job.status === 'RUNNING').length,
                completed: jobCache.filter(job => job.status === 'COMPLETED').length,
                error: jobCache.filter(job => job.status === 'ERROR').length
            }
        });
    } catch (error) {
        console.error('Error processing job request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

app.get('/api/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;
        const job = jobCache.find(j => j.id === jobId);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found in cache'
            });
        }

        // Get additional details from IBM API
        const response = await axios.get(`${IBM_Q_API_BASE_URL}/${jobId}`, {
            headers: {
                'Authorization': `Bearer ${IBM_Q_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        const detailedJob = {
            ...job,
            parameters: response.data.quantumCircuit?.qasm || null,
            shots: response.data.shots,
            results: response.data.results ? response.data.results[0] : null,
            queue_position: response.data.queueInfo?.position || null,
            estimated_start_time: response.data.queueInfo?.estimatedStartTime || null
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        cacheSize: jobCache.length,
        lastUpdated
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something broke!'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`IBM Quantum Dashboard API server running on http://localhost:${PORT}`);
    console.log(`Fetching data from IBM Quantum API with key: ${IBM_Q_API_KEY.substring(0, 4)}...${IBM_Q_API_KEY.substring(IBM_Q_API_KEY.length - 4)}`);
});
