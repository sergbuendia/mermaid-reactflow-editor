## Task: GraphModel to React Flow adapter

Input:
- GraphModel
- VisualState

Output:
- React Flow nodes & edges

Rules:
- React Flow IDs must map 1:1 to GraphModel IDs
- Positions come ONLY from VisualState
- No semantic logic inside UI layer
