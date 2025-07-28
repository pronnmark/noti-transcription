# Middleware Migration Guide

This guide shows how to refactor API routes to use the centralized middleware system.

## Benefits

1. **Eliminate Code Duplication**: No more copying auth checks, error handling, or logging
2. **Consistent Behavior**: All routes behave the same way
3. **Easier Maintenance**: Update behavior in one place
4. **Better Error Handling**: Automatic error catching and formatting

## Migration Examples

### 1. Basic Route (No Auth)

**Before:**
```typescript
export async function GET(request: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**After:**
```typescript
import { withMiddleware, createApiResponse } from '@/lib/middleware';

export const GET = withMiddleware(
  async (request, context) => {
    // Your logic here
    return NextResponse.json(
      createApiResponse({ success: true })
    );
  }
);
```

### 2. Authenticated Route

**Before:**
```typescript
export async function GET(request: NextRequest) {
  try {
    // Manual auth check
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!await validateSession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Your logic here
    return NextResponse.json({ data: 'secret' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**After:**
```typescript
import { withAuthMiddleware, createApiResponse } from '@/lib/middleware';

export const GET = withAuthMiddleware(
  async (request, context) => {
    // Auth is already checked by middleware
    // Your logic here
    return NextResponse.json(
      createApiResponse({ data: 'secret' })
    );
  }
);
```

### 3. Route with Parameters

For routes with parameters in Next.js App Router:

```typescript
import { withAuthMiddleware, createApiResponse } from '@/lib/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = withAuthMiddleware(async (request, context) => {
    const { id } = await params;
    
    // Your logic here
    return NextResponse.json(
      createApiResponse({ id, data: 'example' })
    );
  });

  return handler(request);
}
```

### 4. Using Debug Logging

Replace manual console.log with centralized debug:

**Before:**
```typescript
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

// In your route
debugLog('Processing request');
```

**After:**
```typescript
import { apiDebug } from '@/lib/utils';

// In your route
apiDebug('Processing request', { requestId: context.requestId });
```

## Available Middleware Wrappers

1. **withMiddleware**: Basic middleware with configurable options
2. **withAuthMiddleware**: Includes authentication check
3. **withErrorHandling**: Just error handling
4. **withLogging**: Just request/response logging

## Configuration Options

```typescript
withMiddleware(handler, {
  logging: {
    enabled: true,
    logRequests: true,
    logResponses: true,
    logBody: false, // Don't log sensitive data
  },
  errorHandling: {
    enabled: true,
    includeStackTrace: process.env.NODE_ENV === 'development',
    sanitizeErrors: true,
  },
  rateLimit: {
    enabled: true,
    maxRequests: 50,
    windowMs: 60000, // 1 minute
  },
});
```

## Response Helpers

Use these helpers for consistent response formatting:

```typescript
// Success response
createApiResponse(data, {
  statusCode: 200,
  meta: {
    requestId: context.requestId,
    customField: 'value',
  }
});

// Error response  
createErrorResponse(
  'Error message',
  'ERROR_CODE',
  400,
  { details: 'Additional info' }
);

// Paginated response
createPaginatedResponse(items, {
  page: 1,
  pageSize: 20,
  totalItems: 100,
  totalPages: 5,
});
```

## Migration Checklist

- [ ] Replace manual try-catch with middleware wrapper
- [ ] Remove manual auth checks (use withAuthMiddleware)
- [ ] Replace console.log with apiDebug
- [ ] Use response helpers instead of manual formatting
- [ ] Remove duplicate error handling code
- [ ] Add appropriate middleware configuration

## Notes

- The middleware system handles all errors automatically
- Request IDs are generated for tracking
- Performance metrics are logged automatically
- All responses follow a consistent format