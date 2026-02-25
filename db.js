const fs = require('fs-extra');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

async function initDb() {
    if (!await fs.pathExists(dbPath)) {
        const defaultData = {
            ai_config: [],
            prompts: [
                {
                    id: 1,
                    name: '图片发布模板',
                    systemPrompt: '你是一个小红书爆款运营专家。你会根据用户提供的图片内容，生成具有吸引力的标题、正文和话题标签。',
                    userPrompt: '基于这些图片内容，请生成一段充满活力、易于阅读的小红书文案。第一张图片是封面。返回JSON格式: { "suggestedTitle": "...", "suggestedContent": "...", "tags": ["#Tag1", "#Tag2"] }',
                    type: 'image'
                },
                {
                    id: 2,
                    name: '视频发布模板',
                    systemPrompt: '你是一个小红书短视频内容策划师。你会分析视频内容，并创作出高转化的脚本和文案。',
                    userPrompt: '根据这个视频的内容，请生成一段抓人眼球的小红书文案，包括标题、正文和5个相关的热门话题标签。返回JSON格式: { "suggestedTitle": "...", "suggestedContent": "...", "tags": ["#Tag1", "#Tag2"] }',
                    type: 'video'
                }
            ],
            logs: []
        };
        await fs.writeJson(dbPath, defaultData, { spaces: 2 });
    }

    return {
        get: async (query, params) => {
            const data = await fs.readJson(dbPath);
            if (query.includes('ai_config')) {
                return data.ai_config.find(c => c.active === 1) || data.ai_config[data.ai_config.length - 1];
            }
            if (query.includes('prompts')) {
                // If it's querying by id (e.g., SELECT * FROM prompts WHERE id = ?)
                if (query.includes('WHERE id = ?')) {
                    return data.prompts.find(p => p.id === params[0]);
                }
                // Fallback to old querying by type
                return data.prompts.find(p => p.type === params[0]);
            }
            return null;
        },
        all: async (query) => {
            const data = await fs.readJson(dbPath);
            if (query.includes('prompts')) return data.prompts;
            return [];
        },
        run: async (query, params) => {
            const data = await fs.readJson(dbPath);
            if (query.includes('UPDATE ai_config SET active = 0')) {
                data.ai_config.forEach(c => c.active = 0);
            } else if (query.includes('INSERT INTO ai_config')) {
                data.ai_config.push({ apiKey: params[0], baseUrl: params[1], modelName: params[2], active: 1 });
            } else if (query.includes('UPDATE prompts SET')) {
                // UPDATE prompts SET name = ?, systemPrompt = ?, userPrompt = ?, type = ? WHERE id = ?
                const p = data.prompts.find(pr => pr.id === params[4]);
                if (p) {
                    p.name = params[0];
                    p.systemPrompt = params[1];
                    p.userPrompt = params[2];
                    p.type = params[3];
                }
            } else if (query.includes('INSERT INTO prompts')) {
                // INSERT INTO prompts (name, systemPrompt, userPrompt, type) VALUES (?, ?, ?, ?)
                const nextId = data.prompts.length > 0 ? Math.max(...data.prompts.map(p => p.id)) + 1 : 1;
                data.prompts.push({
                    id: nextId,
                    name: params[0],
                    systemPrompt: params[1],
                    userPrompt: params[2],
                    type: params[3]
                });
            } else if (query.includes('DELETE FROM prompts WHERE id = ?')) {
                data.prompts = data.prompts.filter(p => p.id !== params[0]);
            }
            await fs.writeJson(dbPath, data, { spaces: 2 });
        }
    };
}

module.exports = { initDb };
