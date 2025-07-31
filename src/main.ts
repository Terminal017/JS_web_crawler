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
  const crawler = new Crawler(config, configPath);
  
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
 * 获取目录下所有JSON配置文件（递归查找子文件夹）
 * @param dirPath 目录路径
 */
function getConfigFiles(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      console.error(`路径不存在: ${dirPath}`);
      process.exit(1);
    }
    
    if (!fs.statSync(dirPath).isDirectory()) {
      // 如果是文件而不是目录，直接返回该文件
      return [dirPath];
    }
    
    const configFiles: string[] = [];
    
    // 递归查找所有子文件夹中的JSON配置文件
    function findConfigsRecursively(currentPath: string) {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          // 如果是目录，递归查找
          findConfigsRecursively(itemPath);
        } else if (item.endsWith('.json') || item.endsWith('-config.json')) {
          // 如果是JSON配置文件，添加到列表
          configFiles.push(itemPath);
        }
      }
    }
    
    findConfigsRecursively(dirPath);
    return configFiles.sort(); // 排序确保执行顺序一致
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
  let configPath = './Index';

  // 解析命令行参数
  if (args.length > 0) {
    // 如果有参数，第一个参数作为配置文件路径
    if (args[0] === '--config' && args.length > 1) {
      configPath = args[1];
    } else if (!args[0].startsWith('--')) {
      // 如果第一个参数不是选项，直接作为配置文件路径
      configPath = args[0];
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