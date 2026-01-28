# Product Vision

We are building a tool that improves the readability of complex Mermaid diagrams.

Core idea:
- Mermaid code is the source of truth for diagram semantics.
- Visual layout (positions, bends, routing) is stored separately.
- UI allows users to manually adjust layout without changing diagram meaning.

This is NOT:
- A full visual diagram editor
- A draw.io / Miro replacement
- A tool to create or delete connections via UI (for now)

Future direction (not MVP):
- Controlled write-back from UI to Mermaid code
- Bidirectional sync between code and visual representation

Key principle:
Semantic Graph ≠ Visual Layout ≠ Renderer
