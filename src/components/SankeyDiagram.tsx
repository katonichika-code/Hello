import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { Transaction } from '../db/repo';
import * as repo from '../db/repo';

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
    let mounted = true;

    const render = async () => {
      const svgRoot = d3.select(svgRef.current);
      svgRoot.selectAll('*').remove();

      const settings = await repo.getSettings();

      const expenses = transactions.filter((t) => t.amount < 0);
      if (expenses.length === 0 || !mounted) {
        return;
      }

      const categorySpending = new Map<string, number>();
      expenses.forEach((t) => {
        categorySpending.set(t.category, (categorySpending.get(t.category) || 0) + Math.abs(t.amount));
      });

      const categoryNodes = Array.from(categorySpending.entries())
        .filter(([, amount]) => amount > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([category]) => category || '未分類');

      const nodes: SankeyNode[] = [
        { name: '収入' },
        { name: '固定費' },
        { name: '貯蓄' },
        { name: '変動費' },
        ...categoryNodes.map((name) => ({ name })),
      ];

      const nodeIndex = new Map<string, number>();
      nodes.forEach((n, i) => nodeIndex.set(n.name, i));

      const income = settings.monthly_income || 0;
      const fixedCost = settings.fixed_cost_total || 0;
      const savingsTarget = settings.monthly_savings_target || 0;
      const spendable = Math.max(income - fixedCost - savingsTarget, 0);

      const links: SankeyLink[] = [
        { source: nodeIndex.get('収入')!, target: nodeIndex.get('固定費')!, value: fixedCost },
        { source: nodeIndex.get('収入')!, target: nodeIndex.get('貯蓄')!, value: savingsTarget },
        { source: nodeIndex.get('収入')!, target: nodeIndex.get('変動費')!, value: spendable },
      ];

      categoryNodes.forEach((name) => {
        const value = categorySpending.get(name) || 0;
        if (value <= 0) return;
        const target = nodeIndex.get(name);
        const source = nodeIndex.get('変動費');
        if (target === undefined || source === undefined) return;
        links.push({ source, target, value });
      });

      if (!mounted) return;

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
    };

    void render();

    return () => {
      mounted = false;
    };
  }, [transactions]);

  const expenses = transactions.filter((t) => t.amount < 0);

  if (expenses.length === 0) {
    return (
      <div className="sankey-diagram">
        <p className="no-data">支出データがありません</p>
      </div>
    );
  }

  return (
    <div className="sankey-diagram">
      <svg ref={svgRef}></svg>
    </div>
  );
}
