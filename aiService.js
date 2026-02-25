const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('ffmpeg-static');
const { execSync } = require('child_process');
const os = require('os');

async function callAIVision(config, systemPrompt, userPrompt, files, imagesDir, extractFramesCount) {
    const mediaContents = [];

    for (const file of files) {
        const lowerFile = file.toLowerCase();
        const fullPath = path.join(imagesDir, file);

        if (lowerFile.endsWith('.mp4') || lowerFile.endsWith('.mov')) {
            // Extract frames using ffmpeg to avoid 413 Payload Too Large
            let durationSec = 5;
            try {
                execSync(`"${ffmpeg}" -i "${fullPath}"`, { stdio: 'pipe' });
            } catch (e) {
                const out = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '');
                const match = out.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
                if (match) {
                    durationSec = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
                }
            }

            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redbook-frames-'));
            const numFrames = parseInt(extractFramesCount, 10) || 8;
            let extractedCount = 0;

            for (let i = 0; i < numFrames; i++) {
                let time = (durationSec / (numFrames + 1)) * (i + 1);
                time = Math.max(0.1, time);

                const outPath = path.join(tempDir, `frame_${i}.jpg`);
                try {
                    execSync(`"${ffmpeg}" -y -ss ${time} -i "${fullPath}" -vframes 1 -q:v 4 "${outPath}"`, { stdio: 'pipe' });
                    if (fs.existsSync(outPath)) {
                        const buffer = await fs.readFile(outPath);
                        mediaContents.push({
                            type: 'image_url',
                            image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` }
                        });
                        extractedCount++;
                    }
                } catch (err) {
                    console.error('Frame extract error:', err.message);
                }
            }

            if (extractedCount > 0) {
                // Prepend context to force treating sequence as video
                mediaContents.unshift({
                    type: 'text',
                    text: `【重要前置说明】：接下来的 ${extractedCount} 张画面是按时间顺序从**同一个完整的视频文件** "${file}" 中截取出来的关键帧序列（从开头到结尾）。请你务必把它们当作**一个连贯的视频故事或整体动作**来看待和分析！**严禁**把它们当做独立的几张散图分别去点评“图1如何、图2如何”。请结合所有帧概括整个视频的主题内容进行文案创作。`
                });
            } else {
                mediaContents.push({ type: 'text', text: `[视频文件: ${file}，未能成功提取画面]` });
            }

            try { fs.removeSync(tempDir); } catch (e) { }

        } else {
            const buffer = await fs.readFile(fullPath);
            mediaContents.push({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` }
            });
        }
    }

    try {
        const response = await axios.post(config.baseUrl, {
            model: config.modelName,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user', content: [
                        { type: 'text', text: userPrompt },
                        ...mediaContents
                    ]
                }
            ],
            response_format: { type: 'json_object' }
        }, {
            headers: { 'Authorization': `Bearer ${config.apiKey}` }
        });

        const content = response.data.choices[0].message.content;
        return JSON.parse(content);
    } catch (err) {
        console.error('AI API Error:', err.response?.data || err.message);
        throw new Error('AI识别失败: ' + err.message);
    }
}

module.exports = { callAIVision };
