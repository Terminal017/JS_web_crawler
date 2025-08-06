const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

// 确保输出目录存在
const outputDir = path.join(__dirname, 'data')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

async function downloadPDF(page, pdfUrl, filename) {
  try {
    if (!pdfUrl || !pdfUrl.startsWith('http')) {
      return null
    }

    const pdfDir = path.join(outputDir, 'pdfs')
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true })
    }

    const response = await page.request.get(pdfUrl)
    if (response.ok()) {
      const buffer = await response.body()
      const pdfPath = path.join(pdfDir, `${filename}.pdf`)
      fs.writeFileSync(pdfPath, buffer)
      return pdfPath
    } else {
      return null
    }
  } catch (error) {
    return null
  }
}

async function extractPageData(page, url, billNumber) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // 等待页面稳定
    await page.waitForTimeout(10000)

    // 检查页面是否正确加载
    const pageTitle = await page.title()

    // 检查是否遇到Cloudflare验证
    const bodyText = await page.textContent('body')
    if (
      pageTitle.includes('Cloudflare') ||
      bodyText.includes('cf-browser-verification') ||
      bodyText.includes('challenge-platform')
    ) {
      await page.waitForTimeout(15000) // 额外等待15秒

      // 重新检查页面
      const newTitle = await page.title()
      if (newTitle.includes('Cloudflare')) {
        throw new Error('Cloudflare verification failed')
      }
    }

    // 提取数据
    const data = {
      url: url,
      timestamp: Date.now(),
      data: {
        id: `Bill20-${billNumber}`,
        title: null,
        href: url,
        content: {
          datetime: 'unknown',
          longTitle: null,
        },
        PDF: null,
        pdfId: 'unknown',
        pdfPath: null,
      },
    }

    // 提取标题
    try {
      const titleElement = await page.$('div.lis_doctitle > p')
      if (titleElement) {
        data.data.title = await titleElement.textContent()
        data.data.title = data.data.title?.trim() || null
      }
    } catch (error) {
      console.log(`提取标题失败: ${error.message}`)
    }

    // 提取日期时间
    try {
      const datetimeElement = await page.$(
        '#lis_download > ul > li > small:nth-child(3)',
      )
      if (datetimeElement) {
        data.data.content.datetime = await datetimeElement.textContent()
        data.data.content.datetime =
          data.data.content.datetime?.trim() || 'unknown'
      }
    } catch (error) {
      console.log(`提取日期时间失败: ${error.message}`)
    }

    // 提取长标题
    try {
      const longTitleElement = await page.$('#content > blockquote')
      if (longTitleElement) {
        data.data.content.longTitle = await longTitleElement.textContent()
        data.data.content.longTitle =
          data.data.content.longTitle?.trim() || null
      }
    } catch (error) {
      console.log(`提取长标题失败: ${error.message}`)
    }

    // 提取PDF链接和ID
    try {
      const pdfElement = await page.$('#lis_download > ul > li > a')
      if (pdfElement) {
        const pdfHref = await pdfElement.getAttribute('href')
        const pdfText = await pdfElement.textContent()

        if (pdfHref) {
          // 处理相对链接
          let fullPdfUrl = pdfHref
          if (pdfHref.startsWith('/')) {
            fullPdfUrl = 'https://web.senate.gov.ph' + pdfHref
          } else if (!pdfHref.startsWith('http')) {
            fullPdfUrl = 'https://web.senate.gov.ph/lis/' + pdfHref
          }

          data.data.PDF = fullPdfUrl
          data.data.pdfId = pdfText?.trim() || 'unknown'

          // 下载PDF
          const pdfPath = await downloadPDF(
            page,
            fullPdfUrl,
            `SBN-${billNumber}`,
          )
          if (pdfPath) {
            data.data.pdfPath = pdfPath
          }
        }
      }
    } catch (error) {
      console.log(`提取PDF信息失败: ${error.message}`)
    }

    return data
  } catch (error) {
    console.log(`处理页面 SBN-${billNumber} 时出错: ${error.message}`)
    return {
      url: url,
      timestamp: Date.now(),
      error: error.message,
      data: {
        id: `Bill20-${billNumber}`,
        title: null,
        href: url,
        content: {
          datetime: 'unknown',
          longTitle: null,
        },
        PDF: null,
        pdfId: 'unknown',
        pdfPath: null,
      },
    }
  }
}

async function main() {
  const results = []

  // 从SBN-299到SBN-1循环爬取
  for (let billNumber = 300; billNumber >= 1; billNumber--) {
    const url = `https://web.senate.gov.ph/lis/bill_res.aspx?congress=20&q=SBN-${billNumber}`

    // 每次访问都创建新的浏览器实例
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    })

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    })

    context.setDefaultTimeout(60000)
    const page = await context.newPage()

    try {
      const data = await extractPageData(page, url, billNumber)
      results.push(data)

      const outputPath = path.join(outputDir, 'Bill20.json')
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8')
    } catch (error) {
      results.push({
        url: url,
        timestamp: Date.now(),
        error: error.message,
        data: {
          id: `Bill20-${billNumber}`,
          title: null,
          href: url,
          content: {
            datetime: 'unknown',
            longTitle: null,
          },
          PDF: null,
          pdfId: 'unknown',
          pdfPath: null,
        },
      })
    } finally {
      // 每次访问完成后关闭浏览器，确保下次是全新身份
      await browser.close()

      // 等待5秒再开始下一次访问
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }

  // 最终保存所有数据
  const outputPath = path.join(outputDir, 'Bill20.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8')
  console.log(`爬取完成！共处理 ${results.length} 个法案`)
}

// 运行爬虫
main().catch(console.error)
