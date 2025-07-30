/**
 * Dependency Injection Container
 * 
 * Provides a simple, type-safe dependency injection container following SOLID principles.
 * Replaces the singleton RepositoryFactory pattern with proper IoC.
 */

type Constructor<T = {}> = new (...args: any[]) => T;
type Factory<T> = () => T;
type ServiceToken<T> = string | symbol | Constructor<T>;

interface ServiceRegistration<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

export class DIContainer {
  private services = new Map<ServiceToken<any>, ServiceRegistration<any>>();

  /**
   * Register a service with the container
   */
  register<T>(
    token: ServiceToken<T>,
    factory: Factory<T>,
    options: { singleton?: boolean } = { singleton: true }
  ): void {
    this.services.set(token, {
      factory,
      singleton: options.singleton ?? true,
    });
  }

  /**
   * Register a class constructor with automatic dependency resolution
   */
  registerClass<T>(
    token: ServiceToken<T>,
    constructor: Constructor<T>,
    dependencies: ServiceToken<any>[] = [],
    options: { singleton?: boolean } = { singleton: true }
  ): void {
    const factory = () => {
      const deps = dependencies.map(dep => this.resolve(dep));
      return new constructor(...deps);
    };

    this.register(token, factory, options);
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(token: ServiceToken<T>, instance: T): void {
    this.services.set(token, {
      factory: () => instance,
      singleton: true,
      instance,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: ServiceToken<T>): T {
    const registration = this.services.get(token);
    
    if (!registration) {
      throw new Error(`Service not registered: ${String(token)}`);
    }

    if (registration.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      return registration.instance;
    }

    return registration.factory();
  }

  /**
   * Check if a service is registered
   */
  has<T>(token: ServiceToken<T>): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Create a child container that inherits from this one
   */
  createChild(): DIContainer {
    const child = new DIContainer();
    // Copy parent registrations
    this.services.forEach((registration, token) => {
      child.services.set(token, { ...registration });
    });
    return child;
  }
}

// Service tokens for type safety
export const TOKENS = {
  // Database
  DATABASE_CLIENT: Symbol('DatabaseClient'),
  
  // Repositories
  AUDIO_REPOSITORY: Symbol('AudioRepository'),
  AUDIO_STATS_REPOSITORY: Symbol('AudioStatsRepository'),
  TRANSCRIPTION_REPOSITORY: Symbol('TranscriptionRepository'),
  SUMMARIZATION_REPOSITORY: Symbol('SummarizationRepository'),
  SUMMARIZATION_TEMPLATE_REPOSITORY: Symbol('SummarizationTemplateRepository'),
  
  // Services
  AUDIO_SERVICE: Symbol('AudioService'),
  TRANSCRIPTION_SERVICE: Symbol('TranscriptionService'),
  VALIDATION_SERVICE: Symbol('ValidationService'),
  ERROR_HANDLING_SERVICE: Symbol('ErrorHandlingService'),
} as const;

// Global container instance
export const container = new DIContainer();