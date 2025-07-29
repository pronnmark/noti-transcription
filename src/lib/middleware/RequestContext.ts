import { NextRequest } from 'next/server';
import { RequestContext, MiddlewareConfig } from './types';
// Simple logger interface
interface Logger {
  info: (msg: string, ...args: any[]) => void;
  warn: (msg: string, ...args: any[]) => void;
  error: (msg: string, ...args: any[]) => void;
  debug: (msg: string, ...args: any[]) => void;
  fatal: (msg: string, ...args: any[]) => void;
}
import { v4 as uuidv4 } from 'uuid';

export class RequestContextBuilder {
  private config: MiddlewareConfig;

  constructor(config: MiddlewareConfig) {
    this.config = config;
  }

  async build(request: NextRequest): Promise<RequestContext> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const url = new URL(request.url);

    // Extract basic request information
    const method = request.method;
    const path = url.pathname;
    const query = this.extractQuery(url);
    const headers = this.extractHeaders(request);

    // Extract user information
    const userId = this.extractUserId(request, headers);
    const sessionId = this.extractSessionId(request, headers);
    const userAgent = headers['user-agent'];
    const ip = this.extractClientIp(request, headers);

    // Extract request body if needed
    const body = await this.extractBody(request);

    // Create logger with request context
    const logger: Logger = {
      info: (msg: string, ...args: any[]) =>
        console.log(`[INFO] [${requestId}] ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) =>
        console.warn(`[WARN] [${requestId}] ${msg}`, ...args),
      error: (msg: string, ...args: any[]) =>
        console.error(`[ERROR] [${requestId}] ${msg}`, ...args),
      debug: (msg: string, ...args: any[]) =>
        console.debug(`[DEBUG] [${requestId}] ${msg}`, ...args),
      fatal: (msg: string, ...args: any[]) =>
        console.error(`[FATAL] [${requestId}] ${msg}`, ...args),
    };

    return {
      requestId,
      startTime,
      userId,
      sessionId,
      userAgent,
      ip,
      method,
      url: request.url,
      path,
      query,
      headers,
      body,
      logger,
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  private extractQuery(url: URL): Record<string, string> {
    const query: Record<string, string> = {};

    for (const [key, value] of Array.from(url.searchParams.entries())) {
      query[key] = value;
    }

    return query;
  }

  private extractHeaders(request: NextRequest): Record<string, string> {
    const headers: Record<string, string> = {};
    const sensitiveHeaders = this.config.logging?.sensitiveHeaders || [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    for (const [key, value] of Array.from(request.headers.entries())) {
      const lowerKey = key.toLowerCase();

      if (this.config.logging?.logHeaders !== false) {
        // Sanitize sensitive headers
        if (sensitiveHeaders.includes(lowerKey)) {
          headers[key] = this.sanitizeHeader(value);
        } else {
          headers[key] = value;
        }
      }
    }

    return headers;
  }

  private extractUserId(
    request: NextRequest,
    headers: Record<string, string>,
  ): string | undefined {
    // Try to extract user ID from various sources

    // From Authorization header (JWT)
    const authHeader = headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = this.decodeJwtPayload(token);
        return payload?.sub || payload?.userId || payload?.id;
      } catch {
        // Ignore JWT decode errors
      }
    }

    // From custom headers
    const userIdHeader = headers['x-user-id'] || headers['x-userid'];
    if (userIdHeader) {
      return userIdHeader;
    }

    // From cookies
    const cookies = this.parseCookies(headers['cookie'] || '');
    return cookies['userId'] || cookies['user_id'];
  }

  private extractSessionId(
    request: NextRequest,
    headers: Record<string, string>,
  ): string | undefined {
    // From custom headers
    const sessionHeader = headers['x-session-id'] || headers['x-sessionid'];
    if (sessionHeader) {
      return sessionHeader;
    }

    // From cookies
    const cookies = this.parseCookies(headers['cookie'] || '');
    return (
      cookies['sessionId'] || cookies['session_id'] || cookies['JSESSIONID']
    );
  }

  private extractClientIp(
    request: NextRequest,
    headers: Record<string, string>,
  ): string | undefined {
    // Try various headers for client IP
    const ipHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip', // Cloudflare
      'x-forwarded',
      'forwarded-for',
      'forwarded',
    ];

    for (const header of ipHeaders) {
      const value = headers[header];
      if (value) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        const ip = value.split(',')[0].trim();
        if (this.isValidIp(ip)) {
          return ip;
        }
      }
    }

    // Fallback - NextRequest doesn't have direct IP access in Edge runtime
    return undefined;
  }

  private async extractBody(request: NextRequest): Promise<any> {
    if (!this.config.logging?.logBody) {
      return undefined;
    }

    const contentType = request.headers.get('content-type') || '';
    const maxBodySize = this.config.logging?.maxBodySize || 10000; // 10KB default

    try {
      // Clone the request to avoid consuming the original ReadableStream
      const clonedRequest = request.clone();

      if (contentType.includes('application/json')) {
        const text = await clonedRequest.text();

        if (text.length > maxBodySize) {
          return { _truncated: true, _size: text.length };
        }

        const body = JSON.parse(text);
        return this.sanitizeBody(body);
      }

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await clonedRequest.formData();
        const body: Record<string, any> = {};

        for (const [key, value] of Array.from(formData.entries())) {
          body[key] = value;
        }

        return this.sanitizeBody(body);
      }

      if (contentType.includes('multipart/form-data')) {
        return {
          _type: 'multipart/form-data',
          _note: 'Body not logged for multipart data',
        };
      }

      // For other content types, just log the size
      const text = await clonedRequest.text();
      return { _type: contentType, _size: text.length };
    } catch (error) {
      return { _error: 'Failed to parse body', _type: contentType };
    }
  }

  private sanitizeHeader(value: string): string {
    if (value.length <= 10) {
      return '*'.repeat(value.length);
    }
    return (
      value.substring(0, 4) +
      '*'.repeat(value.length - 8) +
      value.substring(value.length - 4)
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = this.config.logging?.sensitiveFields || [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
      'accessToken',
      'refreshToken',
      'creditCard',
      'ssn',
      'socialSecurityNumber',
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        const value = sanitized[field];
        if (typeof value === 'string') {
          sanitized[field] = this.sanitizeString(value);
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    }

    return sanitized;
  }

  private sanitizeString(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    return (
      value.substring(0, 2) +
      '*'.repeat(value.length - 4) +
      value.substring(value.length - 2)
    );
  }

  private decodeJwtPayload(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    if (!cookieHeader) {
      return cookies;
    }

    const pairs = cookieHeader.split(';');

    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key && value) {
        cookies[key] = decodeURIComponent(value);
      }
    }

    return cookies;
  }

  private isValidIp(ip: string): boolean {
    // Basic IP validation (IPv4 and IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
}
