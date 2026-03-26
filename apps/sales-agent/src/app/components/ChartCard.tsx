import { motion } from "motion/react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AppCard } from "./ui/AppCard";

interface ChartCardProps {
  title: string;
  type: "line" | "bar" | "pie" | "area";
  data?: any[];
}

// Sample data
const fallbackLineData = [
  { name: "Jan", value: 4000 },
  { name: "Feb", value: 3000 },
  { name: "Mar", value: 5000 },
  { name: "Apr", value: 4500 },
  { name: "May", value: 6000 },
  { name: "Jun", value: 5500 },
];

const fallbackBarData = [
  { name: "Electronics", value: 4000 },
  { name: "Clothing", value: 3000 },
  { name: "Food", value: 2000 },
  { name: "Books", value: 2780 },
  { name: "Toys", value: 1890 },
];

const fallbackPieData = [
  { name: "18-25", value: 400 },
  { name: "26-35", value: 300 },
  { name: "36-45", value: 300 },
  { name: "46+", value: 200 },
];

const fallbackAreaData = [
  { name: "Week 1", value: 2400 },
  { name: "Week 2", value: 1398 },
  { name: "Week 3", value: 9800 },
  { name: "Week 4", value: 3908 },
];

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
const gridStroke = "var(--border)";
const axisStroke = "var(--muted-foreground)";
const tooltipContentStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  color: "var(--popover-foreground)",
};

export function ChartCard({ title, type, data }: ChartCardProps) {
  // Custom Formatter to abbreviate long names if needed, or format numbers
  const yAxisFormatter = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  const renderPieLabel = (props: any) => {
    const { name, percent, x, y, textAnchor, dominantBaseline } = props;
    const label = `${name.length > 8 ? name.substring(0, 8) + "..." : name} ${(percent * 100).toFixed(0)}%`;

    return (
      <text
        x={x}
        y={y}
        fill="var(--foreground)"
        fontSize={12}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
      >
        {label}
      </text>
    );
  };

  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data || fallbackLineData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={axisStroke} fontSize={12} tick={{ fill: axisStroke }} tickFormatter={(str) => str.length > 10 ? str.substring(0, 10) + '...' : str} />
              <YAxis stroke={axisStroke} fontSize={12} tickFormatter={yAxisFormatter} />
              <Tooltip contentStyle={tooltipContentStyle} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ fill: "#6366f1", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data || fallbackBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={axisStroke} fontSize={12} tick={{ fill: axisStroke }} tickFormatter={(str) => str.length > 10 ? str.substring(0, 10) + '...' : str} />
              <YAxis stroke={axisStroke} fontSize={12} tickFormatter={yAxisFormatter} />
              <Tooltip contentStyle={tooltipContentStyle} />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie":
        const pieDataset = data || fallbackPieData;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieDataset}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPieLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieDataset.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} />
            </PieChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data || fallbackAreaData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={axisStroke} fontSize={12} tick={{ fill: axisStroke }} tickFormatter={(str) => str.length > 10 ? str.substring(0, 10) + '...' : str} />
              <YAxis stroke={axisStroke} fontSize={12} tickFormatter={yAxisFormatter} />
              <Tooltip contentStyle={tooltipContentStyle} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AppCard hover>
        <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
        <div className="h-64">{renderChart()}</div>
      </AppCard>
    </motion.div>
  );
}
