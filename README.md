# JS Web Crawler

由 Claude 和 Trae 协助开发的基于 Playwright 的 TypeScript 爬虫项目

## 项目简介

这是一个功能强大、配置灵活的网页爬虫工具，基于 Playwright 和 TypeScript 开发。支持通过 JSON 配置文件定义爬取规则，可以轻松抓取各种网站的数据。

## 功能特性

- 🚀 **基于 Playwright**：支持现代 JavaScript 网站，处理动态内容
- 📝 **TypeScript 开发**：类型安全，代码可维护性强
- ⚙️ **配置驱动**：通过 JSON 配置文件定义爬取规则，无需修改代码
- 🎯 **多页面支持**：支持列表页和详情页的数据抓取
- 🔧 **灵活选择器**：支持 CSS 选择器和多种数据提取方式
- 🌐 **无头模式**：支持后台运行，提高性能
- 📊 **结构化输出**：将抓取结果保存为 JSON 格式

## 安装依赖

```bash
npm install
```

## 项目结构

```
JS_web_crawler/
├── src/                    # 源代码目录
│   ├── crawler.ts         # 爬虫核心逻辑
│   ├── main.ts           # 程序入口
│   └── types.ts          # 类型定义
├── A1/                    # 配置文件目录 A1
│   └── C1-config.json    # 示例配置文件
├── A2/                    # 配置文件目录 A2
│   └── B1-config.json    # 示例配置文件
├── data/                  # 数据输出目录
├── dist/                  # 编译后的 JavaScript 文件
└── README.md             # 项目说明文档
```

## 配置文件说明

配置文件采用 JSON 格式，主要包含以下字段：

### 基本配置

```json
{
  "startUrls": ["https://example.com"], // 起始 URL 列表
  "selectors": {
    "listPage": {
      // 列表页配置
      "items": "a.item-link", // 列表项选择器
      "maxPages": 1, // 最大抓取页数
      "itemLink": {
        "selector": ".", // 链接选择器
        "extract": "attribute", // 提取方式
        "attribute": "href" // 提取属性
      }
    },
    "detailPage": {
      // 详情页配置
      "fields": {
        "title": {
          "selector": "h1", // 标题选择器
          "extract": "text" // 提取文本
        },
        "content": {
          "selector": ".content", // 内容选择器
          "extract": "text"
        }
      }
    }
  },
  "behavior": {
    // 行为配置
    "headless": true, // 无头模式
    "requestDelay": 1500, // 请求延迟（毫秒）
    "timeout": 60000, // 超时时间
    "javascript": true, // 启用 JavaScript
    "browserType": "chromium" // 浏览器类型
  }
}
```

## 使用方法

### 1. 编译项目

```bash
npm run build
```

### 2. 运行爬虫

```bash
# 运行单个配置文件
node dist/main.js A1/C1-config.json

# 或使用 npm 脚本
npm start A1/C1-config.json
```

### 3. 开发模式运行

```bash
npm run dev A1/C1-config.json
```

## 输出结果

爬取的数据将保存在 `data/` 目录下，文件名与配置文件名对应。例如：

- `A1/C1-config.json` → `data/C1.json`
- `A2/B1-config.json` → `data/B1.json`

## 注意事项

- 请遵守目标网站的 robots.txt 和使用条款
- 合理设置请求延迟，避免对服务器造成过大压力
- 建议在开发时先使用 `headless: false` 进行调试
- 生产环境建议使用 `headless: true` 提高性能

---

## English Usage Guide

### Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Build the project**:

   ```bash
   npm run build
   ```

3. **Run the crawler**:
   ```bash
   node dist/main.js path/to/config.json
   ```

### Configuration Structure

The crawler uses JSON configuration files to define scraping rules:

- `startUrls`: Array of starting URLs
- `selectors.listPage`: Configuration for list pages (item links extraction)
- `selectors.detailPage`: Configuration for detail pages (data extraction)
- `behavior`: Browser behavior settings (headless mode, delays, timeouts)

### Output

Scraped data is saved as JSON files in the `data/` directory. The filename corresponds to the configuration file name.

### Development

For development and debugging, you can run:

```bash
npm run dev path/to/config.json
```

This project is built with TypeScript and Playwright, providing a robust and flexible web scraping solution.
