import * as fs from 'fs';
import * as path from 'path';
import { Crawler } from './crawler';
import { CrawlerConfig } from './types';

/**
 * 加载配置文件
 * @param configPath 配置文件路径
 */
function loadConfig(configPath: string): CrawlerConfig {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configContent) as CrawlerConfig;
  } catch (error) {
    console.error(`加载配置文件失败: ${error}`);
    process.exit(1);
  }
}

/**
 * 运行单个爬虫任务
 * @param configPath 配置文件路径
 */
async function runCrawler(configPath: string) {
  console.log(`使用配置文件: ${configPath}`);
  
  // 加载配置
  const config = loadConfig(configPath);
  
  // 创建爬虫实例
  const crawler = new Crawler(config);
  
  try {
    // 初始化爬虫
    await crawler.initialize();
    
    // 开始爬取
    const results = await crawler.start();
    
    console.log(`爬取完成，共获取 ${results.length} 条数据`);
    
    // 关闭爬虫
    await crawler.close();
  } catch (error) {
    console.error(`爬虫运行出错 (${path.basename(configPath)}):`, error);
    await crawler.close();
  }
}

/**
 * 获取目录下所有JSON配置文件
 * @param dirPath 目录路径
 */
function getConfigFiles(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      console.error(`目录不存在: ${dirPath}`);
      process.exit(1);
    }
    
    if (!fs.statSync(dirPath).isDirectory()) {
      // 如果是文件而不是目录，直接返回该文件
      return [dirPath];
    }
    
    // 读取目录下所有文件
    const files = fs.readdirSync(dirPath);
    
    // 过滤出JSON文件并转为完整路径
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(dirPath, file));
  } catch (error) {
    console.error(`读取配置文件目录失败: ${error}`);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  let configPath = './config.json';

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
      configPath = args[i + 1];
      i++;
    }
  }

  // 解析为绝对路径
  configPath = path.resolve(process.cwd(), configPath);
  
  // 注册信号处理
  process.on('SIGINT', async () => {
    console.log('\n接收到中断信号，正在优雅退出...');
    process.exit(0);
  });

  // 获取配置文件列表
  const configFiles = getConfigFiles(configPath);
  
  if (configFiles.length === 0) {
    console.error(`未找到任何JSON配置文件: ${configPath}`);
    process.exit(1);
  }
  
  console.log(`找到 ${configFiles.length} 个配置文件，开始依次执行爬虫任务...`);
  
  // 依次执行每个配置文件的爬虫任务
  for (const file of configFiles) {
    await runCrawler(file);
  }
  
  console.log('所有爬虫任务已完成');
}

// 执行主函数
main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});