import type { IService, IServiceRegistry, ServiceEvent } from './interfaces';

export class ServiceRegistry implements IServiceRegistry {
  private services: Map<string, IService> = new Map();
  private eventHandlers: Map<string, Array<(event: ServiceEvent) => void>> = new Map();
  private initializationOrder: string[] = [];

  register<T extends IService>(name: string, service: T): void {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this.services.set(name, service);
    this.initializationOrder.push(name);
    
    this.emit({
      type: 'initialized',
      service: name,
      timestamp: new Date(),
      data: { registered: true }
    });

    console.log(`📋 Service registered: ${name}`);
  }

  resolve<T extends IService>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }
    return service as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  unregister(name: string): void {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Destroy the service if it has a destroy method
    if (service.destroy) {
      service.destroy().catch(error => {
        console.error(`Error destroying service '${name}':`, error);
      });
    }

    this.services.delete(name);
    this.initializationOrder = this.initializationOrder.filter(s => s !== name);

    this.emit({
      type: 'destroyed',
      service: name,
      timestamp: new Date(),
      data: { unregistered: true }
    });

    console.log(`🗑️ Service unregistered: ${name}`);
  }

  getAll(): Map<string, IService> {
    return new Map(this.services);
  }

  async initializeAll(): Promise<void> {
    console.log('🚀 Initializing all services...');
    
    const errors: Array<{ service: string; error: any }> = [];

    for (const serviceName of this.initializationOrder) {
      const service = this.services.get(serviceName);
      if (!service) continue;

      try {
        if (service.initialize) {
          console.log(`⚡ Initializing service: ${serviceName}`);
          await service.initialize();
          console.log(`✅ Service initialized: ${serviceName}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize service '${serviceName}':`, error);
        errors.push({ service: serviceName, error });
        
        this.emit({
          type: 'error',
          service: serviceName,
          timestamp: new Date(),
          data: { error, phase: 'initialization' }
        });
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Failed to initialize ${errors.length} service(s): ${errors.map(e => e.service).join(', ')}`;
      throw new Error(errorMessage);
    }

    console.log('✅ All services initialized successfully');
  }

  async destroyAll(): Promise<void> {
    console.log('🛑 Destroying all services...');
    
    const errors: Array<{ service: string; error: any }> = [];
    
    // Destroy in reverse order
    const destroyOrder = [...this.initializationOrder].reverse();

    for (const serviceName of destroyOrder) {
      const service = this.services.get(serviceName);
      if (!service) continue;

      try {
        if (service.destroy) {
          console.log(`🔄 Destroying service: ${serviceName}`);
          await service.destroy();
          console.log(`✅ Service destroyed: ${serviceName}`);
        }
      } catch (error) {
        console.error(`❌ Failed to destroy service '${serviceName}':`, error);
        errors.push({ service: serviceName, error });
        
        this.emit({
          type: 'error',
          service: serviceName,
          timestamp: new Date(),
          data: { error, phase: 'destruction' }
        });
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Failed to destroy ${errors.length} service(s): ${errors.map(e => e.service).join(', ')}`;
      console.warn(errorMessage);
    }

    console.log('✅ All services destroyed');
  }

  on(event: string, handler: (event: ServiceEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: (event: ServiceEvent) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: ServiceEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for '${event.type}':`, error);
        }
      });
    }
  }

  // Utility methods
  getServiceStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, service] of Array.from(this.services.entries())) {
      status[name] = {
        name: service.name,
        initialized: (service as any).initialized || false,
        destroyed: (service as any).destroyed || false,
      };
    }
    
    return status;
  }

  getInitializationOrder(): string[] {
    return [...this.initializationOrder];
  }

  // Dependency resolution with circular dependency detection
  resolveDependencies(serviceName: string, visited: Set<string> = new Set()): IService[] {
    if (visited.has(serviceName)) {
      throw new Error(`Circular dependency detected: ${Array.from(visited).join(' -> ')} -> ${serviceName}`);
    }

    visited.add(serviceName);
    const dependencies: IService[] = [];
    
    // This is a simplified version - in a real implementation,
    // you'd analyze service dependencies and resolve them in order
    const service = this.services.get(serviceName);
    if (service) {
      dependencies.push(service);
    }

    visited.delete(serviceName);
    return dependencies;
  }

  // Health check for all services
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [name, service] of Array.from(this.services.entries())) {
      try {
        // Check if service has a health check method
        if ('healthCheck' in service && typeof (service as any).healthCheck === 'function') {
          health[name] = await (service as any).healthCheck();
        } else {
          // Basic health check - service is healthy if initialized and not destroyed
          health[name] = (service as any).initialized && !(service as any).destroyed;
        }
      } catch (error) {
        console.error(`Health check failed for service '${name}':`, error);
        health[name] = false;
      }
    }
    
    return health;
  }
}

// Singleton instance
export const serviceRegistry = new ServiceRegistry();

// Service decorator for automatic registration
export function Service(name: string) {
  return function <T extends new (...args: any[]) => IService>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        serviceRegistry.register(name, this);
      }
    };
  };
}

// Dependency injection decorator
export function Inject(serviceName: string) {
  return function (target: any, propertyKey: string) {
    Object.defineProperty(target, propertyKey, {
      get: () => serviceRegistry.resolve(serviceName),
      enumerable: true,
      configurable: true,
    });
  };
}
