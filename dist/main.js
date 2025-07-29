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
    console.log(`使用配置文件: ${configPath}`);
    // 加载配置
    const config = loadConfig(configPath);
    // 创建爬虫实例
    const crawler = new crawler_1.Crawler(config);
    // 注册信号处理
    process.on('SIGINT', async () => {
        console.log('\n接收到中断信号，正在优雅退出...');
        await crawler.close();
        process.exit(0);
    });
    try {
        // 初始化爬虫
        await crawler.initialize();
        // 开始爬取
        const results = await crawler.start();
        console.log(`爬取完成，共获取 ${results.length} 条数据`);
    }
    catch (error) {
        console.error('爬虫运行出错:', error);
        process.exit(1);
    }
}
// 执行主函数
main().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map