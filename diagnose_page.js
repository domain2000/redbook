const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function diagnosePageStructure() {
    const userDataDir = path.join(__dirname, '.browser-data');

    console.log('===== 小红书页面结构诊断工具 =====\n');
    console.log('这个工具会帮助我们找到正确的选择器\n');

    try {
        console.log('启动浏览器...');
        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        });

        const page = context.pages()[0] || await context.newPage();

        console.log('导航到创作平台...');
        await page.goto('https://creator.xiaohongshu.com/');
        await page.waitForTimeout(3000);

        console.log('等待5秒，请在浏览器中完成以下操作：');
        console.log('1. 如果需要登录，请先登录');
        console.log('2. 点击"上传图文"按钮');
        console.log('3. 点击"上传图片"并上传一张测试图片');
        console.log('4. 等待上传完成\n');
        console.log('倒计时开始...');

        for (let i = 15; i > 0; i--) {
            process.stdout.write(`\r剩余 ${i} 秒...`);
            await page.waitForTimeout(1000);
        }
        console.log('\n\n开始分析页面结构...\n');

        // 诊断标题输入框
        console.log('=== 1. 查找标题输入框 ===');
        const titleInputs = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
            return inputs.map(input => ({
                tagName: input.tagName,
                type: input.type,
                placeholder: input.placeholder,
                className: input.className,
                id: input.id,
                name: input.name,
                value: input.value,
                outerHTML: input.outerHTML.substring(0, 200)
            }));
        });

        console.log(`找到 ${titleInputs.length} 个文本输入框：`);
        titleInputs.forEach((input, index) => {
            console.log(`\n输入框 #${index + 1}:`);
            console.log(`  Placeholder: ${input.placeholder}`);
            console.log(`  ClassName: ${input.className}`);
            console.log(`  ID: ${input.id}`);
            console.log(`  HTML: ${input.outerHTML}`);
        });

        // 诊断内容输入框
        console.log('\n\n=== 2. 查找内容输入框 ===');
        const contentInputs = await page.evaluate(() => {
            const textareas = Array.from(document.querySelectorAll('textarea'));
            const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));

            return {
                textareas: textareas.map(ta => ({
                    tagName: ta.tagName,
                    placeholder: ta.placeholder,
                    className: ta.className,
                    id: ta.id,
                    outerHTML: ta.outerHTML.substring(0, 200)
                })),
                editables: editables.map(ed => ({
                    tagName: ed.tagName,
                    className: ed.className,
                    id: ed.id,
                    outerHTML: ed.outerHTML.substring(0, 200)
                }))
            };
        });

        console.log(`找到 ${contentInputs.textareas.length} 个 textarea：`);
        contentInputs.textareas.forEach((ta, index) => {
            console.log(`\nTextarea #${index + 1}:`);
            console.log(`  Placeholder: ${ta.placeholder}`);
            console.log(`  ClassName: ${ta.className}`);
            console.log(`  ID: ${ta.id}`);
            console.log(`  HTML: ${ta.outerHTML}`);
        });

        console.log(`\n找到 ${contentInputs.editables.length} 个可编辑元素：`);
        contentInputs.editables.forEach((ed, index) => {
            console.log(`\n可编辑元素 #${index + 1}:`);
            console.log(`  TagName: ${ed.tagName}`);
            console.log(`  ClassName: ${ed.className}`);
            console.log(`  ID: ${ed.id}`);
            console.log(`  HTML: ${ed.outerHTML}`);
        });

        // 保存诊断结果
        const report = {
            timestamp: new Date().toISOString(),
            titleInputs,
            contentInputs
        };

        fs.writeFileSync(
            path.join(__dirname, 'page_structure_diagnosis.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('\n\n=== 诊断完成 ===');
        console.log('详细报告已保存到: page_structure_diagnosis.json');
        console.log('浏览器将保持打开状态，请手动关闭');

    } catch (err) {
        console.error('诊断失败:', err);
    }
}

diagnosePageStructure();
