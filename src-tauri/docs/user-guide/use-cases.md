# 🔗 Use Cases

Use Cases allow you to chain multiple requests together into an automated workflow. This is useful for testing complex scenarios, such as authentication flows followed by data retrieval, or multi-step operations that require passing data from one request to another.

## Creating a Use Case

1. Click the **+ New Use Case** button in the Use Cases section.
2. Give your Use Case a descriptive name.
3. Add steps to your Use Case by clicking **Add Step**. For each step, select an existing **Request** and its specific **Execution**.

## Configuring Steps

Each step in a Use Case has specific configurations that dictate how the step behaves and how it interacts with the workflow.

### Success Criteria (`statusCodes`)

You must define what constitutes a "successful" execution for a step. If a step fails, the entire Use Case execution stops.
- Provide a comma-separated list of HTTP status codes (e.g., `200, 201`).
- You can use wildcard notation like `2xx` to catch all success responses, or `4xx` if you are explicitly testing for failures.

### The Blackboard

The **Blackboard** is a storage space dedicated to a single Use Case execution. It allows you to store variables in one step and use them in subsequent steps. Variables that you add manually or define via scripts are persisted alongside your project, keeping them available when you restart the application.

To avoid bloating project files, the automatic `step_X_response` variables are transient (memory-only) and are reset whenever you restart the application.
When a step executes, its HTTP response is automatically saved to the blackboard under a conventional name:
- `step_1_response`
- `step_2_response`
- ...and so on.

These automated variables contain the JSON representation of the response (status, headers, body).

## Step Scripts

Step scripts are small JavaScript snippets that run **immediately before** a step's request is sent. These scripts have access to the blackboard and the request object, allowing you to manipulate the request dynamically based on previous step results.

### Available Context in Scripts

- `blackboard.get(key)`: Retrieves a string value from the blackboard.
- `blackboard.set(key, value)`: Stores a value in the blackboard for subsequent steps.
- `request`: A mutable object representing the outgoing HTTP request.
  - `request.url`: The final resolved URL.
  - `request.method`: The HTTP method (e.g., "GET").
  - `request.body`: The body.
  - `request.headers.get(key)` / `request.headers.set(key, value)`: Manage request headers.
  - `request.queryParams.get(key)` / `request.queryParams.set(key, value)`: Manage query parameters.

### Example: Passing an ID to the next step

Suppose Step 1 creates a user and you want Step 2 to fetch that user.

**Step 2 Script (Using the ID):**
```javascript
// Extract the response from Step 1
const step1Raw = blackboard.get("step_1_response");

if (step1Raw) {
    const step1Response = JSON.parse(step1Raw);
    const body = JSON.parse(step1Response.body);
    
    // Inject the ID into Step 2's URL
    request.url = request.url.replace("{user_id}", body.id);
}
```

## Running a Use Case

Click the **Play** icon next to a Use Case to execute it. The system will run through the steps sequentially.
You can monitor the status of each step (Running, Success, Error). Once completed, you can click the "Show Response" icon on any step to inspect its raw HTTP response data side-by-side with your configuration.
