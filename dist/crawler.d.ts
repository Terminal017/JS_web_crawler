import { CrawlerConfig, CrawlItem, CrawlerStatus } from './types';
/**
 * 网络爬虫类
 */
export declare class Crawler {
    private browser;
    private context;
    private config;
    private configPath?;
    private results;
    private status;
    /**
     * 构造函数
     * @param config 爬虫配置
     * @param configPath 配置文件路径
     */
    constructor(config: CrawlerConfig, configPath?: string);
    /**
     * 初始化浏览器
     */
    initialize(): Promise<void>;
    /**
     * 开始爬取
     */
    start(): Promise<CrawlItem[]>;
    /**
     * 爬取索引页
     * @param url 索引页URL
     */
    private crawlIndexPage;
    /**
     * 爬取列表页
     * @param url 列表页URL
     */
    private crawlListPage;
    /**
     * 处理动态分页（点击式分页）
     * @param page 当前页面对象
     * @param baseUrl 基础URL
     * @param currentPage 当前页码
     */
    private handleDynamicPagination;
    /**
     * 爬取当前页面的内容（用于动态分页）
     * @param page 页面对象
     * @param baseUrl 基础URL
     * @param currentPage 当前页码
     */
    private crawlCurrentPageContent;
    /**
     * 爬取详情页
     * @param url 详情页URL
     */
    private crawlDetailPage;
    /**
     * 提取字段
     * @param page 页面对象
     * @param fieldSelector 字段选择器
     */
    private extractField;
    /**
     * 解析CSV行，处理引号内的逗号
     * @param line CSV行字符串
     * @returns 解析后的值数组
     */
    private parseCsvLine;
    /**
     * 将相对URL转换为绝对URL
     * @param url 要转换的URL
     * @param baseUrl 基础URL
     */
    private resolveUrl;
    /**
     * 处理默认值中的占位符
     * @param defaultValue 默认值字符串
     * @param currentUrl 当前页面URL
     * @param configPath 配置文件路径
     */
    private processDefaultValue;
    /**
     * 保存结果
     */
    /**
     * 增量保存单个结果项
     * @param item 要保存的结果项
     */
    private saveItemIncremental;
    private saveResults;
    /**
     * 下载PDF文件
     * @param pdfUrl PDF文件URL
     * @param filename 文件名
     */
    private downloadPDF;
    /**
     * 获取爬虫状态
     */
    getStatus(): CrawlerStatus;
    /**
     * 关闭浏览器
     */
    close(): Promise<void>;
}
