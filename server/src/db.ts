import mongoose from 'mongoose';

/**
 * 连接 MongoDB，失败时返回 false 由调用方回退到内存模式。
 * 这样即使本机没有安装 MongoDB，也能直接运行演示。
 */
export async function connectMongo(uri: string): Promise<boolean> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    return mongoose.connection.readyState === 1;
  } catch (error) {
    console.warn(`[mongo] 连接失败，已切换为内存模式：${(error as Error).message}`);
    return false;
  }
}
