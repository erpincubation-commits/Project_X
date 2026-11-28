import React from 'react';

export function WorkspaceNavigation({label,items,current,disabled,onSelect}:{label:string;items:string[];current:string;disabled?:(item:string)=>boolean;onSelect:(item:string)=>void}) {
 return <nav className="workspace-navigation" aria-label={label}><div className="workspace-navigation-label">Sections</div><div className="workspace-navigation-items">{items.map(item=><button type="button" key={item} className="workspace-navigation-item" aria-current={item===current?'page':undefined} aria-pressed={item===current} disabled={disabled?.(item)} onClick={()=>onSelect(item)}>{item}</button>)}</div></nav>;
}
