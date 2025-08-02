import {
  chromium,
  firefox,
  webkit,
  Browser,
  BrowserContext,
  Page,
} from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { CrawlerConfig, CrawlItem, CrawlerStatus, FieldSelector } from './types'

/**
 * 网络爬虫类
 */
export class Crawler {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private config: CrawlerConfig
  private configPath?: string
  private results: CrawlItem[] = []
  private status: CrawlerStatus = {
    urlsCrawled: 0,
    itemsSaved: 0,
    startTime: 0,
    runningTime: 0,
    state: 'idle',
  }

  /**
   * 构造函数
   * @param config 爬虫配置
   * @param configPath 配置文件路径
   */
  constructor(config: CrawlerConfig, configPath?: string) {
    this.config = config
    this.configPath = configPath
  }

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    try {
      // 根据配置选择浏览器类型，默认使用chromium
      const browserType = this.config.behavior?.browserType || 'chromium'
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
      }

      switch (browserType) {
        case 'firefox':
          this.browser = await firefox.launch(launchOptions)
          break
        case 'webkit':
          this.browser = await webkit.launch(launchOptions)
          break
        default:
          this.browser = await chromium.launch(launchOptions)
      }

      // 创建浏览器上下文
      this.context = await this.browser.newContext({
        userAgent: this.config.behavior?.userAgent,
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        javaScriptEnabled: this.config.behavior?.javascript !== false,
      })

      // 设置超时
      if (this.config.behavior?.timeout) {
        this.context.setDefaultTimeout(this.config.behavior.timeout)
        this.context.setDefaultNavigationTimeout(this.config.behavior.timeout)
      }

      // 设置自定义headers
      if (this.config.behavior?.headers) {
        await this.context.setExtraHTTPHeaders(this.config.behavior.headers)
      }

