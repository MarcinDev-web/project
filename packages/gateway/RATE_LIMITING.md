# Rate Limiting

Gateway endpoints use Token Bucket rate limiting to prevent abuse.

## Configuration

### Token Endpoint
- **Capacity**: 10 requests
- **Refill Rate**: 1 per second
- **Effect**: Maximum 10 requests per 10 seconds per user+IP

### Health Endpoint
- **Capacity**: 100 requests
- **Refill Rate**: 10 per second
- **Effect**: More lenient for monitoring/health checks

## Custom Rate Limiting

```typescript
import { GatewayRateLimiter } from '@engine/gateway';

const customLimiter = new GatewayRateLimiter({
  capacity: 20,
  refillPerSec: 2,
  keyGenerator: (req) => req.ip || 'unknown',
});

app.post('/api/custom', customLimiter.middleware(), handler);
```

## Response Format

When rate limit is exceeded:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 1
}
```

Status code: `429 Too Many Requests`

