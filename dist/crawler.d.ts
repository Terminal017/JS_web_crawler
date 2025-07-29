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
     * 爬取列表页
     * @param url 列表页URL
     */
    private crawlListPage;
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
    private saveResults;
    /**
     * 获取爬虫状态
     */
    getStatus(): CrawlerStatus;
    /**
     * 关闭浏览器
     */
    close(): Promise<void>;
}
