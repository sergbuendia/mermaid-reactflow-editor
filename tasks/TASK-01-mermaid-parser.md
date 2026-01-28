## Task: Mermaid to GraphModel parser

Input:
- Mermaid diagram text

Output:
- GraphModel with stable node and edge IDs

Rules:
- IDs must NOT depend on node position
- IDs must survive layout changes
- Subgraphs must be preserved

Out of scope:
- Visual properties
- Layout hints
