import { useEffect, useRef } from "react";
import * as echarts from "echarts";

export function LabMetricsEChart({ metrics = [] }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !metrics.length) return;

    const chartInstance = echarts.init(chartRef.current);

    const categories = metrics.map((m) => m.name || "Test");
    const values = metrics.map((m) => Number(m.value) || 0);

    const itemColors = metrics.map((m) => {
      const st = String(m.status || "").toLowerCase();
      if (st === "high" || st === "abnormal" || st === "elevated") return "#EF4444";
      if (st === "low") return "#F59E0B";
      return "#10B981";
    });

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const idx = params[0]?.dataIndex;
          const item = metrics[idx];
          if (!item) return "";
          return `
            <div style="font-size:12px; font-weight:bold; padding:4px;">
              <div>${item.name}</div>
              <div style="color:${params[0]?.color}; font-size:14px; margin-top:2px;">
                Value: ${item.value} ${item.unit || ""}
              </div>
              <div style="color:#9CA3AF; font-size:11px; margin-top:2px;">
                Ref Range: ${item.minRef || 0} - ${item.maxRef || "N/A"} ${item.unit || ""}
              </div>
              <div style="margin-top:4px; font-weight:bold; text-transform:uppercase; font-size:10px;">
                Status: <span style="color:${params[0]?.color}">${item.status || "normal"}</span>
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "10%",
        top: "12%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "rgba(156, 163, 175, 0.4)" } },
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 11,
          rotate: categories.length > 4 ? 25 : 0,
        },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "rgba(156, 163, 175, 0.4)" } },
        splitLine: { lineStyle: { color: "rgba(156, 163, 175, 0.1)" } },
        axisLabel: { color: "#9CA3AF", fontSize: 11 },
      },
      series: [
        {
          name: "Measured Value",
          type: "bar",
          barWidth: "40%",
          data: values.map((val, idx) => ({
            value: val,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: itemColors[idx] },
                { offset: 1, color: itemColors[idx] + "66" },
              ]),
              borderRadius: [8, 8, 0, 0],
            },
          })),
        },
      ],
    };

    chartInstance.setOption(option);

    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [metrics]);

  return <div ref={chartRef} className="w-full h-64" />;
}

export function HealthGaugeEChart({ score = 85, statusText = "Clinical Stability" }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chartInstance = echarts.init(chartRef.current);

    const option = {
      backgroundColor: "transparent",
      series: [
        {
          type: "gauge",
          startAngle: 180,
          endAngle: 0,
          center: ["50%", "70%"],
          radius: "100%",
          min: 0,
          max: 100,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 12,
              color: [
                [0.3, "#EF4444"],
                [0.7, "#F59E0B"],
                [1, "#10B981"],
              ],
            },
          },
          pointer: {
            icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
            length: "60%",
            width: 6,
            offsetCenter: [0, "-10%"],
            itemStyle: { color: "#3B82F6" },
          },
          axisTick: { length: 6, lineStyle: { color: "auto", width: 1 } },
          splitLine: { length: 12, lineStyle: { color: "auto", width: 2 } },
          axisLabel: { color: "#9CA3AF", fontSize: 10, distance: -20 },
          title: {
            offsetCenter: [0, "-20%"],
            fontSize: 12,
            color: "#9CA3AF",
            fontWeight: "bold",
          },
          detail: {
            fontSize: 22,
            offsetCenter: [0, "10%"],
            valueAnimation: true,
            formatter: (value) => `${Math.round(value)}%`,
            color: "#10B981",
            fontWeight: "bold",
          },
          data: [{ value: score, name: statusText }],
        },
      ],
    };

    chartInstance.setOption(option);

    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [score, statusText]);

  return <div ref={chartRef} className="w-full h-44" />;
}

export function MedicationPieEChart({ medicines = [] }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !medicines.length) return;

    const chartInstance = echarts.init(chartRef.current);

    const scheduleCounts = {};
    medicines.forEach((m) => {
      const sch = m.schedule || "Daily";
      scheduleCounts[sch] = (scheduleCounts[sch] || 0) + 1;
    });

    const pieData = Object.entries(scheduleCounts).map(([name, value]) => ({
      name,
      value,
    }));

    const option = {
      backgroundColor: "transparent",
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: {
        bottom: "0%",
        left: "center",
        textStyle: { color: "#9CA3AF", fontSize: 10 },
      },
      series: [
        {
          name: "Schedule",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: "#1F2937",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: "bold", color: "#F3F4F6" },
          },
          data: pieData,
        },
      ],
    };

    chartInstance.setOption(option);

    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [medicines]);

  return <div ref={chartRef} className="w-full h-48" />;
}
