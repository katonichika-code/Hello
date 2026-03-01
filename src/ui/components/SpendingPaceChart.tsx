import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { getTransactions } from '../../db/repo';
import { currentMonth } from '../../domain/computations';

interface DailySpending {
  day: number;
  cumulative: number;
}

interface SpendingPaceChartProps {
  selectedMonth: string;
  spendableAmount: number;
}

function toPreviousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildCumulativeSeries(month: string, expenses: { date: string; amount: number }[]): DailySpending[] {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const daily = new Array<number>(lastDay).fill(0);

  expenses.forEach((txn) => {
    if (!txn.date.startsWith(month) || txn.amount >= 0) return;
    const day = Number(txn.date.slice(8, 10));
    if (day >= 1 && day <= lastDay) {
      daily[day - 1] += Math.abs(txn.amount);
    }
  });

  let cumulative = 0;
  return daily.map((value, idx) => {
    cumulative += value;
    return { day: idx + 1, cumulative };
  });
}

export function SpendingPaceChart({ selectedMonth, spendableAmount }: SpendingPaceChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const monthMeta = useMemo(() => {
    const [year, mon] = selectedMonth.split('-').map(Number);
    return {
      year,
      mon,
      lastDay: new Date(year, mon, 0).getDate(),
    };
  }, [selectedMonth]);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const svg = d3.select(svgRef.current);
      if (!svgRef.current) return;
      const width = svgRef.current.clientWidth || 320;
      const height = 160;
      const margin = { top: 8, right: 8, bottom: 20, left: 44 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const [currentTxns, prevTxns] = await Promise.all([
        getTransactions(selectedMonth),
        getTransactions(toPreviousMonth(selectedMonth)),
      ]);

      if (cancelled) return;

      const currentSeries = buildCumulativeSeries(selectedMonth, currentTxns);
      const prevSeries = buildCumulativeSeries(toPreviousMonth(selectedMonth), prevTxns)
        .slice(0, monthMeta.lastDay);

      const isCurrent = selectedMonth === currentMonth();
      const today = new Date().getDate();
      const cutoffDay = isCurrent ? Math.min(today, monthMeta.lastDay) : monthMeta.lastDay;
      const actualSeries = currentSeries.filter((d) => d.day <= cutoffDay);

      const budgetLine = [
        { day: 1, cumulative: 0 },
        { day: monthMeta.lastDay, cumulative: Math.max(spendableAmount, 0) },
      ];

      const yMax = Math.max(
        d3.max(currentSeries, (d) => d.cumulative) ?? 0,
        d3.max(prevSeries, (d) => d.cumulative) ?? 0,
        Math.max(spendableAmount, 0),
      );

      const x = d3.scaleLinear().domain([1, monthMeta.lastDay]).range([0, innerWidth]);
      const y = d3.scaleLinear().domain([0, yMax > 0 ? yMax * 1.1 : 1000]).nice().range([innerHeight, 0]);

      const budgetAtCutoff = monthMeta.lastDay > 1
        ? Math.max(spendableAmount, 0) * ((cutoffDay - 1) / (monthMeta.lastDay - 1))
        : Math.max(spendableAmount, 0);
      const actualAtCutoff = actualSeries.at(-1)?.cumulative ?? 0;
      const paceRatio = budgetAtCutoff > 0 ? actualAtCutoff / budgetAtCutoff : actualAtCutoff > 0 ? 2 : 0;

      const statusColor = paceRatio > 1
        ? 'var(--k-danger)'
        : paceRatio >= 0.8
          ? 'var(--k-warning)'
          : 'var(--k-positive)';

      svg.selectAll('*').remove();
      svg.attr('viewBox', `0 0 ${width} ${height}`);

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const yGridTicks = y.ticks(3);
      g.append('g')
        .selectAll('line')
        .data(yGridTicks)
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => y(d))
        .attr('y2', (d) => y(d))
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', 1);

      const area = d3.area<DailySpending>()
        .x((d) => x(d.day))
        .y0(innerHeight)
        .y1((d) => y(d.cumulative));

      g.append('path')
        .datum(actualSeries)
        .attr('fill', statusColor)
        .attr('fill-opacity', 0.1)
        .attr('d', area);

      const line = d3.line<DailySpending>()
        .x((d) => x(d.day))
        .y((d) => y(d.cumulative));

      g.append('path')
        .datum(actualSeries)
        .attr('fill', 'none')
        .attr('stroke', statusColor)
        .attr('stroke-width', 2)
        .attr('d', line);

      g.append('path')
        .datum(budgetLine)
        .attr('fill', 'none')
        .attr('stroke', '#9CA3AF')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5 4')
        .attr('d', line);

      if (prevSeries.some((d) => d.cumulative > 0)) {
        g.append('path')
          .datum(prevSeries)
          .attr('fill', 'none')
          .attr('stroke', '#D1D5DB')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2 4')
          .attr('d', line);
      }

      const xTicks = Array.from(new Set([1, 8, 15, 22, monthMeta.lastDay].filter((d) => d <= monthMeta.lastDay)));
      const yAxis = d3.axisLeft(y).ticks(3).tickFormat((v) => `¥${d3.format(',')(Number(v))}`);
      const xAxis = d3.axisBottom(x).tickValues(xTicks).tickFormat((v) => `${v}`);

      g.append('g').attr('class', 'pace-y-axis').call(yAxis);
      g.append('g').attr('transform', `translate(0,${innerHeight})`).attr('class', 'pace-x-axis').call(xAxis);
      g.selectAll('.domain').attr('stroke', '#E5E7EB');
      g.selectAll('.tick line').attr('stroke', '#E5E7EB');
      g.selectAll('.tick text').attr('fill', 'var(--k-text-tertiary)').attr('font-size', 10);
    };

    void render();

    const observer = new ResizeObserver(() => {
      void render();
    });
    if (svgRef.current) observer.observe(svgRef.current);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [monthMeta.lastDay, selectedMonth, spendableAmount]);

  return (
    <section className="pace-card">
      <div className="pace-header">
        <span className="pace-title">支出ペース</span>
        <span className="pace-legend">
          <span className="legend-dot actual" /> 今月
          <span className="legend-dot budget" /> 予算ペース
          <span className="legend-dot previous" /> 先月
        </span>
      </div>
      <svg ref={svgRef} width="100%" height="160" role="img" aria-label="支出ペースグラフ" />
    </section>
  );
}
