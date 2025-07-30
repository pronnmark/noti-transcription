interface GeocodeResult {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  display_name?: string;
}

interface LocationInfo {
  city: string;
  region?: string;
  country?: string;
  full: string;
}

const GEOCODING_CACHE = new Map<string, LocationInfo>();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export async function getCityFromCoordinates(
  latitude: number,
  longitude: number
): Promise<LocationInfo | null> {
  // Create cache key with rounded coordinates (to avoid cache misses for nearby locations)
  const lat = Math.round(latitude * 1000) / 1000;
  const lng = Math.round(longitude * 1000) / 1000;
  const cacheKey = `${lat},${lng}`;

  // Check cache first
  if (GEOCODING_CACHE.has(cacheKey)) {
    return GEOCODING_CACHE.get(cacheKey)!;
  }

  try {
    // Use Nominatim reverse geocoding service (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`,
      {
        headers: {
          'User-Agent': 'NotificationApp/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      console.warn('Geocoding service unavailable:', response.status);
      return null;
    }

    const data: GeocodeResult = await response.json();

    // Extract city name (try different fields in order of preference)
    const city = data.city || data.town || data.village || data.county || 'Unknown Location';
    const region = data.state;
    const country = data.country;

    const locationInfo: LocationInfo = {
      city,
      region,
      country,
      full: data.display_name || `${city}${region ? `, ${region}` : ''}${country ? `, ${country}` : ''}`,
    };

    // Cache the result
    GEOCODING_CACHE.set(cacheKey, locationInfo);

    // Clean up old cache entries periodically
    if (GEOCODING_CACHE.size > 100) {
      // Simple cleanup: clear half the cache when it gets too large
      const entries = Array.from(GEOCODING_CACHE.entries());
      entries.slice(0, 50).forEach(([key]) => GEOCODING_CACHE.delete(key));
    }

    return locationInfo;
  } catch (error) {
    console.warn('Failed to reverse geocode coordinates:', error);
    return null;
  }
}

export function formatLocationDisplay(locationInfo: LocationInfo): string {
  if (locationInfo.city === 'Unknown Location') {
    return locationInfo.city;
  }

  // Format as "City, Region" or just "City" if no region
  if (locationInfo.region && locationInfo.region !== locationInfo.city) {
    return `${locationInfo.city}, ${locationInfo.region}`;
  }

  return locationInfo.city;
}