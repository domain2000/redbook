const path = require('path');
// 强制将无头浏览器的运行内核隔离至本项目解压包内，避免对用户电脑全局变量依赖
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, 'pw-browsers');

const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { callAIVision } = require('./aiService');
const { publishToRedbook } = require('./publishService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

let db;

// Initialize database
(async () => {
    db = await initDb();
    console.log('Database initialized.');
})();

// Get AI Config
app.get('/api/config', async (req, res) => {
    try {
        const config = await db.get('SELECT * FROM ai_config WHERE active = 1 LIMIT 1');
        res.json(config || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save AI Config
app.post('/api/config', async (req, res) => {
    try {
        const { apiKey, baseUrl, modelName } = req.body;
        await db.run('UPDATE ai_config SET active = 0');
        await db.run('INSERT INTO ai_config (apiKey, baseUrl, modelName, active) VALUES (?, ?, ?, 1)', [apiKey, baseUrl, modelName]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test AI Connection
app.post('/api/test-connection', async (req, res) => {
    try {
        const { apiKey, baseUrl, modelName } = req.body;

        if (!apiKey || !baseUrl || !modelName) {
            return res.status(400).json({ error: '请填写完整的配置信息' });
        }

        let finalBaseUrl = baseUrl;
        if (finalBaseUrl.endsWith('/')) finalBaseUrl = finalBaseUrl.slice(0, -1);
        if (!finalBaseUrl.endsWith('/chat/completions')) {
            finalBaseUrl += '/chat/completions';
        }

        const testConfig = { apiKey, baseUrl: finalBaseUrl, modelName };
        const testPrompt = '请直接返回一个 JSON 对象，必须包含 "suggestedTitle" 字段，其值为 "连接成功"。不要返回任何其他文字。';

        console.log('Testing connection with config:', { ...testConfig, apiKey: '***' });
        const result = await callAIVision(testConfig, '你是一个测试助手，请回复 JSON 格式。', testPrompt, []);
        console.log('AI Test connection response content:', result);

        if (result && typeof result === 'object') {
            res.json({ success: true, message: '连接成功！AI 响应正常' });
        } else {
            console.warn('AI response is not a valid object:', result);
            res.status(500).json({ error: 'AI 响应格式异常' });
        }
    } catch (err) {
        res.status(500).json({ error: `连接失败: ${err.message}` });
    }
});

// Get Prompts
app.get('/api/prompts', async (req, res) => {
    try {
        const prompts = await db.all('SELECT * FROM prompts');
        res.json(prompts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Prompt
app.post('/api/prompts', async (req, res) => {
    try {
        const { id, systemPrompt, userPrompt } = req.body;
        await db.run('UPDATE prompts SET systemPrompt = ?, userPrompt = ? WHERE id = ?', [systemPrompt, userPrompt, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Select Local Folder (Windows/MacOS)
app.get('/api/select-folder', async (req, res) => {
    try {
        const dialog = require('node-file-dialog');
        const config = { type: 'directory' };

        const selected = await dialog(config);

        if (selected && selected.length > 0) {
            res.json({ path: selected[0] });
        } else {
            res.status(500).json({ error: '未选择路径' });
        }
    } catch (err) {
        if (err && err.message && err.message.includes('Nothing selected')) {
            // User canceled the dialog
            return res.status(200).json({ path: '' }); // Return empty path or handled status
        }
        console.error('Failed to open folder dialog:', err);
        res.status(500).json({ error: '已取消选择或无法打开' });
    }
});


// Process Images
app.post('/api/process', async (req, res) => {
    try {
        const fs = require('fs-extra');
        const imagesDir = req.body.imagesPath || path.join(__dirname, 'images');
        const extractFramesCount = req.body.extractFramesCount;

        if (!fs.existsSync(imagesDir)) {
            return res.status(400).json({ error: `文件夹不存在: ${imagesDir}` });
        }

        const mediaFiles = fs.readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png|gif|mp4|mov)$/i.test(f));

        if (mediaFiles.length === 0) {
            return res.status(400).json({ error: `文件夹中没有找到图片或视频: ${imagesDir}` });
        }

        const firstFileLower = mediaFiles[0].toLowerCase();
        const isVideo = firstFileLower.endsWith('.mp4') || firstFileLower.endsWith('.mov');
        const config = await db.get('SELECT * FROM ai_config WHERE active = 1 LIMIT 1');
        const prompt = await db.get('SELECT * FROM prompts WHERE type = ? LIMIT 1', [isVideo ? 'video' : 'image']);

        if (!config || !config.apiKey) {
            return res.status(400).json({ error: '请先配置 AI API 信息' });
        }

        // Handle Base URL robustly
        let finalBaseUrl = config.baseUrl;
        if (finalBaseUrl.endsWith('/')) finalBaseUrl = finalBaseUrl.slice(0, -1);
        if (!finalBaseUrl.endsWith('/chat/completions')) {
            finalBaseUrl += '/chat/completions';
        }

        const result = await callAIVision({ ...config, baseUrl: finalBaseUrl }, prompt.systemPrompt, prompt.userPrompt, mediaFiles, imagesDir, extractFramesCount);

        res.json({
            ...result,
            files: mediaFiles
        });
    } catch (err) {
        console.error('AI API Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Publish to Xiaohongshu
app.post('/api/publish', async (req, res) => {
    try {
        const { suggestedTitle, suggestedContent, tags, files, imagesPath } = req.body;

        console.log('Received publish request:', { suggestedTitle, suggestedContent, tags, files, imagesPath });

        // Map frontend field names to backend expected names
        const publishData = {
            title: suggestedTitle,
            content: suggestedContent,
            tags: tags || [],
            files: files || [],
            imagesPath: imagesPath || ''
        };

        console.log('Mapped publish data:', publishData);

        // Run in background to not block response
        publishToRedbook(publishData).catch(console.error);
        res.json({ success: true, message: '发布流程已在后台启动，请观察浏览器操作' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
    console.log('Server ready.');
});
