# JS Web Crawler

由 Claude 和 Trae 协助开发的基于 Playwright 的 TypeScript 爬虫项目

### 基本配置

```js
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
