import { initializeLogging, LoggerFactory, createDefaultConfig } from './logging';
import { startApplication, serviceLifecycleManager } from './services';
import { startMonitoring, getMonitoringService } from './monitoring';
import { errorHandler, ConsoleErrorReporter, FileErrorReporter } from './errors';

export interface BootstrapConfig {
  environment: string;
  logLevel: string;
  enableMonitoring: boolean;
  enableErrorReporting: boolean;
  dataDir: string;
  logDir: string;
}

export class ApplicationBootstrap {
  private config: BootstrapConfig;
  private isInitialized = false;

  constructor(config: Partial<BootstrapConfig> = {}) {
    this.config = {
      environment: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
      enableErrorReporting: process.env.ENABLE_ERROR_REPORTING !== 'false',
      dataDir: process.env.DATA_DIR || './data',
      logDir: process.env.LOG_DIR || './logs',
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 Application already initialized');
      return;
    }

    console.log('🚀 Starting application initialization...');

    try {
      // 1. Initialize logging system
      await this.initializeLogging();

      // 2. Initialize error handling
      await this.initializeErrorHandling();

      // 3. Initialize services
      await this.initializeServices();

      // 4. Initialize monitoring
      await this.initializeMonitoring();

      // 5. Set up graceful shutdown
      this.setupGracefulShutdown();

      this.isInitialized = true;
      console.log('✅ Application initialization completed successfully');

      // Log system status
      await this.logSystemStatus();
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.log('🔄 Application not initialized');
      return;
    }

    console.log('🛑 Starting application shutdown...');

    try {
      // Stop monitoring
      if (this.config.enableMonitoring) {
        const monitoringService = getMonitoringService();
        await monitoringService.stop();
        await monitoringService.destroy();
      }

      // Stop services
      await serviceLifecycleManager.shutdown();

      // Flush logs
      const factory = LoggerFactory.getInstance();
      await factory.flushAll();
      await factory.closeAll();

      this.isInitialized = false;
      console.log('✅ Application shutdown completed');
    } catch (error) {
      console.error('❌ Application shutdown failed:', error);
      throw error;
    }
  }

  private async initializeLogging(): Promise<void> {
    console.log('📝 Initializing logging system...');

    const factory = initializeLogging(this.config.environment);
    const logger = factory.getLogger('bootstrap');

    logger.info('Logging system initialized', {
      environment: this.config.environment,
      logLevel: this.config.logLevel,
    });
  }

  private async initializeErrorHandling(): Promise<void> {
    console.log('🚨 Initializing error handling...');

    if (this.config.enableErrorReporting) {
      // Add console error reporter for development
      if (this.config.environment === 'development') {
        errorHandler.addReporter(async (error) => {
          const reporter = new ConsoleErrorReporter({
            enabled: true,
            environment: this.config.environment,
            version: process.env.APP_VERSION || '1.0.0',
          });
          await reporter.report(error);
        });
      }

      // Add file error reporter for production
      if (this.config.environment === 'production') {
        errorHandler.addReporter(async (error) => {
          const reporter = new FileErrorReporter({
            enabled: true,
            environment: this.config.environment,
            version: process.env.APP_VERSION || '1.0.0',
            logFile: `${this.config.logDir}/errors.log`,
          });
          await reporter.report(error);
        });
      }
    }

    console.log('✅ Error handling initialized');
  }

  private async initializeServices(): Promise<void> {
    console.log('⚙️ Initializing services...');

    await startApplication();

    console.log('✅ Services initialized');
  }

  private async initializeMonitoring(): Promise<void> {
    if (!this.config.enableMonitoring) {
      console.log('📊 Monitoring disabled');
      return;
    }

    console.log('📊 Initializing monitoring...');

    await startMonitoring();

    console.log('✅ Monitoring initialized');
  }

  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
      
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        console.error('❌ Graceful shutdown failed:', error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught exception:', error);
      
      try {
        await errorHandler.handleError(error);
        await this.shutdown();
      } catch (shutdownError) {
        console.error('❌ Failed to handle uncaught exception:', shutdownError);
      }
      
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('💥 Unhandled promise rejection:', reason);
      
      try {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        await errorHandler.handleError(error);
        await this.shutdown();
      } catch (shutdownError) {
        console.error('❌ Failed to handle unhandled rejection:', shutdownError);
      }
      
      process.exit(1);
    });

    console.log('🛡️ Graceful shutdown handlers registered');
  }

  private async logSystemStatus(): Promise<void> {
    try {
      const factory = LoggerFactory.getInstance();
      const logger = factory.getLogger('system');

      // Log service status
      const serviceStatus = await serviceLifecycleManager.getDetailedStatus();
      logger.info('System status', {
        services: serviceStatus.services.healthy ? 'healthy' : 'unhealthy',
        serviceCount: Object.keys(serviceStatus.services.services).length,
        uptime: serviceStatus.lifecycle.uptime,
        environment: this.config.environment,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      });

      // Log monitoring status if enabled
      if (this.config.enableMonitoring) {
        const monitoringService = getMonitoringService();
        const monitoringStatus = monitoringService.getStatus();
        logger.info('Monitoring status', monitoringStatus);
      }
    } catch (error) {
      console.error('Failed to log system status:', error);
    }
  }

  // Health check for the entire application
  async healthCheck(): Promise<{
    healthy: boolean;
    services: any;
    monitoring?: any;
    uptime: number;
    timestamp: string;
  }> {
    const serviceStatus = await serviceLifecycleManager.getDetailedStatus();
    
    const result = {
      healthy: serviceStatus.services.healthy,
      services: serviceStatus.services,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    if (this.config.enableMonitoring) {
      const monitoringService = getMonitoringService();
      (result as any).monitoring = monitoringService.getStatus();
    }

    return result;
  }

  // Get application metrics
  async getMetrics(): Promise<any> {
    if (!this.config.enableMonitoring) {
      return { error: 'Monitoring not enabled' };
    }

    const monitoringService = getMonitoringService();
    return await monitoringService.getPerformanceMetrics();
  }

  // Configuration getters
  getConfig(): BootstrapConfig {
    return { ...this.config };
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const applicationBootstrap = new ApplicationBootstrap();

// Convenience functions
export async function initializeApplication(config?: Partial<BootstrapConfig>): Promise<void> {
  if (config) {
    const bootstrap = new ApplicationBootstrap(config);
    await bootstrap.initialize();
  } else {
    await applicationBootstrap.initialize();
  }
}

export async function shutdownApplication(): Promise<void> {
  await applicationBootstrap.shutdown();
}

export async function getApplicationHealth(): Promise<any> {
  return await applicationBootstrap.healthCheck();
}

export async function getApplicationMetrics(): Promise<any> {
  return await applicationBootstrap.getMetrics();
}
