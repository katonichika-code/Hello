import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { Transaction } from '../api/client';

interface SankeyDiagramProps {
  transactions: Transaction[];
}

interface SankeyNode {
  name: string;
  index?: number;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
}

interface SankeyLink {
  source: number | SankeyNode;
  target: number | SankeyNode;
  value: number;
  width?: number;
  y0?: number;
  y1?: number;
}

export function SankeyDiagram({ transactions }: SankeyDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Filter expenses only (negative amounts)
    const expenses = transactions.filter((t) => t.amount < 0);

    if (expenses.length === 0) {
      return;
    }

    // Aggregate by account -> category
    const flows = new Map<string, number>();
    expenses.forEach((t) => {
      const key = `${t.account}|${t.category}`;
      flows.set(key, (flows.get(key) || 0) + Math.abs(t.amount));
    });

    // Build nodes and links
    const accountSet = new Set<string>();
    const categorySet = new Set<string>();

    expenses.forEach((t) => {
      accountSet.add(t.account);
      categorySet.add(t.category);
    });

    const accounts = Array.from(accountSet);
    const categories = Array.from(categorySet);

    const nodes: SankeyNode[] = [
      ...accounts.map((name) => ({ name })),
      ...categories.map((name) => ({ name })),
    ];

    const nodeIndex = new Map<string, number>();
    nodes.forEach((n, i) => {
      nodeIndex.set(n.name, i);
    });

    const links: SankeyLink[] = [];
    flows.forEach((value, key) => {
      const [account, category] = key.split('|');
      const sourceIdx = nodeIndex.get(account);
      const targetIdx = nodeIndex.get(category);
      if (sourceIdx !== undefined && targetIdx !== undefined) {
        links.push({
          source: sourceIdx,
          target: targetIdx,
          value,
        });
      }
    });

    // Setup dimensions
    const width = 600;
    const height = Math.max(300, nodes.length * 30);
    const margin = { top: 10, right: 120, bottom: 10, left: 120 };

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Create sankey generator
    const sankeyGenerator = sankey<SankeyNode, SankeyLink>()
      .nodeWidth(20)
      .nodePadding(15)
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ]);

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    // Color scale
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Draw links
    svg
      .append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(sankeyLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        const sourceNode = d.source as SankeyNode;
        return colorScale(sourceNode.name);
      })
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d) => Math.max(1, d.width || 0));

    // Draw nodes
    svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll('rect')
      .data(sankeyNodes)
      .join('rect')
      .attr('x', (d) => d.x0 || 0)
      .attr('y', (d) => d.y0 || 0)
      .attr('width', (d) => (d.x1 || 0) - (d.x0 || 0))
      .attr('height', (d) => (d.y1 || 0) - (d.y0 || 0))
      .attr('fill', (d) => colorScale(d.name));

    // Draw labels
    svg
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(sankeyNodes)
      .join('text')
      .attr('x', (d) => ((d.x0 || 0) < width / 2 ? (d.x0 || 0) - 6 : (d.x1 || 0) + 6))
      .attr('y', (d) => ((d.y0 || 0) + (d.y1 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => ((d.x0 || 0) < width / 2 ? 'end' : 'start'))
      .attr('font-size', '12px')
      .text((d) => d.name);
  }, [transactions]);

  const expenses = transactions.filter((t) => t.amount < 0);

  if (expenses.length === 0) {
    return (
      <div className="sankey-diagram">
        <h3>Expense Flow</h3>
        <p className="no-data">No expense data available</p>
      </div>
    );
  }

  return (
    <div className="sankey-diagram">
      <h3>Expense Flow (Account → Category)</h3>
      <svg ref={svgRef}></svg>
    </div>
  );
}
