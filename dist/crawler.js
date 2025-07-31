"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Crawler = void 0;
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * 网络爬虫类
 */
class Crawler {
    /**
     * 构造函数
     * @param config 爬虫配置
     * @param configPath 配置文件路径
     */
    constructor(config, configPath) {
        this.browser = null;
        this.context = null;
        this.results = [];
        this.status = {
            urlsCrawled: 0,
            itemsSaved: 0,
            startTime: 0,
            runningTime: 0,
            state: 'idle',
        };
        this.config = config;
        this.configPath = configPath;
    }
    /**
     * 初始化浏览器
     */
    async initialize() {
        try {
            // 根据配置选择浏览器类型，默认使用chromium
            const browserType = this.config.behavior?.browserType || 'chromium';
            const launchOptions = {
                headless: this.config.behavior?.headless !== false, // 默认为true，除非明确设置为false
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                ],
                ...(this.config.behavior?.proxy
                    ? { proxy: { server: this.config.behavior.proxy } }
                    : {}),
            };
            switch (browserType) {
                case 'firefox':
                    this.browser = await playwright_1.firefox.launch(launchOptions);
                    break;
                case 'webkit':
                    this.browser = await playwright_1.webkit.launch(launchOptions);
                    break;
                default:
                    this.browser = await playwright_1.chromium.launch(launchOptions);
            }
            // 创建浏览器上下文
            this.context = await this.browser.newContext({
                userAgent: this.config.behavior?.userAgent,
                viewport: { width: 1280, height: 720 },
                ignoreHTTPSErrors: true,
                javaScriptEnabled: this.config.behavior?.javascript !== false,
            });
            // 设置超时
            if (this.config.behavior?.timeout) {
                this.context.setDefaultTimeout(this.config.behavior.timeout);
                this.context.setDefaultNavigationTimeout(this.config.behavior.timeout);
            }
            // 设置自定义headers
            if (this.config.behavior?.headers) {
                await this.context.setExtraHTTPHeaders(this.config.behavior.headers);
            }
            this.status.state = 'running';
            this.status.startTime = Date.now();
            // console.log('爬虫初始化完成');
        }
        catch (error) {
            this.status.state = 'error';
            this.status.error = `初始化失败: ${error}`;
            console.error('爬虫初始化失败:', error);
            throw error;
        }
    }
    /**
     * 开始爬取
     */
    async start() {
        if (!this.browser || !this.context) {
            await this.initialize();
        }
        try {
            // 处理起始URL
            for (const startUrl of this.config.startUrls) {
                if (this.config.selectors.listPage) {
                    // 如果配置了列表页，则爬取列表页
                    await this.crawlListPage(startUrl);
                }
                else {
                    // 否则直接爬取详情页
                    await this.crawlDetailPage(startUrl);
                }
            }
            // 注意：数据已在爬取过程中实时保存，这里不需要再次保存
            // await this.saveResults()
            this.status.state = 'completed';
            this.status.runningTime = Date.now() - this.status.startTime;
            // console.log(`爬虫任务完成，共爬取 ${this.status.urlsCrawled} 个URL，保存 ${this.status.itemsSaved} 个项目`);
            return this.results;
        }
        catch (error) {
            this.status.state = 'error';
            this.status.error = `爬取失败: ${error}`;
            this.status.runningTime = Date.now() - this.status.startTime;
            console.error('爬虫任务失败:', error);
            throw error;
        }
        finally {
            await this.close();
        }
    }
    /**
     * 爬取列表页
     * @param url 列表页URL
     */
    async crawlListPage(url, currentPage = 1) {
        if (!this.context)
            throw new Error('浏览器上下文未初始化');
        if (!this.config.selectors.listPage)
            throw new Error('未配置列表页选择器');
        const { items, nextPage, maxPages } = this.config.selectors.listPage;
        // 检查是否达到最大页数限制
        if (maxPages && currentPage > maxPages) {
            // console.log(`已达到最大页数限制 (${maxPages})，停止爬取列表页`);
            return;
        }
        // console.log(`爬取列表页: ${url} (第 ${currentPage} 页)`);
        const page = await this.context.newPage();
        try {
            // 导航到列表页
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            this.status.urlsCrawled++;
            // 等待页面加载完成 - 根据快速模式调整等待时间
            const waitTime = this.config.behavior?.fastMode ? 500 : 2000;
            await page.waitForTimeout(waitTime);
            // console.log(`正在查找选择器: ${items}`);
            // 检查选择器是否存在
            const itemCount = await page.$$(items).then((els) => els.length);
            // console.log(`找到 ${itemCount} 个匹配的元素`);
            if (itemCount === 0) {
                console.warn(`选择器 "${items}" 未找到任何元素`);
                return;
            }
            // 获取所有详情页链接
            const detailUrls = await page.$$eval(items, (elements, baseUrl) => {
                // console.log(`正在处理 ${elements.length} 个元素`);
                return elements
                    .map((el, index) => {
                    // 如果元素本身就是a标签
                    let href = null;
                    if (el.tagName === 'A') {
                        href = el.getAttribute('href');
                    }
                    else {
                        // 否则查找子元素中的a标签
                        const link = el.querySelector('a');
                        href = link ? link.getAttribute('href') : null;
                    }
                    // console.log(`元素 ${index + 1}: href=${href}`);
                    if (!href)
                        return null;
                    // 处理相对URL
                    try {
                        return new URL(href, baseUrl).href;
                    }
                    catch {
                        return null;
                    }
                })
                    .filter((url) => url !== null);
            }, url);
            // console.log(`提取到 ${detailUrls.length} 个详情页链接:`);
            // detailUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
            // 爬取每个详情页
            for (const detailUrl of detailUrls) {
                // 添加请求延迟 - 快速模式下减少延迟
                if (this.config.behavior?.requestDelay) {
                    const delay = this.config.behavior.fastMode
                        ? Math.min(this.config.behavior.requestDelay / 4, 200)
                        : this.config.behavior.requestDelay;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                // 添加重试机制和错误跳过
                await this.crawlDetailPageWithRetry(detailUrl);
            }
            // 处理分页
            if (nextPage) {
                const nextPageUrl = await page
                    .$eval(nextPage, (el, baseUrl) => {
                    const href = el.getAttribute('href');
                    if (!href)
                        return null;
                    // 处理相对URL
                    try {
                        return new URL(href, baseUrl).href;
                    }
                    catch {
                        return null;
                    }
                }, url)
                    .catch(() => null);
                if (nextPageUrl) {
                    // 添加请求延迟 - 快速模式下减少延迟
                    if (this.config.behavior?.requestDelay) {
                        const delay = this.config.behavior.fastMode
                            ? Math.min(this.config.behavior.requestDelay / 4, 200)
                            : this.config.behavior.requestDelay;
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                    await this.crawlListPage(nextPageUrl, currentPage + 1);
                }
            }
            // 处理动态分页（点击式分页）
            const { dynamicPagination } = this.config.selectors.listPage;
            if (dynamicPagination && !nextPage) {
                await this.handleDynamicPagination(page, url, currentPage);
            }
        }
        finally {
            await page.close();
        }
    }
    /**
     * 处理动态分页（点击式分页）
     * @param page 当前页面对象
     * @param baseUrl 基础URL
     * @param currentPage 当前页码
     */
    async handleDynamicPagination(page, baseUrl, currentPage) {
        const { dynamicPagination, maxPages } = this.config.selectors.listPage;
        if (!dynamicPagination)
            return;
        const { nextButton, waitForSelector, waitTime, hasNextPage, retryAttempts, retryDelay } = dynamicPagination;
        // 检查是否达到最大页数限制
        if (maxPages && currentPage >= maxPages) {
            return;
        }
        const maxRetries = retryAttempts || 2;
        const retryDelayMs = retryDelay || 3000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // 检查下一页按钮是否存在且可点击
                const nextButtonElement = await page.$(nextButton);
                if (!nextButtonElement) {
                    console.log(`第${currentPage}页：未找到下一页按钮，分页结束`);
                    return;
                }
                // 如果配置了hasNextPage选择器，检查是否还有下一页
                if (hasNextPage) {
                    const hasNext = await page.$(hasNextPage).catch(() => null);
                    if (!hasNext) {
                        console.log(`第${currentPage}页：检测到无下一页，分页结束`);
                        return;
                    }
                }
                // 检查按钮是否可点击
                const isClickable = await nextButtonElement.isEnabled();
                if (!isClickable) {
                    console.log(`第${currentPage}页：下一页按钮不可点击，分页结束`);
                    return;
                }
                // 点击下一页按钮
                await nextButtonElement.click();
                console.log(`第${currentPage}页：成功点击下一页按钮`);
                // 等待新内容加载
                if (waitForSelector) {
                    await page.waitForSelector(waitForSelector, { timeout: 15000 });
                }
                else {
                    // 使用配置的等待时间或默认等待时间
                    const defaultWaitTime = waitTime || (this.config.behavior?.fastMode ? 1000 : 3000);
                    await page.waitForTimeout(defaultWaitTime);
                }
                // 添加请求延迟
                if (this.config.behavior?.requestDelay) {
                    const delay = this.config.behavior.fastMode
                        ? Math.min(this.config.behavior.requestDelay / 4, 200)
                        : this.config.behavior.requestDelay;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                // 递归处理新加载的内容
                await this.crawlCurrentPageContent(page, baseUrl, currentPage + 1);
                return; // 成功则退出重试循环
            }
            catch (error) {
                console.warn(`动态分页处理失败 (尝试 ${attempt}/${maxRetries}):`, error);
                if (attempt === maxRetries) {
                    console.error(`动态分页最终失败，跳过第${currentPage + 1}页`);
                    return;
                }
                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            }
        }
    }
    /**
     * 爬取当前页面的内容（用于动态分页）
     * @param page 页面对象
     * @param baseUrl 基础URL
     * @param currentPage 当前页码
     */
    async crawlCurrentPageContent(page, baseUrl, currentPage) {
        const { items, dynamicPagination, maxPages } = this.config.selectors.listPage;
        // 检查是否达到最大页数限制
        if (maxPages && currentPage > maxPages) {
            return;
        }
        // 等待页面内容加载
        const waitTime = this.config.behavior?.fastMode ? 500 : 2000;
        await page.waitForTimeout(waitTime);
        // 获取当前页面的详情页链接
        const detailUrls = await page.$$eval(items, (elements, baseUrl) => {
            return elements
                .map((el) => {
                let href = null;
                if (el.tagName === 'A') {
                    href = el.getAttribute('href');
                }
                else {
                    const link = el.querySelector('a');
                    href = link ? link.getAttribute('href') : null;
                }
                if (!href)
                    return null;
                try {
                    return new URL(href, baseUrl).href;
                }
                catch {
                    return null;
                }
            })
                .filter((url) => url !== null);
        }, baseUrl);
        // 爬取每个详情页
        for (const detailUrl of detailUrls) {
            if (this.config.behavior?.requestDelay) {
                const delay = this.config.behavior.fastMode
                    ? Math.min(this.config.behavior.requestDelay / 4, 200)
                    : this.config.behavior.requestDelay;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            // 使用带重试机制的详情页爬取
            await this.crawlDetailPageWithRetry(detailUrl);
        }
        // 继续处理下一页
        if (dynamicPagination) {
            await this.handleDynamicPagination(page, baseUrl, currentPage);
        }
    }
    /**
     * 爬取详情页
     * @param url 详情页URL
     */
    /**
     * 带重试机制的详情页爬取
     * @param url 详情页URL
     */
    async crawlDetailPageWithRetry(url) {
        const maxRetries = this.config.behavior?.retryAttempts || 3;
        const retryDelay = this.config.behavior?.retryDelay || 5000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.crawlDetailPage(url);
                return; // 成功则退出重试循环
            }
            catch (error) {
                console.warn(`详情页爬取失败 (尝试 ${attempt}/${maxRetries}): ${url}`, error);
                if (attempt === maxRetries) {
                    console.error(`详情页爬取最终失败，跳过: ${url}`);
                    // 记录失败的URL但不中断整个流程
                    this.logFailedUrl(url, error);
                    return;
                }
                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    /**
     * 记录失败的URL
     * @param url 失败的URL
     * @param error 错误信息
     */
    logFailedUrl(url, error) {
        const failedItem = {
            url,
            timestamp: Date.now(),
            error: error.toString(),
            status: 'failed'
        };
        // 可以选择保存失败记录到单独的文件
        console.log(`记录失败URL: ${url}`);
    }
    async crawlDetailPage(url) {
        if (!this.context)
            throw new Error('浏览器上下文未初始化');
        if (!this.config.selectors.detailPage) {
            console.warn('未配置详情页选择器，跳过详情页爬取');
            return;
        }
        // console.log(`爬取详情页: ${url}`);
        const page = await this.context.newPage();
        try {
            // 导航到详情页
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            this.status.urlsCrawled++;
            // 等待网络空闲（如果配置了）
            if (this.config.behavior?.waitForNetworkIdle) {
                await page.waitForLoadState('networkidle');
            }
            // 提取数据
            const data = {};
            const { fields } = this.config.selectors.detailPage;
            for (const [fieldName, fieldSelector] of Object.entries(fields)) {
                try {
                    data[fieldName] = await this.extractField(page, fieldSelector, this.configPath);
                }
                catch (error) {
                    console.warn(`提取字段 ${fieldName} 失败:`, error);
                    data[fieldName] = null;
                }
            }
            // 创建爬取结果项
            const item = {
                url,
                timestamp: Date.now(),
                data,
            };
            // 添加到结果集
            this.results.push(item);
            // 立即保存到文件（增量保存）
            await this.saveItemIncremental(item);
            // console.log(`成功提取数据: ${url}`);
        }
        catch (error) {
            console.error(`爬取详情页失败 ${url}:`, error);
            throw error; // 重新抛出错误以便重试机制处理
        }
        finally {
            await page.close();
        }
    }
    /**
     * 提取字段
     * @param page 页面对象
     * @param fieldSelector 字段选择器
     */
    async extractField(page, fieldSelector, configPath) {
        const { selector, extract = 'text', attribute, multiple = false, default: defaultValue, type, fields, } = fieldSelector;
        // 处理嵌套对象类型
        if (type === 'object' && fields) {
            const result = {};
            for (const [fieldName, subFieldSelector] of Object.entries(fields)) {
                try {
                    result[fieldName] = await this.extractField(page, subFieldSelector, configPath);
                }
                catch (error) {
                    console.warn(`提取嵌套字段 ${fieldName} 失败:`, error);
                    result[fieldName] = subFieldSelector.default
                        ? this.processDefaultValue(subFieldSelector.default, page.url(), configPath)
                        : null;
                }
            }
            return result;
        }
        // 如果没有selector，直接返回默认值
        if (!selector) {
            if (defaultValue) {
                return this.processDefaultValue(defaultValue, page.url(), configPath);
            }
            return multiple ? [] : null;
        }
        // 等待选择器出现
        try {
            await page.waitForSelector(selector, { timeout: 5000 });
        }
        catch {
            // 如果选择器没有找到，使用默认值
            if (defaultValue) {
                return this.processDefaultValue(defaultValue, page.url(), configPath);
            }
            return multiple ? [] : null;
        }
        // 根据提取方式获取数据
        if (multiple) {
            // 提取多个元素
            let values = [];
            switch (extract) {
                case 'text':
                    values = await page.$$eval(selector, (els) => els.map((el) => el.textContent?.trim() || ''));
                    break;
                case 'html':
                    values = await page.$$eval(selector, (els) => els.map((el) => el.innerHTML.trim()));
                    break;
                case 'attribute':
                    if (!attribute)
                        throw new Error('使用attribute提取时必须指定attribute参数');
                    values = await page.$$eval(selector, (els, attr) => els.map((el) => el.getAttribute(attr) || ''), attribute);
                    // 如果是href属性，将相对链接转换为绝对链接
                    if (attribute === 'href') {
                        const baseUrl = page.url();
                        values = values.map((url) => this.resolveUrl(url, baseUrl));
                    }
                    break;
            }
            // 应用转换函数
            if (fieldSelector.transform) {
                return values.map(fieldSelector.transform);
            }
            return values;
        }
        else {
            // 提取单个元素
            let value = '';
            switch (extract) {
                case 'text':
                    value = await page
                        .$eval(selector, (el) => el.textContent?.trim() || '')
                        .catch(() => '');
                    break;
                case 'html':
                    value = await page
                        .$eval(selector, (el) => el.innerHTML.trim())
                        .catch(() => '');
                    break;
                case 'attribute':
                    if (!attribute)
                        throw new Error('使用attribute提取时必须指定attribute参数');
                    value = await page
                        .$eval(selector, (el, attr) => el.getAttribute(attr) || '', attribute)
                        .catch(() => '');
                    // 如果是href属性，将相对链接转换为绝对链接
                    if (attribute === 'href' && value) {
                        value = this.resolveUrl(value, page.url());
                    }
                    break;
            }
            // 应用转换函数
            if (fieldSelector.transform) {
                return fieldSelector.transform(value);
            }
            return value;
        }
    }
    /**
     * 解析CSV行，处理引号内的逗号
     * @param line CSV行字符串
     * @returns 解析后的值数组
     */
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // 转义的引号
                    current += '"';
                    i += 2;
                }
                else {
                    // 开始或结束引号
                    inQuotes = !inQuotes;
                    current += char;
                    i++;
                }
            }
            else if (char === ',' && !inQuotes) {
                // 字段分隔符
                result.push(current);
                current = '';
                i++;
            }
            else {
                current += char;
                i++;
            }
        }
        // 添加最后一个字段
        result.push(current);
        return result;
    }
    /**
     * 将相对URL转换为绝对URL
     * @param url 要转换的URL
     * @param baseUrl 基础URL
     */
    resolveUrl(url, baseUrl) {
        try {
            // 如果已经是绝对URL，直接返回
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            // 使用URL构造函数将相对URL转换为绝对URL
            return new URL(url, baseUrl).href;
        }
        catch (error) {
            console.warn(`无法解析URL: ${url}, 基础URL: ${baseUrl}`);
            return url; // 如果解析失败，返回原始URL
        }
    }
    /**
     * 处理默认值中的占位符
     * @param defaultValue 默认值字符串
     * @param currentUrl 当前页面URL
     * @param configPath 配置文件路径
     */
    processDefaultValue(defaultValue, currentUrl, configPath) {
        let result = defaultValue;
        // 替换{{currentUrl}}占位符
        result = result.replace(/\{\{currentUrl\}\}/g, currentUrl);
        // 替换{{filename}}占位符
        if (configPath && result.includes('{{filename}}')) {
            const filename = path.basename(configPath, '.json').replace('-config', '');
            result = result.replace(/\{\{filename\}\}/g, filename);
        }
        return result;
    }
    /**
     * 保存结果
     */
    /**
     * 增量保存单个结果项
     * @param item 要保存的结果项
     */
    async saveItemIncremental(item) {
        const { type, path: outputPath } = this.config.output;
        const dirPath = path.dirname(outputPath);
        // 确保输出目录存在
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        try {
            switch (type) {
                case 'json':
                    // 读取现有文件内容
                    let existingData = [];
                    if (fs.existsSync(outputPath)) {
                        try {
                            const fileContent = fs.readFileSync(outputPath, 'utf8');
                            existingData = JSON.parse(fileContent);
                        }
                        catch (error) {
                            console.warn('读取现有文件失败，将创建新文件:', error);
                        }
                    }
                    // 检查是否存在重复项（基于URL）
                    const existingIndex = existingData.findIndex((existingItem) => existingItem.url === item.url);
                    if (existingIndex !== -1) {
                        // 覆盖现有项目
                        existingData[existingIndex] = item;
                    }
                    else {
                        // 添加新项目
                        existingData.push(item);
                    }
                    // 写入更新后的数据
                    fs.writeFileSync(outputPath, JSON.stringify(existingData, null, 2), 'utf8');
                    break;
                case 'csv':
                    // CSV去重写入
                    const headers = ['url', 'timestamp', ...Object.keys(item.data)];
                    let existingCsvData = [];
                    // 读取现有CSV文件并解析为对象数组
                    if (fs.existsSync(outputPath)) {
                        try {
                            const fileContent = fs.readFileSync(outputPath, 'utf8');
                            const lines = fileContent.trim().split('\n');
                            if (lines.length > 1) {
                                // 有数据行
                                const headerLine = lines[0];
                                const dataLines = lines.slice(1);
                                for (const line of dataLines) {
                                    const values = this.parseCsvLine(line);
                                    if (values.length >= 2) {
                                        const url = values[0].replace(/^"|"$/g, ''); // 移除引号
                                        const timestamp = parseInt(values[1].replace(/^"|"$/g, ''));
                                        // 重构数据对象
                                        const data = {};
                                        for (let i = 2; i < values.length &&
                                            i - 2 < Object.keys(item.data).length; i++) {
                                            const key = Object.keys(item.data)[i - 2];
                                            let value = values[i]
                                                .replace(/^"|"$/g, '')
                                                .replace(/""/g, '"');
                                            // 尝试解析JSON对象
                                            try {
                                                if (value.startsWith('{') || value.startsWith('[')) {
                                                    value = JSON.parse(value);
                                                }
                                            }
                                            catch {
                                                // 保持原始字符串值
                                            }
                                            data[key] = value;
                                        }
                                        existingCsvData.push({ url, timestamp, data });
                                    }
                                }
                            }
                        }
                        catch (error) {
                            console.warn('读取现有CSV文件失败，将创建新文件:', error);
                        }
                    }
                    // 检查是否存在重复项（基于URL）
                    const existingCsvIndex = existingCsvData.findIndex((existingItem) => existingItem.url === item.url);
                    if (existingCsvIndex !== -1) {
                        // 覆盖现有项目
                        existingCsvData[existingCsvIndex] = item;
                    }
                    else {
                        // 添加新项目
                        existingCsvData.push(item);
                    }
                    // 重写整个CSV文件
                    let csvContent = headers.join(',') + '\n';
                    for (const csvItem of existingCsvData) {
                        const row = [csvItem.url, csvItem.timestamp.toString()];
                        for (const key of Object.keys(item.data)) {
                            let value = csvItem.data[key];
                            if (typeof value === 'object' && value !== null) {
                                value = JSON.stringify(value);
                            }
                            row.push(value !== null && value !== undefined ? String(value) : '');
                        }
                        csvContent +=
                            row
                                .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                                .join(',') + '\n';
                    }
                    // 写入文件
                    fs.writeFileSync(outputPath, csvContent, 'utf8');
                    break;
                default:
                    throw new Error(`不支持的输出类型: ${type}`);
            }
            this.status.itemsSaved++;
        }
        catch (error) {
            console.error('增量保存失败:', error);
            throw error;
        }
    }
    async saveResults() {
        if (this.results.length === 0) {
            // console.log('没有结果可保存');
            return;
        }
        const { type, path: outputPath } = this.config.output;
        const dirPath = path.dirname(outputPath);
        // 确保输出目录存在
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        try {
            switch (type) {
                case 'json':
                    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2), 'utf8');
                    break;
                case 'csv':
                    // 简单的CSV导出实现
                    const headers = [
                        'url',
                        'timestamp',
                        ...Object.keys(this.results[0].data),
                    ];
                    const rows = this.results.map((item) => {
                        const row = [item.url, item.timestamp.toString()];
                        for (const key of Object.keys(this.results[0].data)) {
                            let value = item.data[key];
                            // 处理数组和对象
                            if (typeof value === 'object' && value !== null) {
                                value = JSON.stringify(value);
                            }
                            row.push(value !== null && value !== undefined ? String(value) : '');
                        }
                        return row
                            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                            .join(',');
                    });
                    const csv = [headers.join(','), ...rows].join('\n');
                    fs.writeFileSync(outputPath, csv, 'utf8');
                    break;
                default:
                    throw new Error(`不支持的输出类型: ${type}`);
            }
            this.status.itemsSaved = this.results.length;
            // console.log(`已保存 ${this.results.length} 个结果到 ${outputPath}`);
        }
        catch (error) {
            console.error('保存结果失败:', error);
            throw error;
        }
    }
    /**
     * 获取爬虫状态
     */
    getStatus() {
        // 更新运行时间
        if (this.status.state === 'running') {
            this.status.runningTime = Date.now() - this.status.startTime;
        }
        return { ...this.status };
    }
    /**
     * 关闭浏览器
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            // console.log('浏览器已关闭');
        }
    }
}
exports.Crawler = Crawler;
//# sourceMappingURL=crawler.js.map