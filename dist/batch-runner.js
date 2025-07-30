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
exports.BatchRunner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crawler_1 = require("./crawler");
/**
 * 批量运行器 - 依次执行Index文件夹中所有子文件夹的爬虫配置
 */
class BatchRunner {
    constructor(indexPath = './Index') {
        this.results = [];
        this.indexPath = path.resolve(indexPath);
    }
    /**
     * 运行所有文件夹中的配置文件
     */
    async runAll() {
        console.log(`开始批量运行Index文件夹中的所有爬虫任务...`);
        console.log(`Index路径: ${this.indexPath}`);
        if (!fs.existsSync(this.indexPath)) {
            throw new Error(`Index文件夹不存在: ${this.indexPath}`);
        }
        // 获取所有子文件夹
        const subFolders = this.getSubFolders();
        console.log(`找到 ${subFolders.length} 个子文件夹: ${subFolders.join(', ')}`);
        // 依次处理每个文件夹
        for (const folder of subFolders) {
            await this.runFolder(folder);
        }
        // 输出总结报告
        this.printSummary();
    }
    /**
     * 获取Index文件夹下的所有子文件夹
     */
    getSubFolders() {
        const items = fs.readdirSync(this.indexPath);
        return items.filter(item => {
            const itemPath = path.join(this.indexPath, item);
            return fs.statSync(itemPath).isDirectory();
        }).sort();
    }
    /**
     * 运行指定文件夹中的所有配置文件
     */
    async runFolder(folderName) {
        const folderPath = path.join(this.indexPath, folderName);
        console.log(`\n=== 开始处理文件夹: ${folderName} ===`);
        // 获取文件夹中的所有配置文件
        const configFiles = this.getConfigFiles(folderPath);
        console.log(`找到 ${configFiles.length} 个配置文件`);
        const result = {
            folder: folderName,
            configs: configFiles,
            success: 0,
            failed: 0
        };
        // 依次运行每个配置文件
        for (const configFile of configFiles) {
            try {
                console.log(`\n--- 运行配置: ${configFile} ---`);
                await this.runSingleConfig(configFile);
                result.success++;
                console.log(`SUCCESS: ${configFile} 运行成功`);
            }
            catch (error) {
                result.failed++;
                console.error(`FAILED: ${configFile} 运行失败:`, error instanceof Error ? error.message : error);
            }
        }
        this.results.push(result);
        console.log(`=== ${folderName} 处理完成: 成功 ${result.success}, 失败 ${result.failed} ===`);
    }
    /**
     * 获取文件夹中的所有配置文件
     */
    getConfigFiles(folderPath) {
        const files = fs.readdirSync(folderPath);
        return files
            .filter(file => file.endsWith('-config.json') || file.endsWith('.json'))
            .map(file => path.join(folderPath, file))
            .sort();
    }
    /**
     * 运行单个配置文件
     */
    async runSingleConfig(configPath) {
        // 读取配置文件
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        // 创建爬虫实例并运行
        const crawler = new crawler_1.Crawler(config, configPath);
        try {
            await crawler.initialize();
            await crawler.start();
        }
        finally {
            await crawler.close();
        }
    }
    /**
     * 打印总结报告
     */
    printSummary() {
        console.log(`\n\n=== 批量运行总结报告 ===`);
        console.log(`处理文件夹数量: ${this.results.length}`);
        let totalConfigs = 0;
        let totalSuccess = 0;
        let totalFailed = 0;
        this.results.forEach(result => {
            totalConfigs += result.configs.length;
            totalSuccess += result.success;
            totalFailed += result.failed;
            console.log(`\n[${result.folder}]:`);
            console.log(`   配置文件: ${result.configs.length} 个`);
            console.log(`   成功: ${result.success} 个`);
            console.log(`   失败: ${result.failed} 个`);
        });
        console.log(`\n总计:`);
        console.log(`   配置文件: ${totalConfigs} 个`);
        console.log(`   成功: ${totalSuccess} 个`);
        console.log(`   失败: ${totalFailed} 个`);
        console.log(`   成功率: ${totalConfigs > 0 ? ((totalSuccess / totalConfigs) * 100).toFixed(1) : 0}%`);
        if (totalFailed === 0) {
            console.log(`\n所有任务都成功完成！`);
        }
        else {
            console.log(`\nWARNING: 有 ${totalFailed} 个任务失败，请检查错误信息`);
        }
    }
}
exports.BatchRunner = BatchRunner;
/**
 * 优雅退出处理
 */
process.on('SIGINT', () => {
    console.log('\n\n接收到中断信号，正在优雅退出...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n\n接收到终止信号，正在优雅退出...');
    process.exit(0);
});
//# sourceMappingURL=batch-runner.js.map