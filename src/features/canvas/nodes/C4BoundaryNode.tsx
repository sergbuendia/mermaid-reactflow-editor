import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import type { C4BoundaryType } from '../../../../graph/graph.model';

// C4 Boundary colors
const BOUNDARY_COLORS: Record<C4BoundaryType, { bg: string; border: string; text: string }> = {
  enterprise: { bg: 'rgba(221, 221, 221, 0.3)', border: '#8B8B8B', text: '#4A4A4A' },
  system: { bg: 'rgba(17, 104, 189, 0.1)', border: '#1168BD', text: '#1168BD' },
  container: { bg: 'rgba(67, 141, 213, 0.1)', border: '#438DD5', text: '#438DD5' },
  boundary: { bg: 'rgba(200, 200, 200, 0.2)', border: '#999999', text: '#666666' },
};

// Get label for boundary type
function getBoundaryTypeLabel(boundaryType: C4BoundaryType): string {
  const labels: Record<C4BoundaryType, string> = {
    enterprise: 'Enterprise',
    system: 'System',
    container: 'Container',
    boundary: 'Boundary',
  };
  return labels[boundaryType] || 'Boundary';
}

export interface C4BoundaryNodeData {
  label: string;
  boundaryType: C4BoundaryType;
  isSubgraph?: boolean;
  locked?: boolean;
}

interface C4BoundaryNodeProps extends NodeProps {
  data: C4BoundaryNodeData;
}

const RESIZER_STYLES = {
  handle: {
    backgroundColor: '#6366f1',
    border: '2px solid white',
    width: 12,
    height: 12,
    borderRadius: '3px',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
  },
  line: {
    borderColor: '#6366f1',
    borderWidth: 2,
    opacity: 0.6,
  },
};

function C4BoundaryNodeInner(props: C4BoundaryNodeProps) {
  const { data, isConnectable, selected } = props;
  const style = (props as any).style as React.CSSProperties | undefined;

  const boundaryType = data.boundaryType || 'boundary';
  const colors = BOUNDARY_COLORS[boundaryType] || BOUNDARY_COLORS.boundary;

  const nodeClassName = useMemo(() => {
    const classes = ['c4-boundary-node', `c4-boundary-${boundaryType}`];
    if (selected) classes.push('selected');
    if (data.locked) classes.push('locked');
    return classes.join(' ');
  }, [boundaryType, selected, data.locked]);

  const mergedStyle = useMemo<React.CSSProperties>(() => ({
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'visible',
    ...(style || {}),
  }), [style, colors]);

  // Handle component for connection points
  const ConnectionHandle = ({
    type,
    position,
    id,
  }: {
    type: 'source' | 'target';
    position: Position;
    id: string;
  }) => (
    <Handle
      type={type}
      position={position}
      isConnectable={isConnectable}
      id={id}
      style={{
        backgroundColor: colors.border,
        border: '2px solid white',
        width: 10,
        height: 10,
        borderRadius: '2px',
        left: position === Position.Left ? 0 : position === Position.Right ? undefined : '50%',
        right: position === Position.Right ? 0 : undefined,
        top: position === Position.Top ? 0 : position === Position.Bottom ? undefined : '50%',
        bottom: position === Position.Bottom ? 0 : undefined,
        transform:
          position === Position.Top ? 'translate(-50%, -50%)' :
          position === Position.Bottom ? 'translate(-50%, 50%)' :
          position === Position.Left ? 'translate(-50%, -50%)' :
          'translate(50%, -50%)',
      }}
    />
  );

  return (
    <div className={nodeClassName} style={mergedStyle}>
      {/* Node Resizer */}
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        handleStyle={RESIZER_STYLES.handle}
        lineStyle={RESIZER_STYLES.line}
      />

      {/* Connection Handles */}
      <ConnectionHandle type="target" position={Position.Top} id="top-target" />
      <ConnectionHandle type="source" position={Position.Top} id="top-source" />
      <ConnectionHandle type="target" position={Position.Bottom} id="bottom-target" />
      <ConnectionHandle type="source" position={Position.Bottom} id="bottom-source" />
      <ConnectionHandle type="target" position={Position.Left} id="left-target" />
      <ConnectionHandle type="source" position={Position.Left} id="left-source" />
      <ConnectionHandle type="target" position={Position.Right} id="right-target" />
      <ConnectionHandle type="source" position={Position.Right} id="right-source" />

      {/* Header with label */}
      <div
        className="c4-boundary-header"
        style={{
          position: 'absolute',
          top: '-12px',
          left: '16px',
          backgroundColor: 'white',
          padding: '2px 12px',
          borderRadius: '4px',
          border: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: colors.text,
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {getBoundaryTypeLabel(boundaryType)}
        </span>
        <span
          style={{
            fontWeight: 'bold',
            fontSize: '13px',
            color: colors.text,
          }}
        >
          {data.label}
        </span>
      </div>

      {/* Content area for child nodes */}
      <div
        className="c4-boundary-content"
        style={{
          flex: 1,
          padding: '24px 16px 16px 16px',
          minHeight: '100px',
        }}
      />
    </div>
  );
}

export const C4BoundaryNode = memo(C4BoundaryNodeInner);
