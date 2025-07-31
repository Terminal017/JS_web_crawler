"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crawler_1 = require("./crawler");
/**
 * 加载配置文件
 * @param configPath 配置文件路径
 */
function loadConfig(configPath) {
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configContent);
    }
    catch (error) {
        console.error(`加载配置文件失败: ${error}`);
        process.exit(1);
    }
}
/**
 * 运行单个爬虫任务
 * @param configPath 配置文件路径
 */
async function runCrawler(configPath) {
    console.log(`使用配置文件: ${configPath}`);
    // 加载配置
    const config = loadConfig(configPath);
    // 创建爬虫实例
    const crawler = new crawler_1.Crawler(config, configPath);
    try {
        // 初始化爬虫
        await crawler.initialize();
        // 开始爬取
        const results = await crawler.start();
        console.log(`爬取完成，共获取 ${results.length} 条数据`);
        // 关闭爬虫
        await crawler.close();
    }
    catch (error) {
        console.error(`爬虫运行出错 (${path.basename(configPath)}):`, error);
        await crawler.close();
    }
}
/**
 * 获取目录下所有JSON配置文件（递归查找子文件夹）
 * @param dirPath 目录路径
 */
function getConfigFiles(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            console.error(`路径不存在: ${dirPath}`);
            process.exit(1);
        }
        if (!fs.statSync(dirPath).isDirectory()) {
            // 如果是文件而不是目录，直接返回该文件
            return [dirPath];
        }
        const configFiles = [];
        // 递归查找所有子文件夹中的JSON配置文件
        function findConfigsRecursively(currentPath) {
            const items = fs.readdirSync(currentPath);
            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    // 如果是目录，递归查找
                    findConfigsRecursively(itemPath);
                }
                else if (item.endsWith('.json') || item.endsWith('-config.json')) {
                    // 如果是JSON配置文件，添加到列表
                    configFiles.push(itemPath);
                }
            }
        }
        findConfigsRecursively(dirPath);
        return configFiles.sort(); // 排序确保执行顺序一致
    }
    catch (error) {
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
        }
        else if (!args[0].startsWith('--')) {
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
//# sourceMappingURL=main.js.map