#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 获取Index文件夹路径
const indexPath = path.join(__dirname, 'Index');

console.log('开始批量运行Index文件夹中的所有爬虫任务...');
console.log(`Index路径: ${indexPath}`);

if (!fs.existsSync(indexPath)) {
    console.error('ERROR: Index文件夹不存在!');
    process.exit(1);
}

// 获取所有子文件夹
const subFolders = fs.readdirSync(indexPath)
    .filter(item => fs.statSync(path.join(indexPath, item)).isDirectory());

console.log(`找到 ${subFolders.length} 个子文件夹: ${subFolders.join(', ')}\n`);

let totalConfigs = 0;
let successCount = 0;
let failCount = 0;
const results = [];

// 遍历每个子文件夹
for (const folder of subFolders) {
    console.log(`=== 开始处理文件夹: ${folder} ===`);
    const folderPath = path.join(indexPath, folder);
    
    // 获取该文件夹下的所有JSON配置文件
    const configFiles = fs.readdirSync(folderPath)
        .filter(file => file.endsWith('.json') || file.endsWith('-config.json'));
    
    console.log(`找到 ${configFiles.length} 个配置文件`);
    totalConfigs += configFiles.length;
    
    // 运行每个配置文件
    for (const configFile of configFiles) {
        const configPath = path.join(folderPath, configFile);
        const relativePath = path.relative(__dirname, configPath);
        
        console.log(`\n--- 运行配置: ${relativePath} ---`);
        
        try {
            // 使用编译后的版本运行
            const command = `node dist/main.js "${relativePath}"`;
            console.log(`执行命令: ${command}`);
            
            const startTime = Date.now();
            execSync(command, { 
                stdio: 'inherit',
                cwd: __dirname,
                timeout: 300000 // 5分钟超时
            });
            const endTime = Date.now();
            
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`SUCCESS: ${configFile} 执行成功 (耗时: ${duration}s)`);
            successCount++;
            results.push({ config: relativePath, status: 'success', duration });
            
        } catch (error) {
            console.error(`FAILED: ${configFile} 执行失败:`, error.message);
            failCount++;
            results.push({ config: relativePath, status: 'failed', error: error.message });
        }
    }
    
    console.log(`=== 文件夹 ${folder} 处理完成 ===\n`);
}

// 输出总结报告
console.log('\n' + '='.repeat(60));
console.log('批量运行总结报告');
console.log('='.repeat(60));
console.log(`总配置文件数: ${totalConfigs}`);
console.log(`成功执行: ${successCount}`);
console.log(`执行失败: ${failCount}`);
console.log(`成功率: ${totalConfigs > 0 ? ((successCount / totalConfigs) * 100).toFixed(1) : 0}%`);

if (results.length > 0) {
    console.log('\n详细结果:');
    results.forEach((result, index) => {
        const status = result.status === 'success' ? '[SUCCESS]' : '[FAILED]';
        const info = result.status === 'success' 
            ? `(${result.duration}s)` 
            : `(${result.error})`;
        console.log(`${index + 1}. ${status} ${result.config} ${info}`);
    });
}

console.log('\n批量运行完成!');
process.exit(failCount > 0 ? 1 : 0);