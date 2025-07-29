/**
 * 爬虫配置接口
 */
export interface CrawlerConfig {
  /** 起始URL */
  startUrls: string[];
  /** 选择器配置 */
  selectors: {
    /** 列表页选择器 */
    listPage?: {
      /** 列表项选择器 */
      items: string;
      /** 下一页链接选择器 */
      nextPage?: string;
      /** 最大爬取页数 */
      maxPages?: number;
    };
    /** 详情页选择器 */
    detailPage?: {
      /** 字段选择器映射 */
      fields: Record<string, FieldSelector>;
    };
  };
  /** 输出配置 */
  output: {
    /** 输出类型: json, csv等 */
    type: 'json' | 'csv';
    /** 输出路径 */
    path: string;
  };
  /** 爬虫行为配置 */
  behavior?: {
    /** 请求间隔(毫秒) */
    requestDelay?: number;
    /** 超时设置(毫秒) */
    timeout?: number;
    /** 是否启用JavaScript */
    javascript?: boolean;
    /** 自定义headers */
    headers?: Record<string, string>;
    /** 代理设置 */
    proxy?: string;
    /** 浏览器类型 */
    browserType?: 'chromium' | 'firefox' | 'webkit';
    /** 用户代理 */
    userAgent?: string;
  };
}

/**
 * 字段选择器接口
 */
export interface FieldSelector {
  /** CSS选择器 */
  selector?: string;
  /** 提取方式 */
  extract?: 'text' | 'html' | 'attribute';
  /** 如果extract为attribute，指定属性名 */
  attribute?: string;
  /** 多个结果时的处理方式 */
  multiple?: boolean;
  /** 默认值，支持占位符如{{filename}}、{{currentUrl}} */
  default?: string;
  /** 转换函数 */
  transform?: (value: string) => any;
  /** 字段类型，支持嵌套对象 */
  type?: 'object';
  /** 当type为object时，定义子字段 */
  fields?: Record<string, FieldSelector>;
}

/**
 * 爬取结果项接口
 */
export interface CrawlItem {
  /** 唯一标识 */
  id?: string;
  /** URL */
  url: string;
  /** 爬取时间 */
  timestamp: number;
  /** 数据字段 */
  data: Record<string, any>;
}

/**
 * 爬虫状态接口
 */
export interface CrawlerStatus {
  /** 已爬取的URL数量 */
  urlsCrawled: number;
  /** 已保存的项目数量 */
  itemsSaved: number;
  /** 开始时间 */
  startTime: number;
  /** 运行时间(毫秒) */
  runningTime: number;
  /** 当前状态 */
  state: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  /** 错误信息 */
  error?: string;
}

/**
 * 统一的采集输出结构接口
 */
export interface CrawlOutputItem {
  /** 唯一标识，等于详情页链接的文件名 */
  id: string;
  /** 标题 */
  title: string;
  /** 详情页链接 */
  href: string;
  /** 主要内容，嵌套结构 */
  content: {
    author: string;
    article: string;
    pdf?: string | null;
  };
  /** PDF下载链接（如有） */
  PDF: string | null;
}