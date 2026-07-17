type Point = { price: number; created_at: string };

type Props = {
  data: Point[]; // expected oldest -> newest
  width?: number;
  height?: number;
};

/** Mini gráfico SVG de evolução de preço. Recebe pontos em ordem cronológica. */
export function PriceSparkline({ data, width = 96, height = 28 }: Props) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
      </svg>
    );
  }
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (data.length - 1);

  const points = data.map((d, i) => {
    const x = pad + i * step;
    const y = pad + (height - pad * 2) * (1 - (d.price - min) / range);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const areaPath = `${path} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;
  const last = data[data.length - 1].price;
  const first = data[0].price;
  const isDown = last < first;
  const color = isDown ? "var(--success)" : last > first ? "var(--destructive)" : "var(--muted-foreground)";

  return (
    <svg width={width} height={height} aria-label="Evolução de preço">
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.2} fill={color} />
    </svg>
  );
}
