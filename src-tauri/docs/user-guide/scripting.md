# Scripting (Pre/Post)

cURL-UI features a powerful JavaScript-based scripting engine that allows you to automate your API workflows.

## The `env` Object

Both Pre-scripts and Post-scripts have access to the `env` object to interact with your environment variables:

- `env.get("key")`: Fetches the value of a variable (respecting inheritance).
- `env.set("key", "value")`: Sets a variable value. If an environment is active, it sets it there; otherwise, it defaults to the **Global** environment.

## Pre-scripts

Pre-scripts run **before** the request is sent. Use them to:
- Generate dynamic timestamps or IDs.
- Hash sensitive data for authentication.
- Dynamically build request headers.

```javascript
// Example: Set a dynamic timestamp
env.set("timestamp", new Date().toISOString());
```

## Post-scripts

Post-scripts run **after** a response is received. Use them to:
- Extract tokens from a response and save them for future requests.
- Log specific response data to the console.
- Perform basic assertions (results visible in the App Console).

### The `response` Object
Post-scripts have access to the `response` data:
- `response.status`: The HTTP status code.
- `response.data`: The parsed JSON body (or raw text).
- `response.headers`: Response headers.

```javascript
// Example: Save an auth token
if (response.status === 200) {
    env.set("token", response.data.access_token);
    console.log("Token updated!");
}
```

## App Console

All logs generated via `console.log()`, `console.error()`, etc., in your scripts are displayed in the **Console Panel** at the bottom of the application. This is your primary tool for debugging script logic.
