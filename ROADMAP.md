# MVP Roadmap

## Phase 0 — Setup
- Fork mermaid-reactflow-editor
- Freeze upstream dependency (no rebasing during MVP)

## Phase 1 — Core Graph Model
- Introduce internal GraphModel (semantic)
- Introduce VisualState (layout-only)
- Mermaid parsing produces GraphModel

## Phase 2 — Rendering Adapter
- Map GraphModel + VisualState → React Flow
- React Flow used only as renderer & interaction layer

## Phase 3 — Layout Editing
- Drag nodes to change position
- Edit edge bend points
- Pan & zoom canvas

## Phase 4 — Persistence
- Save layout into separate JSON file
- Reload layout and apply to same Mermaid diagram
- Graceful fallback when nodes/edges change

## Phase 5 — Polish
- Reset layout
- Lock node position
- Export SVG/PNG (optional)
