const fs = require('fs');
const path = require('path');

function monitorProgress() {
    const dataPath = path.join(__dirname, 'data', 'Bill20.json');
    
    if (!fs.existsSync(dataPath)) {
        console.log('数据文件尚未生成...');
        return;
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const total = data.length;
        const withTitle = data.filter(item => item.data.title !== null).length;
        const withPDF = data.filter(item => item.data.PDF !== null).length;
        const withLongTitle = data.filter(item => item.data.content.longTitle !== null).length;
        
        console.clear();
        console.log('='.repeat(60));
        console.log('📊 菲律宾参议院法案爬虫进度监控');
        console.log('='.repeat(60));
        console.log(`📈 总进度: ${total}/300 (${(total/300*100).toFixed(1)}%)`);
        console.log(`📝 有标题: ${withTitle}/${total} (${(withTitle/total*100).toFixed(1)}%)`);
        console.log(`📄 有PDF: ${withPDF}/${total} (${(withPDF/total*100).toFixed(1)}%)`);
        console.log(`📋 有长标题: ${withLongTitle}/${total} (${(withLongTitle/total*100).toFixed(1)}%)`);
        console.log('='.repeat(60));
        
        if (total > 0) {
            console.log('\n🔍 最新处理的法案:');
            const latest = data[data.length - 1];
            console.log(`   ID: ${latest.data.id}`);
            console.log(`   标题: ${latest.data.title || '无'}`);
            console.log(`   PDF: ${latest.data.PDF ? '有' : '无'}`);
            console.log(`   时间: ${new Date(latest.timestamp).toLocaleString()}`);
        }
        
        if (withTitle > 0) {
            console.log('\n📚 有效法案示例:');
            const validBills = data.filter(item => item.data.title !== null).slice(0, 3);
            validBills.forEach(bill => {
                console.log(`   • ${bill.data.id}: ${bill.data.title}`);
            });
        }
        
        console.log(`\n⏰ 最后更新: ${new Date().toLocaleString()}`);
        console.log('按 Ctrl+C 退出监控\n');
        
    } catch (error) {
        console.log(`读取数据文件出错: ${error.message}`);
    }
}

// 每5秒更新一次
setInterval(monitorProgress, 5000);
monitorProgress(); // 立即执行一次

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n\n👋 监控已停止');
    process.exit(0);
});