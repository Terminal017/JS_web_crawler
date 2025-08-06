# 菲律宾参议院法案爬虫

这个独立的爬虫项目用于获取菲律宾参议院第20届国会的法案数据（SBN-1到SBN-300）。

## 功能特性

- 循环获取SBN-300到SBN-1共300个法案页面
- 提取法案标题、长标题、日期时间等信息
- 自动下载PDF文件到本地
- 数据保存为JSON格式
- 每处理10个法案自动保存一次数据
- 包含错误处理和进度显示

## 安装和运行

```bash
# 安装依赖
npm install

# 安装浏览器
npx playwright install chromium

# 运行爬虫
npm start
```

## 输出文件

- `data/Bill20.json` - 主要数据文件
- `data/pdfs/` - PDF文件存储目录

## 数据格式

每个法案的数据结构：
```json
{
  "url": "https://web.senate.gov.ph/lis/bill_res.aspx?congress=20&q=SBN-300",
  "timestamp": 1754486013680,
  "data": {
    "id": "Bill20-300",
    "title": "法案标题",
    "href": "页面URL",
    "content": {
      "datetime": "日期时间",
      "longTitle": "完整标题"
    },
    "PDF": "PDF下载链接",
    "pdfId": "PDF标识",
    "pdfPath": "本地PDF路径"
  }
}
```

## 注意事项

- 爬虫会按照从SBN-300到SBN-1的顺序处理
- 每个请求之间有1秒延迟避免过快访问
- 自动处理相对链接转换为绝对链接
- 包含完整的错误处理机制