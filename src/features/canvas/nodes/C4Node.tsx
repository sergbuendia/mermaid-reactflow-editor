import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import type { C4ElementType } from '../../../../graph/graph.model';

// C4 Element type colors based on C4 model conventions
const C4_COLORS: Record<C4ElementType, { bg: string; border: string; text: string; icon: string }> = {
  // Person types - blue
  person: { bg: '#08427B', border: '#052E56', text: '#FFFFFF', icon: '#FFFFFF' },
  person_ext: { bg: '#999999', border: '#6B6B6B', text: '#FFFFFF', icon: '#FFFFFF' },

  // System types - blue shades
  system: { bg: '#1168BD', border: '#0B4884', text: '#FFFFFF', icon: '#FFFFFF' },
  system_ext: { bg: '#999999', border: '#6B6B6B', text: '#FFFFFF', icon: '#FFFFFF' },
  system_db: { bg: '#1168BD', border: '#0B4884', text: '#FFFFFF', icon: '#FFFFFF' },
  system_queue: { bg: '#1168BD', border: '#0B4884', text: '#FFFFFF', icon: '#FFFFFF' },

  // Container types - lighter blue
  container: { bg: '#438DD5', border: '#2E6295', text: '#FFFFFF', icon: '#FFFFFF' },
  container_ext: { bg: '#999999', border: '#6B6B6B', text: '#FFFFFF', icon: '#FFFFFF' },
  container_db: { bg: '#438DD5', border: '#2E6295', text: '#FFFFFF', icon: '#FFFFFF' },
  container_queue: { bg: '#438DD5', border: '#2E6295', text: '#FFFFFF', icon: '#FFFFFF' },

  // Component types - lightest blue
  component: { bg: '#85BBF0', border: '#5D9BD5', text: '#000000', icon: '#000000' },
  component_ext: { bg: '#CCCCCC', border: '#999999', text: '#000000', icon: '#000000' },
  component_db: { bg: '#85BBF0', border: '#5D9BD5', text: '#000000', icon: '#000000' },
  component_queue: { bg: '#85BBF0', border: '#5D9BD5', text: '#000000', icon: '#000000' },
};

// SVG Icons for C4 elements
const PersonIcon = ({ color }: { color: string }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="12" r="8" fill={color} />
    <path d="M6 36C6 27.2 12 22 20 22C28 22 34 27.2 34 36" stroke={color} strokeWidth="3" fill="none" />
  </svg>
);

const DatabaseIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="5" rx="8" ry="3" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M4 5V19C4 20.66 7.58 22 12 22C16.42 22 20 20.66 20 19V5" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M4 12C4 13.66 7.58 15 12 15C16.42 15 20 13.66 20 12" stroke={color} strokeWidth="1.5" fill="none" />
  </svg>
);

const QueueIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M18 9L22 12L18 15" stroke={color} strokeWidth="1.5" fill="none" />
  </svg>
);

const SystemIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="7" y="7" width="10" height="10" rx="1" stroke={color} strokeWidth="1" fill="none" />
  </svg>
);

const ContainerIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M2 8H22" stroke={color} strokeWidth="1.5" />
    <circle cx="5" cy="6" r="1" fill={color} />
    <circle cx="8" cy="6" r="1" fill={color} />
  </svg>
);

const ComponentIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="2" y="7" width="6" height="3" rx="1" stroke={color} strokeWidth="1" fill="none" />
    <rect x="2" y="14" width="6" height="3" rx="1" stroke={color} strokeWidth="1" fill="none" />
  </svg>
);

// Get icon component based on C4 type
function getIconComponent(c4Type: C4ElementType, color: string): React.ReactNode {
  if (c4Type.includes('person')) {
    return <PersonIcon color={color} />;
  }
  if (c4Type.includes('_db') || c4Type.includes('db')) {
    return <DatabaseIcon color={color} />;
  }
  if (c4Type.includes('_queue') || c4Type.includes('queue')) {
    return <QueueIcon color={color} />;
  }
  if (c4Type.includes('component')) {
    return <ComponentIcon color={color} />;
  }
  if (c4Type.includes('container')) {
    return <ContainerIcon color={color} />;
  }
  return <SystemIcon color={color} />;
}

// Get display label for C4 type
function getTypeLabel(c4Type: C4ElementType): string {
  const labels: Record<C4ElementType, string> = {
    person: 'Person',
    person_ext: 'External Person',
    system: 'Software System',
    system_ext: 'External System',
    system_db: 'Database',
    system_queue: 'Queue',
    container: 'Container',
    container_ext: 'External Container',
    container_db: 'Container: Database',
    container_queue: 'Container: Queue',
    component: 'Component',
    component_ext: 'External Component',
    component_db: 'Component: Database',
    component_queue: 'Component: Queue',
  };
  return labels[c4Type] || c4Type;
}

