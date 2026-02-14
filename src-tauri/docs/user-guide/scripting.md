# 📜 Scripting

cURL-UI allows running JavaScript logic before and after requests.

## Script API

### The `env` Object
Used to interact with variables:
- `env.get("key")`: Retrieves a variable value.
- `env.set("key", "value")`: Sets a variable in the active or Global environment.

### The `response` Object (Post-scripts only)
Provides access to response data:
- `response.status`: HTTP status code.
- `response.body`: Response body content.
- `response.headers`: Response headers.
- `response.time`: Request duration in milliseconds.

## Pre-scripts
Executed before the request is sent. Useful for dynamic data generation.
```javascript
env.set("timestamp", Date.now().toString());
```

## Post-scripts
Executed after a response is received. Useful for extracting data or logging.
```javascript
if (response.status === 200) {
    const data = JSON.parse(response.body);
    env.set("token", data.token);
}
```

## Debugging
Use `console.log()`, `console.warn()`, or `console.error()` inside your scripts. All outputs are automatically redirected to the application's integrated **Console Panel** for easy inspection during debugging.
