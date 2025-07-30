/**
 * 批量运行器 - 依次执行Index文件夹中所有子文件夹的爬虫配置
 */
export declare class BatchRunner {
    private indexPath;
    private results;
    constructor(indexPath?: string);
    /**
     * 运行所有文件夹中的配置文件
     */
    runAll(): Promise<void>;
    /**
     * 获取Index文件夹下的所有子文件夹
     */
    private getSubFolders;
    /**
     * 运行指定文件夹中的所有配置文件
     */
    private runFolder;
    /**
     * 获取文件夹中的所有配置文件
     */
    private getConfigFiles;
    /**
     * 运行单个配置文件
     */
    private runSingleConfig;
    /**
     * 打印总结报告
     */
    private printSummary;
}
