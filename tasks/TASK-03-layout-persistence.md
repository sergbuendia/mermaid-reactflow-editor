## Task: Layout persistence

Store layout in separate JSON file:

example.layout.json

{
  "nodes": {
    "AuthService": { "position": { "x": 120, "y": 300 } }
  },
  "edges": {
    "AuthService->Billing": {
      "bendPoints": [{ "x": 240, "y": 200 }]
    }
  }
}

Rules:
- Missing nodes fallback to auto layout
- Unknown nodes are ignored
