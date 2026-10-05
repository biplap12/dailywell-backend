import { isDatabaseHealthy } from '../../config/database';
import { isRedisHealthy } from '../../config/redis';

export const healthService = {
  async status() {
    const database = isDatabaseHealthy() ? 'healthy' : 'unhealthy';
    const redis = await isRedisHealthy();
    return {
      api: 'healthy',
      database,
      redis,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      ready: database === 'healthy' && redis !== 'unhealthy',
    };
  },
};
