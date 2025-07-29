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
            state: 'idle'
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
                ...(this.config.behavior?.proxy ? { proxy: { server: this.config.behavior.proxy } } : {})
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
                javaScriptEnabled: this.config.behavior?.javascript !== false
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
            // 保存结果
            await this.saveResults();
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
            // 等待页面加载完成
            await page.waitForTimeout(5000);
            // console.log(`正在查找选择器: ${items}`);
            // 检查选择器是否存在
            const itemCount = await page.$$(items).then(els => els.length);
            // console.log(`找到 ${itemCount} 个匹配的元素`);
            if (itemCount === 0) {
                console.warn(`选择器 "${items}" 未找到任何元素`);
                return;
            }
            // 获取所有详情页链接
            const detailUrls = await page.$$eval(items, (elements, baseUrl) => {
                // console.log(`正在处理 ${elements.length} 个元素`);
                return elements.map((el, index) => {
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
                }).filter(url => url !== null);
            }, url);
            // console.log(`提取到 ${detailUrls.length} 个详情页链接:`);
            // detailUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
            // 爬取每个详情页
            for (const detailUrl of detailUrls) {
                // 添加请求延迟
                if (this.config.behavior?.requestDelay) {
                    await new Promise(resolve => setTimeout(resolve, this.config.behavior.requestDelay));
                }
                await this.crawlDetailPage(detailUrl);
            }
            // 处理分页
            if (nextPage) {
                const nextPageUrl = await page.$eval(nextPage, (el, baseUrl) => {
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
                }, url).catch(() => null);
                if (nextPageUrl) {
                    // 添加请求延迟
                    if (this.config.behavior?.requestDelay) {
                        await new Promise(resolve => setTimeout(resolve, this.config.behavior.requestDelay));
                    }
                    await this.crawlListPage(nextPageUrl, currentPage + 1);
                }
            }
        }
        finally {
            await page.close();
        }
    }
    /**
     * 爬取详情页
     * @param url 详情页URL
     */
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
                data
            };
            // 添加到结果集
            this.results.push(item);
            // console.log(`成功提取数据: ${url}`);
        }
        catch (error) {
            console.error(`爬取详情页失败 ${url}:`, error);
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
        const { selector, extract = 'text', attribute, multiple = false, default: defaultValue, type, fields } = fieldSelector;
        // 处理嵌套对象类型
        if (type === 'object' && fields) {
            const result = {};
            for (const [fieldName, subFieldSelector] of Object.entries(fields)) {
                try {
                    result[fieldName] = await this.extractField(page, subFieldSelector, configPath);
                }
                catch (error) {
                    console.warn(`提取嵌套字段 ${fieldName} 失败:`, error);
                    result[fieldName] = subFieldSelector.default ? this.processDefaultValue(subFieldSelector.default, page.url(), configPath) : null;
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
                    values = await page.$$eval(selector, els => els.map(el => el.textContent?.trim() || ''));
                    break;
                case 'html':
                    values = await page.$$eval(selector, els => els.map(el => el.innerHTML.trim()));
                    break;
                case 'attribute':
                    if (!attribute)
                        throw new Error('使用attribute提取时必须指定attribute参数');
                    values = await page.$$eval(selector, (els, attr) => els.map(el => el.getAttribute(attr) || ''), attribute);
                    // 如果是href属性，将相对链接转换为绝对链接
                    if (attribute === 'href') {
                        const baseUrl = page.url();
                        values = values.map(url => this.resolveUrl(url, baseUrl));
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
                    value = await page.$eval(selector, el => el.textContent?.trim() || '').catch(() => '');
                    break;
                case 'html':
                    value = await page.$eval(selector, el => el.innerHTML.trim()).catch(() => '');
                    break;
                case 'attribute':
                    if (!attribute)
                        throw new Error('使用attribute提取时必须指定attribute参数');
                    value = await page.$eval(selector, (el, attr) => el.getAttribute(attr) || '', attribute).catch(() => '');
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
                    const headers = ['url', 'timestamp', ...Object.keys(this.results[0].data)];
                    const rows = this.results.map(item => {
                        const row = [item.url, item.timestamp.toString()];
                        for (const key of Object.keys(this.results[0].data)) {
                            let value = item.data[key];
                            // 处理数组和对象
                            if (typeof value === 'object' && value !== null) {
                                value = JSON.stringify(value);
                            }
                            row.push(value !== null && value !== undefined ? String(value) : '');
                        }
                        return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
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