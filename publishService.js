const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function log(msg) {
    const logLine = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(path.join(__dirname, 'publish_debug.log'), logLine);
}

async function publishToRedbook(data) {
    log('Starting publishToRedbook...');
    log(`Received data: ${JSON.stringify(data)}`);

    const { title, content, tags, files, imagesPath } = data;

    log(`Title: ${title}`);
    log(`Content: ${content}`);
    log(`Tags: ${JSON.stringify(tags)}`);
    log(`Files: ${JSON.stringify(files)}`);
    if (imagesPath) log(`Images Path (Custom): ${imagesPath}`);

    const imagesDir = imagesPath || path.join(__dirname, 'images');

    // Use persistent context to save login session
    const userDataDir = path.join(__dirname, '.browser-data');

    let context;
    try {
        log('Launching browser with persistent context...');
        // Launch persistent context - this saves cookies and session data
        context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        });
        log('Browser context loaded (login session will be preserved).');

        const page = context.pages()[0] || await context.newPage();
        log('Page ready.');

        log('Navigating to Xiaohongshu Creator Platform...');
        await page.goto('https://creator.xiaohongshu.com/');

        log('Waiting for login or main page... (Please login manually if this is your first time)');
        // Give user time to login if needed, or wait for page to load if already logged in
        await page.waitForTimeout(3000);

        log('Looking for "发布笔记" button to hover...');
        // Hover over "发布笔记" button to trigger dropdown menu
        const publishNoteButton = page.locator('text=发布笔记').first();
        await publishNoteButton.waitFor({ timeout: 60000 });
        await publishNoteButton.hover();
        log('Hovering over "发布笔记" button, dropdown menu should appear.');

        // Wait for dropdown menu to appear
        await page.waitForTimeout(1000);

        const isVideo = files.length > 0 && files.some(f => f.toLowerCase().endsWith('.mp4') || f.toLowerCase().endsWith('.mov'));
        const targetMenuText = isVideo ? '上传视频' : '上传图文';

        log(`Looking for "${targetMenuText}" in dropdown menu...`);
        // Click the corresponding option from the dropdown menu
        const uploadMenuButton = page.locator(`text=${targetMenuText}`).first();
        await uploadMenuButton.waitFor({ timeout: 10000 });
        await uploadMenuButton.click();
        log(`Clicked "${targetMenuText}" from dropdown menu.`);

        await page.waitForTimeout(1000);

        // Prepare file paths - ensure they're in order
        const filePaths = files.map(f => path.join(imagesDir, f));
        log(`Prepared ${filePaths.length} files for upload: ${filePaths.join(', ')}`);

        try {
            log('Attempting to use direct setInputFiles...');
            // In modern React/Vue upload components, the best way is to set files on the hidden input[type="file"] directly
            const fileInput = page.locator('input[type="file"]').first();
            await fileInput.waitFor({ state: 'attached', timeout: 5000 });
            await fileInput.setInputFiles(filePaths);
            log('Files uploaded successfully via setInputFiles.');
        } catch (e) {
            log(`Direct setInputFiles failed, falling back to UI button click...`);
            const uploadButtonText = isVideo ? '上传视频' : '上传图片';

            let uploadButton = page.locator(`text=${uploadButtonText}`).first();
            try {
                await uploadButton.waitFor({ timeout: 5000 });
            } catch (waitErr) {
                log(`Specific "${uploadButtonText}" button not found, trying general patterns...`);
                // For video, sometimes it is just "上传" or within a container
                uploadButton = isVideo ? page.locator('.upload-wrapper, .upload-container, text=点此上传, text=点击上传').first() : uploadButton;
            }

            // Handle file chooser with longer timeout
            const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 15000 }),
                uploadButton.click({ force: true })
            ]);

            await fileChooser.setFiles(filePaths);
            log('Files uploaded successfully via fileChooser.');
        }
        log('Files uploaded successfully.');

        // Wait for upload to process and page to transition
        await page.waitForTimeout(3000);

        log('Looking for title input field...');
        // Based on diagnostic: input.d-text with exact placeholder
        const titleInput = page.locator('input.d-text[placeholder="填写标题会有更多赞哦"]').first();
        await titleInput.waitFor({ timeout: 10000 });
        log('Title input field found, clicking...');

        await titleInput.click();
        log('Title input clicked, waiting for focus...');

        // Wait for input to be focused
        await page.waitForTimeout(500);

        // Try triple-click to ensure selection
        await titleInput.click({ clickCount: 3 });
        await page.waitForTimeout(200);

        log(`Typing title: "${title}"`);
        // Type the title using keyboard with delay
        await page.keyboard.type(title, { delay: 50 });
        log(`Title typed successfully.`);

        // Verify the input value
        const inputValue = await titleInput.inputValue();
        log(`Title input value after typing: "${inputValue}"`);

        await page.waitForTimeout(1000);

        log('Looking for content editor...');
        // Based on diagnostic: contenteditable div with class tiptap ProseMirror
        const contentEditor = page.locator('div.tiptap.ProseMirror[contenteditable="true"]').first();
        await contentEditor.waitFor({ timeout: 10000 });
        await contentEditor.click();
        log('Content editor clicked.');

        // Combine content and tags
        const fullContent = `${content}\n\n${tags.join(' ')}`;
        await page.keyboard.type(fullContent, { delay: 30 });
        log(`Content filled: ${fullContent.substring(0, 100)}...`);

        await page.waitForTimeout(1000);

        log('Content preparation completed.');
        log('=== Manual Publish Mode ===');
        log('Please review the content and click the PUBLISH button manually when ready.');
        log('Browser will remain open for you to complete the publishing process.');

        // Don't close the browser - let user manually publish
        // Browser will stay open until user closes it

    } catch (err) {
        console.error('Automation Error:', err);
        log(`ERROR: ${err.message}\n${err.stack}`);
        if (context) {
            // Don't close on error either - let user see what happened
            log('Error occurred. Browser will remain open for debugging.');
        }
        throw err;
    }
}

module.exports = { publishToRedbook };