      this.status.state = 'running'
      this.status.startTime = Date.now()
      // console.log('爬虫初始化完成');
    } catch (error) {
      this.status.state = 'error'
      this.status.error = `初始化失败: ${error}`
      console.error('爬虫初始化失败:', error)
      throw error
    }
  }

  /**
   * 开始爬取
   */
  async start(): Promise<CrawlItem[]> {
    if (!this.browser || !this.context) {
      await this.initialize()
    }

    try {
      // 处理起始URL
      for (const startUrl of this.config.startUrls) {
        if (this.config.selectors.listPage) {
          // 如果配置了列表页，则爬取列表页
          await this.crawlListPage(startUrl)
        } else {
          // 否则直接爬取详情页
          await this.crawlDetailPage(startUrl)
        }
      }

      // 注意：数据已在爬取过程中实时保存，这里不需要再次保存
      // await this.saveResults()

      this.status.state = 'completed'
      this.status.runningTime = Date.now() - this.status.startTime
      // console.log(`爬虫任务完成，共爬取 ${this.status.urlsCrawled} 个URL，保存 ${this.status.itemsSaved} 个项目`);

      return this.results
    } catch (error) {
      this.status.state = 'error'
      this.status.error = `爬取失败: ${error}`
      this.status.runningTime = Date.now() - this.status.startTime
      console.error('爬虫任务失败:', error)
      throw error
    } finally {
      await this.close()
    }
  }

  /**
   * 爬取列表页
   * @param url 列表页URL
   */
  private async crawlListPage(url: string, currentPage = 1): Promise<void> {
    if (!this.context) throw new Error('浏览器上下文未初始化')
    if (!this.config.selectors.listPage) throw new Error('未配置列表页选择器')

    const { items, nextPage, maxPages } = this.config.selectors.listPage

    // 检查是否达到最大页数限制
    if (maxPages && currentPage > maxPages) {
      // console.log(`已达到最大页数限制 (${maxPages})，停止爬取列表页`);
      return
    }

    // console.log(`爬取列表页: ${url} (第 ${currentPage} 页)`);
    const page = await this.context.newPage()

    try {
      // 导航到列表页
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      this.status.urlsCrawled++

      // 添加请求延迟
      if (this.config.behavior?.requestDelay) {
        await page.waitForTimeout(this.config.behavior.requestDelay)
      }

      // 等待页面加载完成 - 根据快速模式调整等待时间
      const waitTime = this.config.behavior?.fastMode ? 500 : 2000
      await page.waitForTimeout(waitTime)

      // console.log(`正在查找选择器: ${items}`);

      // 检查选择器是否存在
      const itemCount = await page.$$(items).then((els) => els.length)
      // console.log(`找到 ${itemCount} 个匹配的元素`);

      if (itemCount === 0) {
        const continueOnError = this.config.behavior?.continueOnError || false
        const errorMsg = `选择器 "${items}" 未找到任何元素`
        
        if (continueOnError) {
          console.warn(`${errorMsg}，跳过此页面`)
          return
        } else {
          throw new Error(errorMsg)
        }
      }

      // 获取所有详情页链接
      const detailUrls = await page.$$eval(
        items,
        (elements, baseUrl) => {
          // console.log(`正在处理 ${elements.length} 个元素`);
          return elements
            .map((el, index) => {
              // 如果元素本身就是a标签
              let href = null

              if (el.tagName === 'A') {
                href = (el as HTMLAnchorElement).getAttribute('href')
              } else {
                // 否则查找子元素中的a标签
                const link = el.querySelector('a')
                href = link ? link.getAttribute('href') : null
              }

              // console.log(`元素 ${index + 1}: href=${href}`);

              if (!href) return null

              // 处理相对URL
              try {
                return new URL(href, baseUrl).href
              } catch {
                return null
              }
            })
            .filter((url) => url !== null) as string[]
        },
        url,
      )

      // console.log(`提取到 ${detailUrls.length} 个详情页链接:`);
      // detailUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

      // 爬取每个详情页
      for (const detailUrl of detailUrls) {
        try {
          // 添加请求延迟 - 快速模式下减少延迟
          if (this.config.behavior?.requestDelay) {
            const delay = this.config.behavior.fastMode
              ? Math.min(this.config.behavior.requestDelay / 4, 200)
              : this.config.behavior.requestDelay
            await new Promise((resolve) => setTimeout(resolve, delay))
          }

          await this.crawlDetailPage(detailUrl)
        } catch (error) {
          const continueOnError = this.config.behavior?.continueOnError || false
          
          if (continueOnError) {
            console.warn(`跳过失败的详情页: ${detailUrl}，错误:`, error)
            continue // 继续处理下一个详情页
          } else {
            throw error // 如果不允许继续，则抛出错误
          }
        }
      }

      // 处理分页
      if (nextPage) {
        const nextPageUrl = await page
          .$eval(
            nextPage,
            (el, baseUrl) => {
              const href = el.getAttribute('href')
              if (!href) return null

              // 处理相对URL
              try {
                return new URL(href, baseUrl).href
              } catch {
                return null
              }
            },
            url,
          )
          .catch(() => null)

        if (nextPageUrl) {
          // 添加请求延迟 - 快速模式下减少延迟
          if (this.config.behavior?.requestDelay) {
            const delay = this.config.behavior.fastMode
              ? Math.min(this.config.behavior.requestDelay / 4, 200)
              : this.config.behavior.requestDelay
            await new Promise((resolve) => setTimeout(resolve, delay))
          }

          await this.crawlListPage(nextPageUrl, currentPage + 1)
        }
      }

      // 处理动态分页（点击式分页）
      const { dynamicPagination } = this.config.selectors.listPage
      if (dynamicPagination && !nextPage) {
        await this.handleDynamicPagination(page, url, currentPage)
      }
    } finally {
      await page.close()
    }
  }

  /**
   * 处理动态分页（点击式分页）
   * @param page 当前页面对象
   * @param baseUrl 基础URL
   * @param currentPage 当前页码
   */
  private async handleDynamicPagination(
    page: Page,
    baseUrl: string,
    currentPage: number,
  ): Promise<void> {
    const { dynamicPagination, maxPages } = this.config.selectors.listPage!
    if (!dynamicPagination) return

    const { nextButton, waitForSelector, waitTime, hasNextPage } =
      dynamicPagination

    // 检查是否达到最大页数限制
    if (maxPages && currentPage >= maxPages) {
      return
    }

    try {
      // 检查下一页按钮是否存在且可点击
      const nextButtonElement = await page.$(nextButton)
      if (!nextButtonElement) {
        return
      }

      // 如果配置了hasNextPage选择器，检查是否还有下一页
      if (hasNextPage) {
        const hasNext = await page.$(hasNextPage).catch(() => null)
        if (!hasNext) {
          return
        }
      }

      // 检查按钮是否可点击
      const isClickable = await nextButtonElement.isEnabled()
      if (!isClickable) {
        return
      }

      // 点击下一页按钮
      await nextButtonElement.click()

      // 等待新内容加载
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 })
      } else {
        // 使用配置的等待时间或默认等待时间
        const defaultWaitTime =
          waitTime || (this.config.behavior?.fastMode ? 1000 : 3000)
        await page.waitForTimeout(defaultWaitTime)
      }

      // 添加请求延迟
      if (this.config.behavior?.requestDelay) {
        const delay = this.config.behavior.fastMode
          ? Math.min(this.config.behavior.requestDelay / 4, 200)
          : this.config.behavior.requestDelay
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      // 递归处理新加载的内容
      await this.crawlCurrentPageContent(page, baseUrl, currentPage + 1)
    } catch (error) {
      console.error(`动态分页处理失败:`, error)
    }
  }

  /**
   * 爬取当前页面的内容（用于动态分页）
   * @param page 页面对象
   * @param baseUrl 基础URL
   * @param currentPage 当前页码
   */
  private async crawlCurrentPageContent(
    page: Page,
    baseUrl: string,
    currentPage: number,
  ): Promise<void> {
    const { items, dynamicPagination, maxPages } =
      this.config.selectors.listPage!

    // 检查是否达到最大页数限制
    if (maxPages && currentPage > maxPages) {
      return
    }

    // 等待页面内容加载
    const waitTime = this.config.behavior?.fastMode ? 500 : 2000
    await page.waitForTimeout(waitTime)

    // 获取当前页面的详情页链接
    const detailUrls = await page.$$eval(
      items,
      (elements, baseUrl) => {
        return elements
          .map((el) => {
            let href = null
            if (el.tagName === 'A') {
              href = (el as HTMLAnchorElement).getAttribute('href')
            } else {
              const link = el.querySelector('a')
              href = link ? link.getAttribute('href') : null
            }

            if (!href) return null

            try {
              return new URL(href, baseUrl).href
            } catch {
              return null
            }
          })
          .filter((url) => url !== null) as string[]
      },
      baseUrl,
    )

    // 爬取每个详情页
    for (const detailUrl of detailUrls) {
      if (this.config.behavior?.requestDelay) {
        const delay = this.config.behavior.fastMode
          ? Math.min(this.config.behavior.requestDelay / 4, 200)
          : this.config.behavior.requestDelay
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      await this.crawlDetailPage(detailUrl)
    }

    // 继续处理下一页
    if (dynamicPagination) {
      await this.handleDynamicPagination(page, baseUrl, currentPage)
    }
  }

  /**
   * 爬取详情页
   * @param url 详情页URL
   */
  private async crawlDetailPage(url: string): Promise<void> {
    if (!this.context) throw new Error('浏览器上下文未初始化')
    if (!this.config.selectors.detailPage) {
      console.warn('未配置详情页选择器，跳过详情页爬取')
      return
    }

    const retryAttempts = this.config.behavior?.retryAttempts || 1
    const continueOnError = this.config.behavior?.continueOnError || false
    
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      const page = await this.context.newPage()
      
      try {
        // console.log(`爬取详情页: ${url} (尝试 ${attempt}/${retryAttempts})`);
        
        // 导航到详情页
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        this.status.urlsCrawled++

        // 添加请求延迟
        if (this.config.behavior?.requestDelay) {
          await page.waitForTimeout(this.config.behavior.requestDelay)
        }

        // 提取数据
        const data: Record<string, any> = {}
        const { fields } = this.config.selectors.detailPage

        for (const [fieldName, fieldSelector] of Object.entries(fields)) {
          try {
            data[fieldName] = await this.extractField(
              page,
              fieldSelector,
              this.configPath,
            )
          } catch (error) {
            console.warn(`提取字段 ${fieldName} 失败:`, error)
            data[fieldName] = null
          }
        }

        // 下载PDF（如果配置了）
        if (this.config.downloadPDF?.enabled && data.PDF && data[this.config.downloadPDF.filenameField]) {
          try {
            await this.downloadPDF(data.PDF, data[this.config.downloadPDF.filenameField])
          } catch (error) {
            console.warn(`PDF下载失败: ${error}`)
          }
        }

        // 创建爬取结果项
        const item: CrawlItem = {
          url,
          timestamp: Date.now(),
          data,
        }

        // 添加到结果集
        this.results.push(item)

        // 立即保存到文件（增量保存）
        await this.saveItemIncremental(item)
        // console.log(`成功提取数据: ${url}`);
        
        await page.close()
        return // 成功则退出重试循环
        
      } catch (error) {
        await page.close()
        
        if (attempt === retryAttempts) {
          // 最后一次尝试失败
          console.error(`爬取详情页失败 ${url} (已重试 ${retryAttempts} 次):`, error)
          
          if (!continueOnError) {
            throw error // 如果不允许继续执行，则抛出错误
          } else {
            console.warn(`跳过失败的页面: ${url}`)
            return // 跳过这个页面，继续执行
          }
        } else {
          console.warn(`爬取详情页失败 ${url} (尝试 ${attempt}/${retryAttempts}):`, error)
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      }
    }
  }

  /**
   * 提取字段
   * @param page 页面对象
   * @param fieldSelector 字段选择器
   */
  private async extractField(
    page: Page,
    fieldSelector: FieldSelector,
    configPath?: string,
  ): Promise<any> {
    const {
      selector,
      extract = 'text',
      attribute,
      multiple = false,
      default: defaultValue,
      type,
      fields,
    } = fieldSelector

    // 处理嵌套对象类型
    if (type === 'object' && fields) {
      const result: Record<string, any> = {}
      for (const [fieldName, subFieldSelector] of Object.entries(fields)) {
        try {
          result[fieldName] = await this.extractField(
            page,
            subFieldSelector,
            configPath,
          )
        } catch (error) {
          console.warn(`提取嵌套字段 ${fieldName} 失败:`, error)
          result[fieldName] = subFieldSelector.default
            ? this.processDefaultValue(
                subFieldSelector.default,
                page.url(),
                configPath,
              )
            : null
        }
      }
      return result
    }

    // 如果没有selector，直接返回默认值
    if (!selector) {
      if (defaultValue) {
        return this.processDefaultValue(defaultValue, page.url(), configPath)
      }
      return multiple ? [] : null
    }

    // 等待选择器出现
    try {
      await page.waitForSelector(selector, { timeout: 5000 })
    } catch {
      // 如果选择器没有找到，使用默认值
      if (defaultValue) {
        return this.processDefaultValue(defaultValue, page.url(), configPath)
      }
      return multiple ? [] : null
    }

    // 根据提取方式获取数据
    if (multiple) {
      // 提取多个元素
      let values: string[] = []

      switch (extract) {
        case 'text':
          values = await page.$$eval(selector, (els) =>
            els.map((el) => el.textContent?.trim() || ''),
          )
          break
        case 'html':
          values = await page.$$eval(selector, (els) =>
            els.map((el) => el.innerHTML.trim()),
          )
          break
        case 'attribute':
          if (!attribute)
            throw new Error('使用attribute提取时必须指定attribute参数')
          values = await page.$$eval(
            selector,
            (els, attr) => els.map((el) => el.getAttribute(attr) || ''),
            attribute,
          )
          // 如果是href属性，将相对链接转换为绝对链接
          if (attribute === 'href') {
            const baseUrl = page.url()
            values = values.map((url) => this.resolveUrl(url, baseUrl))
          }
          break
      }

      // 应用转换函数
      if (fieldSelector.transform) {
        return values.map(fieldSelector.transform)
      }

      return values
    } else {
      // 提取单个元素
      let value: string = ''

      switch (extract) {
        case 'text':
          value = await page
            .$eval(selector, (el) => el.textContent?.trim() || '')
            .catch(() => '')
          break
        case 'html':
          value = await page
            .$eval(selector, (el) => el.innerHTML.trim())
            .catch(() => '')
          break
        case 'attribute':
          if (!attribute)
            throw new Error('使用attribute提取时必须指定attribute参数')
          value = await page
            .$eval(
              selector,
              (el, attr) => el.getAttribute(attr) || '',
              attribute,
            )
            .catch(() => '')
          // 如果是href属性，将相对链接转换为绝对链接
          if (attribute === 'href' && value) {
            value = this.resolveUrl(value, page.url())
          }
          break
      }

      // 应用转换函数
      if (fieldSelector.transform) {
        return fieldSelector.transform(value)
      }

      return value
    }
  }

  /**
   * 解析CSV行，处理引号内的逗号
   * @param line CSV行字符串
   * @returns 解析后的值数组
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // 转义的引号
          current += '"'
          i += 2
        } else {
          // 开始或结束引号
          inQuotes = !inQuotes
          current += char
          i++
        }
      } else if (char === ',' && !inQuotes) {
        // 字段分隔符
        result.push(current)
        current = ''
        i++
      } else {
        current += char
        i++
      }
    }

    // 添加最后一个字段
    result.push(current)
    return result
  }

  /**
   * 将相对URL转换为绝对URL
   * @param url 要转换的URL
   * @param baseUrl 基础URL
   */
  private resolveUrl(url: string, baseUrl: string): string {
    try {
      // 如果已经是绝对URL，直接返回
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      // 使用URL构造函数将相对URL转换为绝对URL
      return new URL(url, baseUrl).href
    } catch (error) {
      console.warn(`无法解析URL: ${url}, 基础URL: ${baseUrl}`)
      return url // 如果解析失败，返回原始URL
    }
  }

  /**
   * 处理默认值中的占位符
   * @param defaultValue 默认值字符串
   * @param currentUrl 当前页面URL
   * @param configPath 配置文件路径
   */
  private processDefaultValue(
    defaultValue: string,
    currentUrl: string,
    configPath?: string,
  ): string {
    let result = defaultValue

    // 替换{{currentUrl}}占位符
    result = result.replace(/\{\{currentUrl\}\}/g, currentUrl)

    // 替换{{filename}}占位符
    if (configPath && result.includes('{{filename}}')) {
      const filename = path.basename(configPath, '.json').replace('-config', '')
      result = result.replace(/\{\{filename\}\}/g, filename)
    }

    return result
  }

  /**
   * 保存结果
   */
  /**
   * 增量保存单个结果项
   * @param item 要保存的结果项
   */
  private async saveItemIncremental(item: CrawlItem): Promise<void> {
    const { type, path: outputPath } = this.config.output
    const dirPath = path.dirname(outputPath)

    // 确保输出目录存在
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    try {
      switch (type) {
        case 'json':
          // 读取现有文件内容
          let existingData: CrawlItem[] = []
          if (fs.existsSync(outputPath)) {
            try {
              const fileContent = fs.readFileSync(outputPath, 'utf8')
              existingData = JSON.parse(fileContent)
            } catch (error) {
              console.warn('读取现有文件失败，将创建新文件:', error)
            }
          }

          // 检查是否存在重复项（基于URL）
          const existingIndex = existingData.findIndex(
            (existingItem) => existingItem.url === item.url,
          )

          if (existingIndex !== -1) {
            // 覆盖现有项目
            existingData[existingIndex] = item
          } else {
            // 添加新项目
            existingData.push(item)
          }

          // 写入更新后的数据
          fs.writeFileSync(
            outputPath,
            JSON.stringify(existingData, null, 2),
            'utf8',
          )
          break
        case 'csv':
          // CSV去重写入
          const headers = ['url', 'timestamp', ...Object.keys(item.data)]

          let existingCsvData: CrawlItem[] = []

          // 读取现有CSV文件并解析为对象数组
          if (fs.existsSync(outputPath)) {
            try {
              const fileContent = fs.readFileSync(outputPath, 'utf8')
              const lines = fileContent.trim().split('\n')

              if (lines.length > 1) {
                // 有数据行
                const headerLine = lines[0]
                const dataLines = lines.slice(1)

                for (const line of dataLines) {
                  const values = this.parseCsvLine(line)
                  if (values.length >= 2) {
                    const url = values[0].replace(/^"|"$/g, '') // 移除引号
                    const timestamp = parseInt(values[1].replace(/^"|"$/g, ''))

                    // 重构数据对象
                    const data: Record<string, any> = {}
                    for (
                      let i = 2;
                      i < values.length &&
                      i - 2 < Object.keys(item.data).length;
                      i++
                    ) {
                      const key = Object.keys(item.data)[i - 2]
                      let value = values[i]
                        .replace(/^"|"$/g, '')
                        .replace(/""/g, '"')

                      // 尝试解析JSON对象
                      try {
                        if (value.startsWith('{') || value.startsWith('[')) {
                          value = JSON.parse(value)
                        }
                      } catch {
                        // 保持原始字符串值
                      }

                      data[key] = value
                    }

                    existingCsvData.push({ url, timestamp, data })
                  }
                }
              }
            } catch (error) {
              console.warn('读取现有CSV文件失败，将创建新文件:', error)
            }
          }

          // 检查是否存在重复项（基于URL）
          const existingCsvIndex = existingCsvData.findIndex(
            (existingItem) => existingItem.url === item.url,
          )

          if (existingCsvIndex !== -1) {
            // 覆盖现有项目
            existingCsvData[existingCsvIndex] = item
          } else {
            // 添加新项目
            existingCsvData.push(item)
          }

          // 重写整个CSV文件
          let csvContent = headers.join(',') + '\n'

          for (const csvItem of existingCsvData) {
            const row = [csvItem.url, csvItem.timestamp.toString()]
            for (const key of Object.keys(item.data)) {
              let value = csvItem.data[key]
              if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value)
              }
              row.push(
                value !== null && value !== undefined ? String(value) : '',
              )
            }

            csvContent +=
              row
                .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                .join(',') + '\n'
          }

          // 写入文件
          fs.writeFileSync(outputPath, csvContent, 'utf8')
          break
        default:
          throw new Error(`不支持的输出类型: ${type}`)
      }

      this.status.itemsSaved++
    } catch (error) {
      console.error('增量保存失败:', error)
      throw error
    }
  }

  private async saveResults(): Promise<void> {
    if (this.results.length === 0) {
      // console.log('没有结果可保存');
      return
    }

    const { type, path: outputPath } = this.config.output
    const dirPath = path.dirname(outputPath)

    // 确保输出目录存在
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    try {
      switch (type) {
        case 'json':
          fs.writeFileSync(
            outputPath,
            JSON.stringify(this.results, null, 2),
            'utf8',
          )
          break
        case 'csv':
          // 简单的CSV导出实现
          const headers = [
            'url',
            'timestamp',
            ...Object.keys(this.results[0].data),
          ]
          const rows = this.results.map((item) => {
            const row = [item.url, item.timestamp.toString()]
            for (const key of Object.keys(this.results[0].data)) {
              let value = item.data[key]
              // 处理数组和对象
              if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value)
              }
              row.push(
                value !== null && value !== undefined ? String(value) : '',
              )
            }
            return row
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(',')
          })

          const csv = [headers.join(','), ...rows].join('\n')
          fs.writeFileSync(outputPath, csv, 'utf8')
          break
        default:
          throw new Error(`不支持的输出类型: ${type}`)
      }

      this.status.itemsSaved = this.results.length
      // console.log(`已保存 ${this.results.length} 个结果到 ${outputPath}`);
    } catch (error) {
      console.error('保存结果失败:', error)
      throw error
    }
  }

  /**
   * 下载PDF文件
   * @param pdfUrl PDF文件URL
   * @param filename 文件名
   */
  private async downloadPDF(pdfUrl: string, filename: string): Promise<void> {
    if (!this.config.downloadPDF) return

    const { downloadPath, fileExtension } = this.config.downloadPDF
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true })
    }

    // 清理文件名，移除非法字符
    const cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_')
    const fullFilename = cleanFilename + fileExtension
    const filePath = path.join(downloadPath, fullFilename)

    // 如果文件已存在，跳过下载
    if (fs.existsSync(filePath)) {
      console.log(`PDF文件已存在，跳过下载: ${fullFilename}`)
      return
    }

    console.log(`开始下载PDF: ${fullFilename}`)

    return new Promise((resolve, reject) => {
      const protocol = pdfUrl.startsWith('https:') ? https : http
      
      const request = protocol.get(pdfUrl, (response) => {
        if (response.statusCode === 200) {
          const fileStream = fs.createWriteStream(filePath)
          response.pipe(fileStream)
          
          fileStream.on('finish', () => {
            fileStream.close()
            console.log(`PDF下载完成: ${fullFilename}`)
            resolve()
          })
          
          fileStream.on('error', (error) => {
            fs.unlink(filePath, () => {}) // 删除不完整的文件
            reject(error)
          })
        } else {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        }
      })
      
      request.on('error', (error) => {
        reject(error)
      })
      
      request.setTimeout(30000, () => {
        request.destroy()
        reject(new Error('下载超时'))
      })
    })
  }

  /**
   * 获取爬虫状态
   */
  getStatus(): CrawlerStatus {
    // 更新运行时间
    if (this.status.state === 'running') {
      this.status.runningTime = Date.now() - this.status.startTime
    }
    return { ...this.status }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.context = null
      // console.log('浏览器已关闭');
    }
  }
}
