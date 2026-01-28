# Architecture Overview

## Layers

Mermaid Code
   ↓
Mermaid Parser
   ↓
Semantic Graph (GraphModel)
   ↔
Visual State (Layout)
   ↓
Renderer Adapter (React Flow)
   ↓
Canvas UI

## Rules
- GraphModel contains NO visual information.
- VisualState contains NO semantic information.
- UI changes VisualState only.
- Mermaid code is never mutated in MVP.
