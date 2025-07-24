export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  provider: 'gps' | 'network' | 'passive';
}

export interface LocationServiceOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  updateInterval?: number; // milliseconds between location updates
}

export class LocationService {
  private watchId: number | null = null;
  private isTracking: boolean = false;
  private lastLocation: LocationData | null = null;
  private onLocationUpdate: ((location: LocationData) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  private readonly defaultOptions: Required<LocationServiceOptions> = {
    enableHighAccuracy: true,
    timeout: 10000, // 10 seconds
    maximumAge: 30000, // 30 seconds
    updateInterval: 30000, // 30 seconds
  };

  /**
   * Check if geolocation is supported by the browser
   */
  public isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Start continuous location tracking
   */
  public async startTracking(
    onLocationUpdate: (location: LocationData) => void,
    onError: (error: string) => void,
    options: LocationServiceOptions = {},
  ): Promise<void> {
    if (!this.isSupported()) {
      onError('Geolocation is not supported by this browser');
      return;
    }

    if (this.isTracking) {
      console.warn('Location tracking is already active');
      return;
    }

    const finalOptions = { ...this.defaultOptions, ...options };
    this.onLocationUpdate = onLocationUpdate;
    this.onError = onError;

    console.log('🗺️ Starting location tracking with options:', finalOptions);

    try {
      // Get initial position
      await this.getCurrentPosition(finalOptions);

      // Start continuous tracking
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handleLocationSuccess(position),
        (error) => this.handleLocationError(error),
        {
          enableHighAccuracy: finalOptions.enableHighAccuracy,
          timeout: finalOptions.timeout,
          maximumAge: finalOptions.maximumAge,
        },
      );

      this.isTracking = true;
      console.log('✅ Location tracking started successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start location tracking';
      onError(errorMessage);
    }
  }

  /**
   * Stop location tracking
   */
  public stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isTracking = false;
    this.onLocationUpdate = null;
    this.onError = null;

    console.log('🛑 Location tracking stopped');
  }

  /**
   * Get the last known location
   */
  public getLastLocation(): LocationData | null {
    return this.lastLocation;
  }

  /**
   * Check if currently tracking location
   */
  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Get current position once (not continuous)
   */
  private getCurrentPosition(options: Required<LocationServiceOptions>): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = this.processPosition(position);
          resolve(locationData);
        },
        (error) => {
          reject(new Error(this.getErrorMessage(error)));
        },
        {
          enableHighAccuracy: options.enableHighAccuracy,
          timeout: options.timeout,
          maximumAge: options.maximumAge,
        },
      );
    });
  }

  /**
   * Handle successful location update
   */
  private handleLocationSuccess(position: GeolocationPosition): void {
    const locationData = this.processPosition(position);

    this.lastLocation = locationData;

    if (this.onLocationUpdate) {
      this.onLocationUpdate(locationData);
    }

    console.log('📍 Location updated:', {
      lat: locationData.latitude.toFixed(6),
      lng: locationData.longitude.toFixed(6),
      accuracy: `${locationData.accuracy}m`,
      provider: locationData.provider,
    });
  }

  /**
   * Handle location error
   */
  private handleLocationError(error: GeolocationPositionError): void {
    const errorMessage = this.getErrorMessage(error);
    console.error('❌ Location error:', errorMessage);

    if (this.onError) {
      this.onError(errorMessage);
    }
  }

  /**
   * Process GeolocationPosition into LocationData
   */
  private processPosition(position: GeolocationPosition): LocationData {
    // Determine provider based on accuracy
    let provider: 'gps' | 'network' | 'passive' = 'passive';
    if (position.coords.accuracy <= 10) {
      provider = 'gps';
    } else if (position.coords.accuracy <= 100) {
      provider = 'network';
    }

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Math.round(position.coords.accuracy),
      timestamp: position.timestamp,
      provider,
    };
  }

  /**
   * Convert GeolocationPositionError to user-friendly message
   */
  private getErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location access denied by user';
      case error.POSITION_UNAVAILABLE:
        return 'Location information is unavailable';
      case error.TIMEOUT:
        return 'Location request timed out';
      default:
        return 'An unknown error occurred while retrieving location';
    }
  }
}

// Export a singleton instance
export const locationService = new LocationService();
