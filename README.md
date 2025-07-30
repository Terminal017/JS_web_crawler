# JS Web Crawler - 批量运行功能

由 Claude 和 Trae 协助开发的基于 Playwright 的 TypeScript 爬虫项目，支持批量处理多个爬虫配置文件

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

## 批量运行功能

### 项目结构

```
JS_web_crawler/
├── Index/                    # 主入口文件夹
│   ├── A1/                  # 脚本文件夹1
│   │   ├── Media-config.json
│   │   └── Press-releases-config.json
│   └── A2/                  # 脚本文件夹2
│       └── B1-config.json
├── src/                     # 源代码
├── dist/                    # 编译后的代码
├── data/                    # 输出数据目录
├── run-all.js              # 批量运行脚本
└── package.json
```

### 批量运行所有配置

```bash
npm run run-all
```

### 部署到服务器

```bash
npm run deploy
```

### 添加新的爬虫任务

1. 在 `Index/` 文件夹下创建新的子文件夹（如 `A3/`）
2. 在子文件夹中放置配置文件（如 `config.json`）
3. 确保配置文件中的输出路径正确（如 `./data/A3/config.json`）
4. 运行 `npm run run-all` 即可自动包含新任务
