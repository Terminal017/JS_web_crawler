#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const batch_runner_1 = require("./batch-runner");
/**
 * 批量运行主入口
 * 运行Index文件夹中所有子文件夹的爬虫配置
 */
async function main() {
    try {
        const indexPath = process.argv[2] || './Index';
        const batchRunner = new batch_runner_1.BatchRunner(indexPath);
        await batchRunner.runAll();
    }
    catch (error) {
        console.error('批量运行失败:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
// 运行主函数
if (require.main === module) {
    main();
}
//# sourceMappingURL=batch-main.js.map