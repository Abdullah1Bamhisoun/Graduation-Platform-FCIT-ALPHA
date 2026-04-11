import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// Brand palette (mirrors CSS variables in globals.css)
const BRAND = {
  primary:  '#1F7A5C',   // --color-primary-600
  success:  '#15803D',   // --color-success (dark green)
  warning:  '#F59E0B',   // --color-warning
  danger:   '#DC2626',   // --color-danger
  neutral:  '#E5E7EB',   // inactive / track
  textMid:  '#6B7280',   // axis labels
  textDark: '#111827',
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps { data: number[] }

export function SparklineChart({ data }: SparklineProps) {
  const chartData = data.map((v, i) => ({ w: i, v }));
  const hasData = data.some((v) => v > 0);

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BRAND.primary} stopOpacity={0.22} />
            <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={hasData ? BRAND.primary : BRAND.neutral}
          strokeWidth={2}
          fill="url(#sparkGrad)"
          dot={false}
          isAnimationActive
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutProps { activeCount: number; totalCount: number }

export function DonutChart({ activeCount, totalCount }: DonutProps) {
  const inactive = Math.max(0, totalCount - activeCount);
  const pct = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  const data =
    totalCount === 0
      ? [{ name: 'No Data', value: 1, fill: BRAND.neutral }]
      : [
          { name: 'Active',   value: activeCount || 0.01, fill: BRAND.primary },
          { name: 'Inactive', value: inactive    || 0.01, fill: BRAND.neutral },
        ];

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={36}
            outerRadius={54}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
            isAnimationActive
            animationDuration={800}
          >
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold leading-none text-(--color-text-900)">{pct}%</span>
        <span className="text-[10px] mt-0.5 font-medium text-(--color-text-500)">Active</span>
      </div>
    </div>
  );
}

// ─── Gauge Chart ──────────────────────────────────────────────────────────────
// SVG semicircle: left (20,90) → right (180,90) going upward.

interface GaugeProps { value: number }

export function GaugeChart({ value }: GaugeProps) {
  const pct = Math.min(Math.max(value, 0), 100);
  const arcColor =
    pct >= 70 ? BRAND.success :
    pct >= 40 ? BRAND.warning :
    BRAND.danger;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-40 text-(--color-text-900)">
        {/* Background track */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke={BRAND.neutral}
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Filled arc — pathLength="100" normalises dash maths */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke={arcColor}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - pct}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.4s ease' }}
        />
        {/* Value label */}
        <text
          x="100" y="76"
          textAnchor="middle"
          fontSize="26"
          fontWeight="700"
          fill="currentColor"
          fontFamily="inherit"
        >
          {pct}%
        </text>
      </svg>
      <p className="text-[11px] font-medium -mt-1 text-(--color-text-500)">Completion Rate</p>
    </div>
  );
}

// ─── Attention Horizontal Bar Chart ──────────────────────────────────────────

interface AttentionBarProps {
  pending: number;
  overdue: number;
}

const BarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width + 8} y={y + height / 2} dy={4}
      fill={BRAND.textDark} fontSize={12} fontWeight={600} fontFamily="inherit"
    >
      {value}
    </text>
  );
};

const AttentionTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="bg-white border border-(--color-border) rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-(--color-text-900)">{name}</p>
      <p className="text-(--color-text-600) mt-0.5">
        {value} {value === 1 ? 'project' : 'projects'}
      </p>
    </div>
  );
};

export function AttentionBarChart({ pending, overdue }: AttentionBarProps) {
  const data = [
    { name: 'Pending Review',     value: pending, fill: BRAND.warning },
    { name: 'Overdue Milestones', value: overdue, fill: BRAND.danger  },
  ];
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 52, left: 8, bottom: 4 }}
      >
        <XAxis type="number" hide domain={[0, maxVal + Math.ceil(maxVal * 0.2)]} />
        <YAxis
          type="category"
          dataKey="name"
          width={155}
          tick={{ fontSize: 12, fill: BRAND.textMid }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<AttentionTooltip />} cursor={{ fill: '#F9FAFB' }} />
        <Bar
          dataKey="value"
          radius={[0, 6, 6, 0]}
          label={<BarLabel />}
          isAnimationActive
          animationDuration={700}
        >
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