export interface C4NodeData {
  label: string;
  c4Type: C4ElementType;
  description?: string;
  technology?: string;
  isDragging?: boolean;
  locked?: boolean;
  onEdit?: () => void;
}

interface C4NodeProps extends NodeProps {
  data: C4NodeData;
}

const HANDLE_STYLES = {
  backgroundColor: '#2563eb',
  border: '2px solid white',
  width: 10,
  height: 10,
  borderRadius: '2px',
};

const RESIZER_STYLES = {
  handle: {
    backgroundColor: '#2563eb',
    border: '2px solid white',
    width: 12,
    height: 12,
    borderRadius: '3px',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
  },
  line: {
    borderColor: '#2563eb',
    borderWidth: 2,
    opacity: 0.6,
  },
};

function C4NodeInner(props: C4NodeProps) {
  const { data, isConnectable, selected } = props;
  const style = (props as any).style as React.CSSProperties | undefined;

  const c4Type = data.c4Type || 'system';
  const colors = C4_COLORS[c4Type] || C4_COLORS.system;
  const isPerson = c4Type.includes('person');

  const nodeClassName = useMemo(() => {
    const classes = ['c4-node', `c4-${c4Type}`];
    if (selected) classes.push('selected');
    if (data.locked) classes.push('locked');
    return classes.join(' ');
  }, [c4Type, selected, data.locked]);

  const mergedStyle = useMemo<React.CSSProperties>(() => ({
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: isPerson ? '50% 50% 10px 10px' : '10px',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: isPerson ? 'flex-start' : 'center',
    padding: isPerson ? '8px' : '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    ...(style || {}),
  }), [style, colors, isPerson]);

  // Connection handle component
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
        ...HANDLE_STYLES,
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
    <div className={nodeClassName} style={mergedStyle} onDoubleClick={data.onEdit}>
      {/* Node Resizer */}
      {!data.isDragging && (
        <NodeResizer
          isVisible={selected}
          minWidth={isPerson ? 80 : 120}
          minHeight={isPerson ? 100 : 80}
          maxWidth={400}
          maxHeight={300}
          keepAspectRatio={isPerson}
          handleStyle={RESIZER_STYLES.handle}
          lineStyle={RESIZER_STYLES.line}
        />
      )}

      {/* Connection Handles */}
      {!data.isDragging && (
        <>
          <ConnectionHandle type="target" position={Position.Top} id="top-target" />
          <ConnectionHandle type="source" position={Position.Top} id="top-source" />
          <ConnectionHandle type="target" position={Position.Bottom} id="bottom-target" />
          <ConnectionHandle type="source" position={Position.Bottom} id="bottom-source" />
          <ConnectionHandle type="target" position={Position.Left} id="left-target" />
          <ConnectionHandle type="source" position={Position.Left} id="left-source" />
          <ConnectionHandle type="target" position={Position.Right} id="right-target" />
          <ConnectionHandle type="source" position={Position.Right} id="right-source" />
        </>
      )}

      {/* Icon for Person type */}
      {isPerson && (
        <div className="c4-icon" style={{ marginBottom: '4px' }}>
          {getIconComponent(c4Type, colors.icon)}
        </div>
      )}

      {/* Node Label */}
      <div
        className="c4-label"
        style={{
          fontWeight: 'bold',
          fontSize: isPerson ? '12px' : '14px',
          textAlign: 'center',
          lineHeight: 1.2,
          marginBottom: '4px',
        }}
      >
        {data.label}
      </div>

      {/* Technology badge */}
      {data.technology && (
        <div
          className="c4-technology"
          style={{
            fontSize: '10px',
            opacity: 0.9,
            textAlign: 'center',
            marginBottom: '4px',
          }}
        >
          [{data.technology}]
        </div>
      )}

      {/* Description */}
      {data.description && (
        <div
          className="c4-description"
          style={{
            fontSize: '10px',
            opacity: 0.8,
            textAlign: 'center',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {data.description}
        </div>
      )}

      {/* Type label for non-person elements (small badge) */}
      {!isPerson && (
        <div
          className="c4-type-badge"
          style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            fontSize: '8px',
            opacity: 0.7,
            backgroundColor: 'rgba(0,0,0,0.2)',
            padding: '1px 4px',
            borderRadius: '3px',
          }}
        >
          {getTypeLabel(c4Type)}
        </div>
      )}

      {/* Small icon for non-person elements */}
      {!isPerson && (
        <div
          className="c4-small-icon"
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '8px',
            opacity: 0.5,
          }}
        >
          {getIconComponent(c4Type, colors.icon)}
        </div>
      )}
    </div>
  );
}

export const C4Node = memo(C4NodeInner);
